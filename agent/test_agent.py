"""Repeatable tests; all configuration files live in temporary directories."""
import json
from pathlib import Path
import tempfile
import os
import queue
import sys
import types
import unittest
from unittest.mock import Mock, patch
import uuid
import requests
import threading
import collector
import config
import runtime
import win32service
from unlock import (UnlockEvents, WTS_SESSION_LOCK, WTS_SESSION_UNLOCK,
                    deliver_unlock, receive_interactive_session_change,
                    run_interactive_unlock_listener)
from main import SingleInstance, run_interactive_listener_with_status


class StopEvent:
    def __init__(self, iterations):
        self.iterations = iterations
        self.delays = []
    def is_set(self):
        return len(self.delays) >= self.iterations
    def wait(self, delay):
        self.delays.append(delay)
        return self.is_set()


class AgentTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name)
        self.config = {'server_url': 'https://old.example.test', 'metrics_url': 'https://old.example.test/api/metrics/',
                       'management_url': 'https://management.example.test', 'device_token': 'test-only-device-secret',
                       'device_id': 'test-device', 'device_name': 'Test PC', 'enabled': True, 'interval': 10, 'config_version': 1}
        self.patches = [patch.object(config, 'data_dir', return_value=self.path), patch.object(runtime, 'data_dir', return_value=self.path)]
        for item in self.patches:
            item.start(); self.addCleanup(item.stop)
        config.save_config(self.config)
        self.session = Mock()
        response = Mock(status_code=201)
        response.raise_for_status.return_value = None
        self.session.post.return_value = response
        self.session.get.return_value = Mock()
        self.session.get.return_value.json.return_value = self.config.copy()

    def run_worker(self, event):
        with patch.object(runtime.requests, 'Session', return_value=self.session), patch.object(runtime, 'collect_all', return_value={'cpu_usage': 10}):
            runtime.run_agent(event)

    def test_windows_os_label_uses_build_number_to_identify_windows_11(self):
        with patch.object(collector.sys, 'platform', 'win32'), \
             patch.object(collector.sys, 'getwindowsversion', return_value=types.SimpleNamespace(major=10, build=22631), create=True):
            self.assertEqual(collector.get_os(), 'Windows 11')

    def test_windows_os_label_keeps_windows_10_for_older_builds(self):
        with patch.object(collector.sys, 'platform', 'win32'), \
             patch.object(collector.sys, 'getwindowsversion', return_value=types.SimpleNamespace(major=10, build=19045), create=True):
            self.assertEqual(collector.get_os(), 'Windows 10')

    def test_atomic_dpapi_roundtrip(self):
        raw = (self.path / 'config.json').read_text()
        self.assertNotIn('test-only-device-secret', raw)
        self.assertNotIn('"device_token":', raw)
        self.assertEqual(config.load_config()['device_token'], self.config['device_token'])
        self.assertEqual(list(self.path.glob('*.tmp')), [])

    def test_disabled_makes_no_network_calls(self):
        self.config['enabled'] = False
        config.save_config(self.config)
        self.run_worker(StopEvent(1))
        self.session.get.assert_not_called()
        self.session.post.assert_not_called()
        self.assertEqual(json.loads((self.path / 'status.json').read_text())['status'], 'Stopped')

    def test_connection_stop_and_start(self):
        self.run_worker(StopEvent(1))
        self.assertEqual(self.session.post.call_count, 3)  # metrics, Connected, final Stopped
        self.assertEqual(self.session.post.call_args.kwargs['json']['status'], 'Stopped')
        status = json.loads((self.path / 'status.json').read_text())
        self.assertEqual(status['status'], 'Stopped')
        self.assertIsNotNone(status['last_success'])
        self.session.reset_mock()
        self.run_worker(StopEvent(1))
        self.assertEqual(self.session.post.call_count, 3)

    def test_retry_backoff_and_reset(self):
        success = self.session.post.return_value
        # Each failed attempt has one telemetry request and one reconnect heartbeat.
        self.session.post.side_effect = [requests.ConnectionError(), success] * 4 + [success, success, requests.ConnectionError(), success, success]
        event = StopEvent(6)
        self.run_worker(event)
        self.assertEqual(event.delays, [5, 10, 30, 60, 10, 5])

    def test_remote_configuration_persists(self):
        remote = {**self.config, 'config_version': 2, 'server_url': 'https://new.example.test', 'server_port': 8443, 'metrics_url': 'https://new.example.test:8443/api/metrics/'}
        self.session.get.return_value.json.return_value = remote
        self.run_worker(StopEvent(1))
        saved = config.load_config()
        self.assertEqual(saved['config_version'], 2)
        self.assertEqual(saved['server_port'], 8443)
        self.assertEqual(saved['management_url'], self.config['management_url'])
        self.assertEqual(self.session.post.call_args_list[0].args[0], remote['metrics_url'])

    def test_foreign_device_configuration_rejected(self):
        self.session.get.return_value.json.return_value = {**self.config, 'device_id': 'someone-else', 'config_version': 2}
        with self.assertRaises(ValueError):
            runtime.synchronize(self.session, self.config)

    def test_only_real_session_unlock_events_are_queued(self):
        events = UnlockEvents()
        stop = threading.Event()
        self.assertFalse(events.receive(win32service.SERVICE_CONTROL_SESSIONCHANGE, 0x5, (8,), stop))
        self.assertFalse(events.receive(win32service.SERVICE_CONTROL_STOP, WTS_SESSION_UNLOCK, (8,), stop))
        self.assertFalse(events.receive(win32service.SERVICE_CONTROL_SESSIONCHANGE, WTS_SESSION_UNLOCK, (-1,), stop))
        self.assertTrue(events.receive(win32service.SERVICE_CONTROL_SESSIONCHANGE, WTS_SESSION_UNLOCK, (8,), stop))
        event_id, session_id = events.pending.get_nowait()
        self.assertEqual(session_id, 8)
        self.assertEqual(len(event_id), 36)
        stop.set()
        self.assertFalse(events.receive(win32service.SERVICE_CONTROL_SESSIONCHANGE, WTS_SESSION_UNLOCK, (8,), stop))

    def test_interactive_windows_lock_is_ignored_and_unlock_is_queued_once(self):
        events = UnlockEvents()
        stop = threading.Event()
        self.assertFalse(receive_interactive_session_change(events, stop, WTS_SESSION_LOCK, 3))
        with self.assertLogs(level='INFO') as logs:
            self.assertTrue(receive_interactive_session_change(events, stop, WTS_SESSION_UNLOCK, 3))
            self.assertFalse(receive_interactive_session_change(events, stop, WTS_SESSION_UNLOCK, 3))
        self.assertIn('Windows session event received: WTS_SESSION_UNLOCK', '\n'.join(logs.output))
        event_id, session_id = events.pending.get_nowait()
        self.assertEqual(session_id, 3)
        self.assertEqual(len(event_id), 36)
        self.assertTrue(events.pending.empty())

    def test_session_notification_object_shape_is_supported(self):
        class Notification:
            dwSessionId = 12
        events = UnlockEvents()
        self.assertTrue(events.receive(win32service.SERVICE_CONTROL_SESSIONCHANGE,
            WTS_SESSION_UNLOCK, Notification(), threading.Event()))
        self.assertEqual(events.pending.get_nowait()[1], 12)

    def test_interactive_listener_registers_a_wndclass_and_unregisters_cleanly(self):
        class WindowClass:
            pass

        class AutoStop:
            stopped = False
            def is_set(self):
                return self.stopped
            def wait(self, _seconds):
                self.stopped = True
                return True

        fake_gui = types.ModuleType('win32gui')
        fake_gui.WNDCLASS = WindowClass
        fake_gui.RegisterClass = Mock()
        fake_gui.CreateWindow = Mock(return_value=777)
        fake_gui.PumpWaitingMessages = Mock(return_value=False)
        fake_gui.DestroyWindow = Mock()
        fake_gui.UnregisterClass = Mock()
        fake_gui.DefWindowProc = Mock()
        fake_api = types.ModuleType('win32api')
        fake_api.GetModuleHandle = Mock(return_value=42)
        wts_api = types.SimpleNamespace(
            WTSRegisterSessionNotification=Mock(return_value=1),
            WTSUnRegisterSessionNotification=Mock(return_value=1),
        )
        registered = threading.Event()
        with patch.dict(sys.modules, {'win32gui': fake_gui, 'win32api': fake_api}), \
             patch('unlock.ctypes.WinDLL', return_value=wts_api):
            run_interactive_unlock_listener(UnlockEvents(), AutoStop(), registered.set)
        fake_gui.RegisterClass.assert_called_once()
        self.assertIsInstance(fake_gui.RegisterClass.call_args.args[0], WindowClass)
        wts_api.WTSRegisterSessionNotification.assert_called_once_with(777, 0)
        wts_api.WTSUnRegisterSessionNotification.assert_called_once_with(777)
        fake_gui.DestroyWindow.assert_called_once_with(777)
        fake_gui.UnregisterClass.assert_called_once()
        self.assertTrue(registered.is_set())

    def test_unlock_http_delivery_has_stable_event_id_and_never_follows_redirects(self):
        response = Mock(status_code=200)
        response.json.return_value = {'status': 'sent'}
        session = Mock()
        session.post.return_value = response
        event_id = '12345678-1234-5678-1234-567812345678'
        with self.assertLogs(level='INFO') as logs:
            self.assertEqual(deliver_unlock(session, self.config, event_id, 3), (200, {'status': 'sent'}))
        self.assertIn('Sending unlock event to backend', '\n'.join(logs.output))
        self.assertIn('Backend response: 200', '\n'.join(logs.output))
        self.assertEqual(session.post.call_args.args[0], 'https://management.example.test/api/servers/agents/unlocked/')
        self.assertEqual(session.post.call_args.kwargs['json'], {'event_id': event_id, 'session_id': 3})
        self.assertFalse(session.post.call_args.kwargs['allow_redirects'])
        with self.assertRaises(ValueError):
            deliver_unlock(session, {'management_url': ''}, event_id, 3)

    def test_unlock_dispatcher_skips_events_when_agent_is_disabled(self):
        from collections import deque
        pending = deque([('12345678-1234-5678-1234-567812345678', 3)])
        stop = threading.Event()

        class Pending:
            def get(self, timeout):
                if pending:
                    return pending.popleft()
                stop.set()
                raise queue.Empty

        self.config['enabled'] = False
        config.save_config(self.config)
        session = Mock()
        with patch.object(runtime.requests, 'Session', return_value=session):
            runtime.run_unlock_notifications(Pending(), stop)
        session.post.assert_not_called()
        saved = json.loads((self.path / 'unlock-status.json').read_text())
        self.assertEqual(saved['status'], 'Disabled')

    def test_unlock_dispatcher_sends_real_queued_event_and_reports_backend_confirmation(self):
        event_id = '12345678-1234-5678-1234-567812345678'
        pending = queue.Queue()
        pending.put((event_id, 3))
        stop = threading.Event()
        statuses = []
        session = Mock()

        def report(state, detail):
            statuses.append((state, detail))
            if state == 'Notification sent':
                stop.set()

        with patch.object(runtime.requests, 'Session', return_value=session), \
             patch.object(runtime, 'deliver_unlock', return_value=(200, {'status': 'sent'})) as deliver, \
             patch.object(runtime, 'publish_unlock_status', side_effect=report):
            runtime.run_unlock_notifications(pending, stop)
        self.assertEqual(deliver.call_count, 1)
        self.assertEqual(deliver.call_args.args[2:], (event_id, 3))
        self.assertIn(('Notification sent', 'Notification sent'), statuses)
        session.close.assert_called_once()

    def test_listener_registration_is_visible_and_failure_is_actionable(self):
        import main
        events, stop = UnlockEvents(), threading.Event()

        def register(_events, _stop, on_registered=None):
            on_registered()

        with patch.object(main, 'run_interactive_unlock_listener', side_effect=register), \
             patch.object(main, 'publish_unlock_status') as status:
            run_interactive_listener_with_status(events, stop)
        status.assert_called_once_with('Listening', 'Windows unlock listener is active and waiting for this PC to unlock.')

        with patch.object(main, 'run_interactive_unlock_listener', side_effect=OSError('native error')), \
             patch.object(main, 'publish_unlock_status') as status, \
             self.assertLogs(level='ERROR'):
            run_interactive_listener_with_status(events, stop)
        self.assertEqual(status.call_args.args[0], 'Listener error')

    def test_single_instance(self):
        name = 'Test.' + str(uuid.uuid4())
        first, second = SingleInstance(name), SingleInstance(name)
        try:
            self.assertTrue(first.acquired)
            self.assertFalse(second.acquired)
        finally:
            second.close(); first.close()
        third = SingleInstance(name)
        try:
            self.assertTrue(third.acquired)
        finally:
            third.close()

    def test_desktop_controls_actual_service_calls(self):
        import tkinter as tk
        import desktop
        try:
            root = tk.Tk()
        except tk.TclError as exc:
            self.skipTest(f'Tk runtime is unavailable in this Python environment: {exc}')
        root.withdraw()
        self.addCleanup(root.destroy)
        with patch.object(desktop, 'data_dir', return_value=self.path), \
             patch.object(desktop.win32serviceutil, 'QueryServiceStatus', return_value=(0, desktop.win32service.SERVICE_RUNNING)), \
             patch.object(desktop.win32serviceutil, 'StopService') as stop, \
             patch.object(desktop.win32serviceutil, 'WaitForServiceStatus') as wait, \
             patch.object(desktop.win32serviceutil, 'StartService') as start:
            panel = desktop.ControlPanel(root)
            self.assertTrue(panel.running)
            panel.toggle()
            stop.assert_called_once_with('NodeBeaconAgent')
            wait.assert_called_once()
            self.assertFalse(config.load_config()['enabled'])
            panel.running = False
            panel.toggle()
            start.assert_called_once_with('NodeBeaconAgent')
            self.assertTrue(config.load_config()['enabled'])

    def test_desktop_starts_interactive_listener_when_service_is_not_installed(self):
        import tkinter as tk
        import desktop
        try:
            root = tk.Tk()
        except tk.TclError as exc:
            self.skipTest(f'Tk runtime is unavailable in this Python environment: {exc}')
        root.withdraw()
        self.addCleanup(root.destroy)
        missing_service = desktop.win32service.error(1060, 'QueryServiceStatus', 'Missing')
        with patch.object(desktop, 'data_dir', return_value=self.path), \
             patch.object(desktop.win32serviceutil, 'QueryServiceStatus', side_effect=missing_service), \
             patch.object(desktop.subprocess, 'Popen') as launch:
            panel = desktop.ControlPanel(root)
            self.assertFalse(panel.service_available)
            panel.toggle()
            self.assertTrue(panel.running)
            self.assertTrue(config.load_config()['enabled'])
            command = launch.call_args.args[0]
            self.assertEqual(command[-1], '--console')

    def test_installer_command_no_recursive_launch(self):
        import installer_gui
        import win32service
        with patch.object(installer_gui.win32serviceutil, 'QueryServiceStatus', side_effect=win32service.error(1060, 'QueryServiceStatus', 'Missing')), \
             patch.object(installer_gui.subprocess, 'run') as command, \
             patch.object(installer_gui.win32serviceutil, 'StartService') as start, \
             patch.object(installer_gui.win32serviceutil, 'WaitForServiceStatus'):
            installer_gui.install_service(Path(r'C:\Program Files\NodeBeacon Agent\NodeBeaconAgent.exe'))
            args = command.call_args.args[0]
            self.assertEqual(args[0:3], ['sc.exe', 'create', 'NodeBeaconAgent'])
            self.assertEqual(args[4], '"C:\\Program Files\\NodeBeacon Agent\\NodeBeaconAgent.exe" --service')
            start.assert_called_once()

    def test_uninstall_stops_before_deleting_and_cleanup_is_scoped(self):
        import uninstaller
        import main
        from unittest.mock import call
        directory = self.path / 'NodeBeacon'
        directory.mkdir()
        fd = os.open(self.path / 'cleanup.ps1', os.O_WRONLY | os.O_CREAT)
        shell = Mock()
        shell.SpecialFolders.return_value = str(self.path)
        actions = Mock()
        with patch.object(uninstaller, 'elevate', return_value=True), \
             patch.object(main, 'SingleInstance', return_value=Mock(acquired=True)), \
             patch.object(uninstaller.sys, 'frozen', True, create=True), \
             patch.dict(os.environ, {'PROGRAMDATA': str(self.path)}), \
             patch.object(uninstaller, 'data_dir', return_value=directory), \
             patch.object(uninstaller.messagebox, 'askyesno', return_value=True), \
             patch.object(uninstaller.messagebox, 'showinfo'), \
             patch.object(uninstaller.win32serviceutil, 'QueryServiceStatus', return_value=(0, uninstaller.win32service.SERVICE_RUNNING)), \
             patch.object(uninstaller.win32serviceutil, 'StopService', actions.stop), \
             patch.object(uninstaller.win32serviceutil, 'WaitForServiceStatus', actions.wait), \
             patch.object(uninstaller.subprocess, 'run', actions.remove_service), \
             patch.object(uninstaller.shutil, 'rmtree', actions.remove_data), \
             patch.object(uninstaller.win32com.client, 'Dispatch', return_value=shell), \
             patch.object(uninstaller.winreg, 'DeleteKey'), \
             patch.object(uninstaller.tempfile, 'mkstemp', return_value=(fd, str(self.path / 'cleanup.ps1'))), \
             patch.object(uninstaller.subprocess, 'Popen', actions.cleanup):
            uninstaller.uninstall()
        names = [item[0] for item in actions.mock_calls]
        self.assertEqual(names[:4], ['stop', 'wait', 'remove_service', 'remove_data'])
        script = (self.path / 'cleanup.ps1').read_text()
        self.assertIn(f'Wait-Process -Id {os.getpid()}', script)
        self.assertIn("Remove-Item -LiteralPath $taskTarget", script)
        self.assertIn("if ($taskTarget -ne 'C:\\Program Files\\NodeBeacon Agent')", script)


if __name__ == '__main__':
    unittest.main()
