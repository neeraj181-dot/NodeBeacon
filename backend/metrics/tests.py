from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from servers.models import Server
from metrics.models import Metric

User = get_user_model()

class MetricTests(APITestCase):

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
            name='Prod Server 1',
            hostname='prod-01',
            operating_system='Ubuntu 22.04',
            ip_address='192.168.1.10',
            status='Offline'
        )
        self.server2 = Server.objects.create(
            owner=self.user2,
            name='Prod Server 2',
            hostname='prod-02',
            operating_system='Ubuntu 22.04',
            ip_address='192.168.1.11',
            status='Offline'
        )

        # URLs
        self.metrics_url = reverse('metrics_list_create')
        self.server1_metrics_url = reverse('server_metrics_list', args=[self.server1.id])
        self.server2_metrics_url = reverse('server_metrics_list', args=[self.server2.id])

        # Sample metrics body
        self.valid_payload = {
            'cpu_usage': 45.5,
            'memory_usage': 68.2,
            'disk_usage': 38.1,
            'network_in': 5000,
            'network_out': 6000,
            'uptime': 3600
        }

    def test_agent_submit_metrics_success(self):
        # Set API Key header
        self.client.credentials(HTTP_X_API_KEY=self.server1.api_key)
        response = self.client.post(self.metrics_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['message'], 'Metric stored successfully.')

        # Verify Server status is set to Online and last_seen is updated
        self.server1.refresh_from_db()
        self.assertEqual(self.server1.status, 'Online')
        self.assertIsNotNone(self.server1.last_seen)

        # Verify Metric was stored
        self.assertEqual(Metric.objects.filter(server=self.server1).count(), 1)

    def test_agent_submit_metrics_invalid_api_key(self):
        self.client.credentials(HTTP_X_API_KEY='invalidkey123')
        response = self.client.post(self.metrics_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_agent_submit_metrics_missing_api_key(self):
        # No credentials header
        response = self.client.post(self.metrics_url, self.valid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_agent_submit_metrics_invalid_data(self):
        self.client.credentials(HTTP_X_API_KEY=self.server1.api_key)
        
        # Out-of-bounds CPU usage
        invalid_payload = self.valid_payload.copy()
        invalid_payload['cpu_usage'] = 150.0
        response = self.client.post(self.metrics_url, invalid_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cpu_usage', response.data)

        # Negative uptime
        invalid_payload2 = self.valid_payload.copy()
        invalid_payload2['uptime'] = -100
        response = self.client.post(self.metrics_url, invalid_payload2, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('uptime', response.data)

    def test_get_metrics_authenticated_jwt(self):
        # Populate database with some metrics
        Metric.objects.create(server=self.server1, cpu_usage=10.0, memory_usage=20.0, disk_usage=30.0, network_in=100, network_out=200, uptime=500)
        Metric.objects.create(server=self.server2, cpu_usage=15.0, memory_usage=25.0, disk_usage=35.0, network_in=150, network_out=250, uptime=600)

        # Authenticate user1 (JWT)
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.metrics_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return ONLY user1's server metrics
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['cpu_usage'], 10.0)

    def test_get_server_metrics_success_with_limit(self):
        # Create multiple metrics for server 1
        for i in range(15):
            Metric.objects.create(
                server=self.server1,
                cpu_usage=float(i),
                memory_usage=50.0,
                disk_usage=50.0,
                network_in=1000,
                network_out=1000,
                uptime=i * 10
            )

        self.client.force_authenticate(user=self.user1)
        
        # Test default listing returns all 15
        response = self.client.get(self.server1_metrics_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 15)

        # Test limit query param restricts to 5
        response = self.client.get(f"{self.server1_metrics_url}?limit=5", format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)
        # Verify ordering is newest first (i.e. cpu_usage=14.0 for newest, 13.0, 12.0 etc.)
        self.assertEqual(response.data[0]['cpu_usage'], 14.0)

    def test_get_other_user_server_metrics_denied(self):
        # Populate server 2 (owned by user2)
        Metric.objects.create(server=self.server2, cpu_usage=15.0, memory_usage=25.0, disk_usage=35.0, network_in=150, network_out=250, uptime=600)

        # Authenticate user1 and try to retrieve server 2's metrics
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.server2_metrics_url, format='json')
        # Should return 404 because server 2 does not belong to user 1
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
