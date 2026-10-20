"""Opt-in localhost integration test. Creates and removes only its own test user/device.

Run with the Django server at 127.0.0.1:8000. It never installs a Windows service.
"""
import io
import json
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch
import uuid
import zipfile
import os

import requests
import config
import runtime
from test_agent import StopEvent

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nodebeacon.settings')
import django
django.setup()
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken


def run():
    origin = 'http://127.0.0.1:8000'
    name = 'agent-smoke-' + uuid.uuid4().hex
    user = get_user_model().objects.create_user(username=name, email=name + '@example.test', enable_email_notifications=False)
    headers = {'Authorization': 'Bearer ' + str(AccessToken.for_user(user))}
    try:
        response = requests.post(origin + '/api/servers/', headers=headers,
            json={'name': name, 'hostname': 'smoke-pc', 'operating_system': 'Windows', 'ip_address': '127.0.0.1'}, timeout=10)
        response.raise_for_status()
        server_id = response.json()['id']
        prefix = origin + f'/api/servers/{server_id}/'
        response = requests.post(prefix + 'agent-download/', headers=headers, json={}, timeout=120)
        response.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            bootstrap = json.loads(archive.read('enrollment.json'))
            assert 'NodeBeaconAgent.exe' in archive.namelist()
            assert any(name.startswith('_internal/') for name in archive.namelist())
        print('PASS: authenticated download contains EXE, dependencies and device enrollment')
        response = requests.post(bootstrap['management_url'] + '/api/servers/agents/register/', json={'token': bootstrap['enrollment_token']}, timeout=10)
        response.raise_for_status()
        initial = {**response.json(), 'enabled': True, 'management_url': bootstrap['management_url']}
        assert response.status_code == 201
        print('PASS: live one-use enrollment')
        with tempfile.TemporaryDirectory() as directory, patch.object(config, 'data_dir', return_value=Path(directory)), patch.object(runtime, 'data_dir', return_value=Path(directory)):
            config.save_config(initial)
            runtime.run_agent(StopEvent(1))  # actual collector + HTTP, no wait after one iteration
            server = user.servers.get(pk=server_id)
            assert server.metrics.count() == 1
            assert server.agent_status == 'Stopped' and server.agent_last_seen
            print('PASS: actual PC metrics, heartbeat and final stopped status')
            saved = config.load_config()
            saved['enabled'] = False
            config.save_config(saved)
            runtime.run_agent(StopEvent(1))
            assert server.metrics.count() == 1
            saved['enabled'] = True
            config.save_config(saved)
            runtime.run_agent(StopEvent(1))
            assert server.metrics.count() == 2
            print('PASS: persisted Stop prevents submissions; Start resumes')
            response = requests.patch(prefix + 'agent-config/', headers=headers,
                json={'server_url': origin, 'server_port': 1}, timeout=10)
            response.raise_for_status()
            runtime.run_agent(StopEvent(1))
            assert config.load_config()['server_port'] == 1
            assert server.metrics.count() == 2
            response = requests.patch(prefix + 'agent-config/', headers=headers,
                json={'server_url': '127.0.0.1', 'server_port': 8000}, timeout=10)
            response.raise_for_status()
            runtime.run_agent(StopEvent(1))
            assert config.load_config()['server_port'] == 8000
            assert server.metrics.count() == 3
            assert config.load_config()['config_version'] == response.json()['config_version']
            assert json.loads((Path(directory) / 'status.json').read_text())['last_success']
            print('PASS: live remote port update, unavailable endpoint, persistent config and reconnection')
        assert requests.get('http://127.0.0.1:5173/', timeout=10).status_code == 200
        print('PASS: frontend serves successfully')
    finally:
        get_user_model().objects.filter(pk=user.pk, username=name).delete()
        print('Temporary test account/device/metrics removed; existing user data unchanged.')


if __name__ == '__main__':
    run()
