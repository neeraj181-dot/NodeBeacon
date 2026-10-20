import io
import json
import uuid
import zipfile
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from servers.agent_api import ConfigSerializer, digest
from servers.models import AgentEnrollment, Server


class AgentTests(APITestCase):
    def setUp(self):
        users = get_user_model()
        self.owner = users.objects.create_user(username='agent-owner', email='owner@example.test', password='test-only-password')
        self.other = users.objects.create_user(username='agent-other', email='other@example.test', password='test-only-password')
        self.server = Server.objects.create(owner=self.owner, name='Test PC', hostname='test-pc', operating_system='Windows', ip_address='127.0.0.1', device_id=uuid.uuid4(), agent_server_url='https://api.example.test')
        self.token = 'test-enrollment-token-1234567890'
        AgentEnrollment.objects.create(server=self.server, token_hash=digest(self.token), expires_at=timezone.now() + timedelta(minutes=30))

    def register(self):
        response = self.client.post(reverse('agent-register'), {'token': self.token}, format='json')
        self.assertEqual(response.status_code, 201)
        return response.data['device_token']

    def test_register_hash_and_replay(self):
        token = self.register()
        self.server.refresh_from_db()
        self.assertEqual(self.server.device_token_hash, digest(token))
        self.assertNotEqual(self.server.device_token_hash, token)
        self.assertEqual(self.client.post(reverse('agent-register'), {'token': self.token}, format='json').status_code, 401)

    def test_expiry(self):
        AgentEnrollment.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.post(reverse('agent-register'), {'token': self.token}, format='json').status_code, 401)

    def test_reset_revokes_old_token_without_deleting_metrics(self):
        token = self.register()
        old_key = self.server.api_key
        url = reverse('agent-reset', args=[self.server.pk])
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.post(url, {'confirm': True}, format='json').status_code, 404)
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'confirm': True}, format='json').status_code, 200)
        self.server.refresh_from_db()
        self.assertEqual(self.server.device_token_hash, '')
        self.assertNotEqual(self.server.api_key, old_key)
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_X_DEVICE_TOKEN=token)
        self.assertEqual(self.client.get(reverse('agent-config')).status_code, 401)

    def test_owner_config_and_version(self):
        url = reverse('agent-manage-config', args=[self.server.pk])
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, {'server_url': 'https://other.example.test'}, format='json').status_code, 404)
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(url, {'server_url': '192.168.1.50', 'server_port': 8000}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['config_version'], 2)
        self.assertEqual(response.data['metrics_url'], 'http://192.168.1.50:8000/api/metrics/')

    def test_config_validation(self):
        for host in ('https://user:password@example.test', 'https://host/path', 'ftp://host', 'https://host?command=test', 'https://bad..host'):
            self.assertFalse(ConfigSerializer(data={'server_url': host}).is_valid(), host)
        for port in (0, -1, 65536, 'text'):
            self.assertFalse(ConfigSerializer(data={'server_url': 'https://example.test', 'server_port': port}).is_valid())
        valid = ConfigSerializer(data={'server_url': 'https://[::1]:8443'})
        self.assertTrue(valid.is_valid())
        self.assertEqual(valid.validated_data['server_port'], 8443)

    def test_shared_fleet_hides_device_settings_and_cannot_mutate(self):
        from users.models import Organization
        org = Organization.objects.create(owner=self.owner, organization_name='Test organization', alert_email='test@example.test')
        self.server.organization = org
        self.server.save(update_fields=['organization'])
        self.other.organization = org
        self.other.role = 'MEMBER'
        self.other.save(update_fields=['organization', 'role'])
        self.client.force_authenticate(user=self.other)
        url = reverse('server-detail', args=[self.server.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('api_key', response.data)
        self.assertNotIn('device_id', response.data)
        self.assertEqual(self.client.patch(url, {'name': 'Unauthorized'}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)

    def test_profile_cannot_escalate_role_or_organization(self):
        from users.serializers import UserSerializer
        serializer = UserSerializer(instance=self.other, data={'role': 'ORGANIZATION_ADMIN', 'member_role': 'ADMINISTRATOR', 'organization': 1}, partial=True)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data, {})

    def test_device_config_heartbeat_and_metrics(self):
        token = self.register()
        self.client.credentials(HTTP_X_DEVICE_TOKEN=token)
        response = self.client.get(reverse('agent-config'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['device_id'], str(self.server.device_id))
        response = self.client.post(reverse('agent-heartbeat'), {'status': 'Connected', 'version': '2.0.0'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.server.refresh_from_db()
        self.assertIsNotNone(self.server.agent_last_seen)
        self.assertEqual(self.server.agent_status, 'Connected')
        response = self.client.post(reverse('metrics_list_create'), {'cpu_usage': 10, 'memory_usage': 20, 'disk_usage': 30, 'network_in': 1, 'network_out': 2, 'uptime': 100}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.server.metrics.count(), 1)
        self.client.credentials(HTTP_X_DEVICE_TOKEN='invalid')
        self.assertEqual(self.client.get(reverse('agent-config')).status_code, 401)

    def test_download_owner_and_invalidation(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / 'agent' / 'dist' / 'NodeBeaconAgent'
            package.mkdir(parents=True)
            (package / 'NodeBeaconAgent.exe').write_bytes(b'MZ-test-fixture')
            (root / 'backend').mkdir()
            with override_settings(BASE_DIR=root / 'backend', AGENT_PUBLIC_URL='https://api.example.test'):
                url = reverse('agent-download', args=[self.server.pk])
                self.client.force_authenticate(user=self.other)
                self.assertEqual(self.client.post(url).status_code, 404)
                self.client.force_authenticate(user=self.owner)
                response = self.client.post(url)
                self.assertEqual(response.status_code, 200)
                content = b''.join(response.streaming_content)
                with zipfile.ZipFile(io.BytesIO(content)) as archive:
                    data = json.loads(archive.read('enrollment.json'))
                    self.assertEqual(data['device_id'], str(self.server.device_id))
                    self.assertNotIn('device_token', data)
                self.assertEqual(AgentEnrollment.objects.filter(server=self.server, used_at=None).count(), 1)
                self.assertTrue(AgentEnrollment.objects.get(token_hash=digest(self.token)).used_at)
                self.client.force_authenticate(user=None)
                self.client.post(reverse('agent-register'), {'token': data['enrollment_token']}, format='json')
                self.client.force_authenticate(user=self.owner)
                self.assertEqual(self.client.post(url).status_code, 409)
