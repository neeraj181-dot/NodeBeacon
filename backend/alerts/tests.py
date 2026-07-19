from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from servers.models import Server
from metrics.models import Metric
from alerts.models import Alert

User = get_user_model()

class AlertTests(APITestCase):

    def setUp(self):
        # Create users
        self.user1 = User.objects.create_user(
            username='user1', email='user1@nodebeacon.net', password='password123'
        )
        self.user2 = User.objects.create_user(
            username='user2', email='user2@nodebeacon.net', password='password123'
        )

        # Create servers
        self.server1 = Server.objects.create(
            owner=self.user1,
            name='Server 1',
            hostname='srv-01',
            operating_system='Linux',
            ip_address='192.168.1.10',
            status='Online',
            last_seen=timezone.now()
        )
        self.server2 = Server.objects.create(
            owner=self.user2,
            name='Server 2',
            hostname='srv-02',
            operating_system='Linux',
            ip_address='192.168.1.11',
            status='Online',
            last_seen=timezone.now()
        )

        self.alerts_list_url = reverse('alert-list')
        self.metrics_url = reverse('metrics_list_create')

        # Baseline metrics payload
        self.base_metrics = {
            'cpu_usage': 10.0,
            'memory_usage': 15.0,
            'disk_usage': 20.0,
            'network_in': 500,
            'network_out': 500,
            'uptime': 3600
        }

    def test_cpu_alert_trigger_and_resolve(self):
        # 1. Post metric with CPU > 90% (triggers alert)
        self.client.credentials(HTTP_X_API_KEY=self.server1.api_key)
        high_cpu_payload = self.base_metrics.copy()
        high_cpu_payload['cpu_usage'] = 95.0
        
        response = self.client.post(self.metrics_url, high_cpu_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify Alert exists
        alert = Alert.objects.filter(server=self.server1, title="High CPU Usage").first()
        self.assertIsNotNone(alert)
        self.assertEqual(alert.status, 'Active')
        self.assertEqual(alert.severity, 'Critical')

        # 2. Post metric with normal CPU <= 90% (resolves alert)
        normal_cpu_payload = self.base_metrics.copy()
        normal_cpu_payload['cpu_usage'] = 50.0
        response = self.client.post(self.metrics_url, normal_cpu_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify Alert is resolved
        alert.refresh_from_db()
        self.assertEqual(alert.status, 'Resolved')
        self.assertIsNotNone(alert.resolved_at)

    def test_memory_and_disk_alerts_trigger(self):
        self.client.credentials(HTTP_X_API_KEY=self.server1.api_key)
        
        # High Memory (> 90%) and Disk (> 95%)
        trigger_payload = self.base_metrics.copy()
        trigger_payload['memory_usage'] = 92.0
        trigger_payload['disk_usage'] = 97.0

        response = self.client.post(self.metrics_url, trigger_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Check memory alert
        mem_alert = Alert.objects.filter(server=self.server1, title="High Memory Usage").first()
        self.assertIsNotNone(mem_alert)
        self.assertEqual(mem_alert.status, 'Active')

        # Check disk alert
        disk_alert = Alert.objects.filter(server=self.server1, title="High Disk Usage").first()
        self.assertIsNotNone(disk_alert)
        self.assertEqual(disk_alert.status, 'Active')

    def test_server_offline_detection_and_auto_resolve(self):
        # 1. Mock server last_seen as older than 60s
        self.server1.last_seen = timezone.now() - timezone.timedelta(seconds=75)
        self.server1.status = 'Online'
        self.server1.save()

        # Query alerts (which triggers offline scan in get_queryset)
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.alerts_list_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify server is now Offline and "Server Offline" alert triggered
        self.server1.refresh_from_db()
        self.assertEqual(self.server1.status, 'Offline')
        
        offline_alert = Alert.objects.filter(server=self.server1, title="Server Offline").first()
        self.assertIsNotNone(offline_alert)
        self.assertEqual(offline_alert.status, 'Active')

        # 2. Agent reports new metrics (back online)
        self.client.force_authenticate(user=None)  # Clear force_authenticate
        self.client.credentials(HTTP_X_API_KEY=self.server1.api_key)
        response = self.client.post(self.metrics_url, self.base_metrics, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


        # Verify status set back to Online and offline alert resolved
        self.server1.refresh_from_db()
        self.assertEqual(self.server1.status, 'Online')
        
        offline_alert.refresh_from_db()
        self.assertEqual(offline_alert.status, 'Resolved')
        self.assertIsNotNone(offline_alert.resolved_at)

    def test_manual_resolve_alert(self):
        # Create active alert
        alert = Alert.objects.create(
            server=self.server1,
            title='Manual Check Alert',
            description='Test Alert',
            severity='Warning',
            status='Active'
        )

        self.client.force_authenticate(user=self.user1)
        resolve_url = reverse('alert-resolve', args=[alert.id])

        # PATCH /resolve
        response = self.client.patch(resolve_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        alert.refresh_from_db()
        self.assertEqual(alert.status, 'Resolved')
        self.assertIsNotNone(alert.resolved_at)

    def test_alerts_isolation(self):
        # Create alert for user 2
        alert_u2 = Alert.objects.create(
            server=self.server2,
            title='User 2 Alert',
            description='Test',
            severity='Warning',
            status='Active'
        )

        # Authenticate as user 1
        self.client.force_authenticate(user=self.user1)
        
        # Try to retrieve user 2's alert detail
        detail_url = reverse('alert-detail', args=[alert_u2.id])
        response = self.client.get(detail_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Try to list alerts (should filter out user 2's alerts)
        response = self.client.get(self.alerts_list_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
