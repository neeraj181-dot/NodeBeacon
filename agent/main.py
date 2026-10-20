"""Windows service and visible control UI entry points."""
import logging
from logging.handlers import RotatingFileHandler
import sys
import threading

import servicemanager
import win32api
import win32event
import win32service
import win32serviceutil
from config import data_dir
from runtime import publish_unlock_status, run_unlock_notifications
from unlock import UnlockEvents, run_interactive_unlock_listener

SERVICE_NAME = 'NodeBeaconAgent'


def run_interactive_listener_with_status(events, stop_event):
    try:
        run_interactive_unlock_listener(
            events, stop_event,
            on_registered=lambda: publish_unlock_status(
                'Listening', 'Windows unlock listener is active and waiting for this PC to unlock.'),
        )
    except Exception as exc:
        publish_unlock_status(
            'Listener error',
            'Windows session notifications could not start. Restart the agent and check its local log.',
        )
        logging.error('[NodeBeaconAgent] Interactive unlock listener stopped (%s).', type(exc).__name__)

def initialize_logging():
    directory = data_dir() / 'logs'
    directory.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(directory / 'agent.log', maxBytes=2 * 1024 * 1024, backupCount=3, encoding='utf-8')
    handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
    logging.getLogger().addHandler(handler)
    logging.getLogger().setLevel(logging.INFO)

class SingleInstance:
    def __init__(self, name):
        self.handle = win32event.CreateMutex(None, False, 'Global\\NodeBeacon.' + name)
        self.acquired = win32api.GetLastError() != 183

    def close(self):
        win32api.CloseHandle(self.handle)

class NodeBeaconAgentService(win32serviceutil.ServiceFramework):
    _svc_name_ = SERVICE_NAME
    _svc_display_name_ = 'NodeBeacon Monitoring Agent'
    _svc_description_ = 'Authorized PC monitoring with visible Start/Stop controls.'

    def __init__(self, args):
        super().__init__(args)
        self.stop_event = threading.Event()
        self.unlock_events = UnlockEvents()

    def GetAcceptedControls(self):
        accepted = super().GetAcceptedControls()
        return accepted | win32service.SERVICE_ACCEPT_SESSIONCHANGE

    def SvcOtherEx(self, control, event_type, data):
        if not self.unlock_events.receive(control, event_type, data, self.stop_event):
            if control == win32service.SERVICE_CONTROL_SESSIONCHANGE:
                logging.info('Ignored a non-unlock or invalid Windows session event.')
        return 0

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        self.stop_event.set()

    def SvcDoRun(self):
        initialize_logging()
        lock = SingleInstance('Worker')
        if not lock.acquired:
            lock.close()
            return
        try:
            detector = threading.Thread(target=run_unlock_notifications,
                args=(self.unlock_events.pending, self.stop_event), name='NodeBeaconUnlockNotifications', daemon=True)
            detector.start()
            logging.info('[NodeBeaconAgent] Windows service is accepting session-change notifications')
            publish_unlock_status('Listening', 'Windows unlock listener is active and waiting for this PC to unlock.')
            from runtime import run_agent
            run_agent(self.stop_event)
        except Exception:
            logging.error('Agent stopped after a configuration or runtime error.')
            from config import atomic_json
            atomic_json(data_dir() / 'status.json', {'status': 'Error',
                'error': 'Configuration unavailable or monitoring failed. Check local configuration and agent logs.'})
        finally:
            self.stop_event.set()
            lock.close()

def main():
    argument = sys.argv[1] if len(sys.argv) > 1 else ''
    if argument == '--diagnostics' and len(sys.argv) == 3:
        from diagnostics import run
        sys.exit(run(sys.argv[2]))
    elif argument == '--probe-instance' and len(sys.argv) == 3:
        from pathlib import Path
        import time
        lock = SingleInstance('DiagnosticWorker')
        try:
            Path(sys.argv[2]).write_text('acquired' if lock.acquired else 'duplicate', encoding='utf-8')
            if lock.acquired:
                time.sleep(5)
        finally:
            lock.close()
    elif argument == '--service':
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(NodeBeaconAgentService)
        servicemanager.StartServiceCtrlDispatcher()
    elif argument in ('install', 'remove', 'start', 'stop', 'restart', 'debug'):
        win32serviceutil.HandleCommandLine(NodeBeaconAgentService)
    elif argument == '--console':
        initialize_logging()
        lock = SingleInstance('Worker')
        if not lock.acquired:
            raise RuntimeError('NodeBeacon monitoring is already running.')
        try:
            stop_event = threading.Event()
            unlock_events = UnlockEvents()
            notifications = threading.Thread(
                target=run_unlock_notifications,
                args=(unlock_events.pending, stop_event),
                name='NodeBeaconUnlockNotifications', daemon=True,
            )
            listener = threading.Thread(
                target=run_interactive_listener_with_status,
                args=(unlock_events, stop_event),
                name='NodeBeaconSessionListener', daemon=True,
            )
            notifications.start()
            listener.start()
            from runtime import run_agent
            try:
                run_agent(stop_event)
            finally:
                stop_event.set()
                listener.join(timeout=3)
                notifications.join(timeout=3)
        finally:
            lock.close()
    elif argument == '--uninstall':
        from uninstaller import uninstall
        uninstall()
    else:
        from desktop import run_desktop
        run_desktop()

if __name__ == '__main__':
    main()

