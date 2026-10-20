import logging
import queue
from datetime import datetime, timezone
from urllib.parse import urlsplit

import requests
from collector import collect_all
from config import VERSION, atomic_json, data_dir, load_config, save_config
from unlock import deliver_unlock

logger = logging.getLogger(__name__)
RETRY_DELAYS = (5, 10, 30, 60)


def validate_url(url):
    parsed = urlsplit(url)
    if parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Invalid server address.')
    if parsed.port is not None and not 1 <= parsed.port <= 65535:
        raise ValueError('Invalid server port.')
    return url


def publish_status(state, config, last_success=None, error=''):
    atomic_json(data_dir() / 'status.json', {
        'status': state, 'server_url': config.get('server_url'),
        'server_port': config.get('server_port'), 'device_id': config.get('device_id'),
        'device_name': config.get('device_name'), 'version': VERSION,
        'last_success': last_success, 'error': error,
    })


def control_url(config, endpoint):
    return validate_url(config['management_url'].rstrip('/') + '/api/servers/agents/' + endpoint + '/')


def heartbeat(session, config, state):
    if config.get('management_url') and config.get('device_token'):
        response = session.post(control_url(config, 'heartbeat'),
            headers={'X-Device-Token': config['device_token']},
            json={'status': state, 'version': VERSION}, timeout=(3, 5), allow_redirects=False)
        response.raise_for_status()


def publish_unlock_status(state, detail):
    atomic_json(data_dir() / 'unlock-status.json', {
        'status': state, 'detail': detail,
        'updated_at': datetime.now(timezone.utc).isoformat(),
    })


def run_unlock_notifications(pending, stop_event):
    """Send actual Windows unlock events, reusing the event UUID across retries."""
    session = requests.Session()
    retry_delays = (5, 10, 30, 60)
    try:
        while not stop_event.is_set():
            try:
                event_id, session_id = pending.get(timeout=0.5)
            except queue.Empty:
                continue
            if stop_event.is_set():
                return
            try:
                config = load_config()
            except (OSError, ValueError, KeyError):
                publish_unlock_status('Delivery error', 'Agent configuration is unavailable.')
                continue
            if not config.get('enabled', True):
                publish_unlock_status('Disabled', 'Start the agent to enable unlock alerts.')
                continue
            publish_unlock_status('Sending', 'Sending the unlock notification to your connected channel…')
            for attempt in range(len(retry_delays) + 1):
                if stop_event.is_set():
                    return
                try:
                    code, payload = deliver_unlock(session, config, event_id, session_id)
                    detail = payload.get('detail', '')
                    if 200 <= code < 300:
                        state = {'sent': 'Notification sent', 'disabled': 'Disabled', 'sending': 'Sending'}.get(payload.get('status'), 'Notification sent')
                        publish_unlock_status(state, detail or state)
                        if code == 202 and attempt < len(retry_delays):
                            if not stop_event.wait(retry_delays[attempt]):
                                continue
                        break
                    if code < 500 or attempt >= len(retry_delays):
                        publish_unlock_status('Delivery error', detail or ('Device authorization failed.' if code == 401 else 'Unlock notification could not be delivered.'))
                        break
                    publish_unlock_status('Delivery error', detail or 'The backend is temporarily unavailable; retrying.')
                except requests.RequestException:
                    if attempt >= len(retry_delays):
                        publish_unlock_status('Delivery error', 'Cannot reach the backend to send the unlock alert.')
                        break
                    publish_unlock_status('Delivery error', 'Cannot reach the backend; retrying.')
                if stop_event.wait(retry_delays[attempt]):
                    break
    finally:
        session.close()


def synchronize(session, config):
    if not config.get('management_url') or not config.get('device_token'):
        return config
    response = session.get(control_url(config, 'config'),
        headers={'X-Device-Token': config['device_token']}, timeout=(3, 5), allow_redirects=False)
    response.raise_for_status()
    remote = response.json()
    if str(remote.get('device_id')) != str(config.get('device_id')):
        raise ValueError('Device identity mismatch.')
    if remote.get('config_version', 0) > config.get('config_version', 0) or remote.get('device_name') != config.get('device_name'):
        validate_url(remote['metrics_url'])
        for field in ('server_url', 'server_port', 'device_name', 'metrics_url', 'config_version', 'interval'):
            config[field] = remote[field]
        save_config(config)
    return config


def run_agent(stop_event):
    config = load_config()
    last_success = None
    failures = 0
    session = requests.Session()
    if not config.get('enabled', True):
        publish_status('Stopped', config)
        session.close()
        return
    try:
        while not stop_event.is_set():
            config = load_config()
            if not config.get('enabled', True):
                break
            sync_error = None
            try:
                config = synchronize(session, config)
            except (requests.RequestException, ValueError, KeyError) as exc:
                sync_error = exc
            if stop_event.is_set():
                break
            response = None
            try:
                payload = collect_all()
                if stop_event.is_set():
                    break
                url = config.get('metrics_url') or config['server_url']
                if not url.rstrip('/').endswith('/api/metrics'):
                    url = url.rstrip('/') + '/api/metrics/'
                validate_url(url)
                token = config.get('device_token') or config.get('api_key')
                headers = {'X-Device-Token' if config.get('device_token') else 'X-API-Key': token}
                response = session.post(url, headers=headers, json=payload, timeout=(3, 5), allow_redirects=False)
                response.raise_for_status()
                if response.status_code != 201:
                    raise ValueError('Server did not acknowledge metrics.')
                last_success = datetime.now(timezone.utc).isoformat()
                publish_status('Connected', config, last_success,
                    'Management configuration temporarily unavailable.' if sync_error else '')
                try:
                    heartbeat(session, config, 'Connected')
                except requests.RequestException:
                    pass
                failures = 0
                delay = config.get('interval', 10)
            except (requests.RequestException, ValueError, KeyError, TypeError):
                code = getattr(response, 'status_code', None)
                error = 'Authentication failed.' if code in (401, 403) else 'Cannot connect to server; retrying.'
                publish_status('Reconnecting', config, last_success, error)
                logger.warning(error)
                try:
                    heartbeat(session, config, 'Reconnecting')
                except requests.RequestException:
                    pass
                delay = RETRY_DELAYS[min(failures, len(RETRY_DELAYS) - 1)]
                failures += 1
            stop_event.wait(delay)
    finally:
        try:
            heartbeat(session, config, 'Stopped')
        except requests.RequestException:
            pass
        session.close()
        publish_status('Stopped', config, last_success)
