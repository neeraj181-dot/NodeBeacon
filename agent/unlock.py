"""Windows service unlock-event filtering and idempotent backend delivery."""
import ctypes
import logging
import queue
import threading
import time
import uuid

import requests
import win32service

WTS_SESSION_UNLOCK = 0x8
WTS_SESSION_LOCK = 0x7
WM_WTSSESSION_CHANGE = 0x02B1
logger = logging.getLogger(__name__)


def receive_interactive_session_change(events, stop_event, event_type, session_id):
    """Normalize WM_WTSSESSION_CHANGE and share service filtering/deduplication."""
    return events.receive(
        win32service.SERVICE_CONTROL_SESSIONCHANGE,
        event_type, (session_id,), stop_event,
    )


class UnlockEvents:
    def __init__(self, max_pending=32, duplicate_window=3.0):
        self.pending = queue.Queue(maxsize=max_pending)
        self.duplicate_window = duplicate_window
        self._last_unlock = {}
        self._lock = threading.Lock()

    def receive(self, control, event_type, data, stop_event):
        if control != win32service.SERVICE_CONTROL_SESSIONCHANGE or event_type != WTS_SESSION_UNLOCK or stop_event.is_set():
            return False
        try:
            # PyWin32 versions expose the session notification as an integer,
            # a one-item tuple, or an object with dwSessionId.
            if isinstance(data, (tuple, list)) and data:
                session_id = data[0]
            elif isinstance(data, dict):
                session_id = data.get('dwSessionId', data.get('session_id'))
            else:
                session_id = getattr(data, 'dwSessionId', data)
            session_id = int(session_id)
            if not 0 <= session_id <= 4_294_967_295:
                return False
            now = time.monotonic()
            with self._lock:
                if now - self._last_unlock.get(session_id, float('-inf')) < self.duplicate_window:
                    logger.info('[NodeBeaconAgent] Duplicate unlock event suppressed')
                    return False
                self.pending.put_nowait((str(uuid.uuid4()), session_id))
                self._last_unlock[session_id] = now
            logger.info('[NodeBeaconAgent] Windows session event received: WTS_SESSION_UNLOCK')
            logger.info('[NodeBeaconAgent] Unlock event detected')
            return True
        except (TypeError, ValueError):
            return False
        except queue.Full:
            logger.error('[NodeBeaconAgent] Unlock event queue is full; event was not delivered')
            return False


def run_interactive_unlock_listener(events, stop_event, on_registered=None):
    """Listen for WTS session changes when running in the logged-in user's session."""
    import win32api
    import win32gui

    class_name = f'NodeBeaconSessionEvents.{uuid.uuid4().hex}'
    hinstance = win32api.GetModuleHandle(None)

    def window_proc(hwnd, message, wparam, lparam):
        if message == WM_WTSSESSION_CHANGE:
            receive_interactive_session_change(events, stop_event, int(wparam), int(lparam))
            return 0
        return win32gui.DefWindowProc(hwnd, message, wparam, lparam)

    window_class = win32gui.WNDCLASS()
    window_class.style = 0
    window_class.lpfnWndProc = window_proc
    window_class.hInstance = hinstance
    window_class.lpszClassName = class_name
    registered = False
    hwnd = None
    wtsapi = ctypes.WinDLL('Wtsapi32.dll', use_last_error=True)
    register = wtsapi.WTSRegisterSessionNotification
    register.argtypes = (ctypes.c_void_p, ctypes.c_uint)
    register.restype = ctypes.c_int
    unregister = wtsapi.WTSUnRegisterSessionNotification
    unregister.argtypes = (ctypes.c_void_p,)
    unregister.restype = ctypes.c_int
    try:
        win32gui.RegisterClass(window_class)
        registered = True
        hwnd = win32gui.CreateWindow(
            class_name, 'NodeBeacon session listener', 0,
            0, 0, 0, 0, 0, 0, hinstance, None,
        )
        if not register(hwnd, 0):  # NOTIFY_FOR_THIS_SESSION
            raise ctypes.WinError(ctypes.get_last_error())
        logger.info('[NodeBeaconAgent] Registered for Windows session notifications')
        if on_registered:
            on_registered()
        while not stop_event.is_set():
            if win32gui.PumpWaitingMessages():
                break
            stop_event.wait(0.1)
    except Exception:
        logger.exception('[NodeBeaconAgent] Windows session notification listener failed')
        raise
    finally:
        if hwnd:
            unregister(hwnd)
            win32gui.DestroyWindow(hwnd)
        if registered:
            win32gui.UnregisterClass(class_name, hinstance)


def deliver_unlock(session, config, event_id, session_id):
    origin = config.get('management_url', '').rstrip('/')
    if not origin or not config.get('device_token'):
        raise ValueError('This agent is not enrolled for unlock notifications.')
    url = origin + '/api/servers/agents/unlocked/'
    logging.getLogger(__name__).info('[NodeBeaconAgent] Sending unlock event to backend')
    response = session.post(url,
        headers={'X-Device-Token': config['device_token']},
        json={'event_id': event_id, 'session_id': session_id},
        timeout=(3, 8), allow_redirects=False)
    try:
        result = response.json()
    except ValueError:
        result = {}
    logging.getLogger(__name__).info('[NodeBeaconAgent] Backend response: %s', response.status_code)
    return response.status_code, result
