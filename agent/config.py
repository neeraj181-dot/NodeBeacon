"""Atomic local configuration, with Windows DPAPI protected credentials."""
import base64
import json
import os
from pathlib import Path
import sys
import tempfile

VERSION = '2.0.0'

def data_dir():
    if getattr(sys, 'frozen', False):
        return Path(os.environ.get('PROGRAMDATA', r'C:\ProgramData')) / 'NodeBeacon'
    return Path(__file__).resolve().parent

def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=path.name, suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as handle:
            json.dump(value, handle, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

def save_config(config):
    import win32crypt
    stored = dict(config)
    for field in ('device_token', 'api_key'):
        token = stored.pop(field, None)
        if token:
            # Machine scope allows the administrator UI and service to share credentials.
            # Installer restricts the directory to SYSTEM/Administrators.
            protected = win32crypt.CryptProtectData(token.encode(), None, None, None, None, 4)
            stored[field + '_protected'] = base64.b64encode(protected).decode('ascii')
    atomic_json(data_dir() / 'config.json', stored)

def load_config():
    import win32crypt
    with (data_dir() / 'config.json').open(encoding='utf-8') as handle:
        config = json.load(handle)
    for field in ('device_token', 'api_key'):
        encrypted = config.pop(field + '_protected', None)
        if encrypted:
            config[field] = win32crypt.CryptUnprotectData(base64.b64decode(encrypted), None, None, None, 0)[1].decode()
    if not config.get('server_url'):
        raise ValueError('Server configuration unavailable.')
    interval = config.get('interval', 10)
    if not isinstance(interval, int) or not 5 <= interval <= 3600:
        raise ValueError('Reporting interval must be 5 to 3600 seconds.')
    return config
