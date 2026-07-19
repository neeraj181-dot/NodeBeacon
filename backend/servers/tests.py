from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from servers.models import Server

User = get_user_model()

class ServerTests(APITestCase):

    def setUp(self):
        # Create users
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@nodebeacon.net',
            password='password123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@nodebeacon.net',
            password='password123'
        )

        # URLs
        self.list_create_url = reverse('server-list')
        
        # Test Server data
        self.server_data = {
            'name': 'Staging Main Server',
            'hostname': 'staging-01',
            'operating_system': 'Linux (CentOS 9)',
            'ip_address': '192.168.1.50'
        }

    def test_create_server_authenticated(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.list_create_url, self.server_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], self.server_data['name'])
        self.assertEqual(response.data['status'], 'Offline') # default status check
        self.assertIn('api_key', response.data)
        self.assertTrue(len(response.data['api_key']) > 30)

        # Check in DB
        server = Server.objects.get(id=response.data['id'])
        self.assertEqual(server.owner, self.user1)

    def test_create_server_unauthenticated(self):
        response = self.client.post(self.list_create_url, self.server_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_servers_filtered(self):
        # Create servers for both users
        server_u1 = Server.objects.create(owner=self.user1, api_key='key_u1', **self.server_data)
        server_u2 = Server.objects.create(owner=self.user2, api_key='key_u2', **self.server_data)

        # Authenticate as user 1
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.list_create_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], server_u1.id)

    def test_access_other_user_server(self):
        # Create server for user 2
        server_u2 = Server.objects.create(owner=self.user2, api_key='key_u2', **self.server_data)

        # Authenticate as user 1 and try to retrieve user 2's server
        self.client.force_authenticate(user=self.user1)
        detail_url = reverse('server-detail', args=[server_u2.id])
        response = self.client.get(detail_url, format='json')
        
        # Should return 404 because queryset is filtered to owner=request.user
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_server_success(self):
        server = Server.objects.create(owner=self.user1, api_key='key_original', **self.server_data)
        self.client.force_authenticate(user=self.user1)
        detail_url = reverse('server-detail', args=[server.id])

        update_data = {
            'name': 'Updated Server Name',
            'hostname': 'updated-host',
            'operating_system': 'Linux (Ubuntu 22.04)',
            'ip_address': '10.0.0.1'
        }
        response = self.client.put(detail_url, update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], update_data['name'])
        
        # Verify read-only fields were not modified
        self.assertEqual(response.data['api_key'], server.api_key)

    def test_delete_server_success(self):
        server = Server.objects.create(owner=self.user1, api_key='key_to_delete', **self.server_data)
        self.client.force_authenticate(user=self.user1)
        detail_url = reverse('server-detail', args=[server.id])

        response = self.client.delete(detail_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Server.objects.filter(id=server.id).exists())

