"""Comprehensive test suite for the email notifications integration."""
import hashlib
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from servers.agent_api import digest
from servers.models import Server, UnlockNotification


class EmailIntegrationTests(APITestCase):
    def setUp(self):
        self.User = get_user_model()
        self.user = self.User.objects.create_user(
            username='email-user',
            email='primary@example.test',
            password='secure-test-password',
            enable_email_notifications=False,
        )
        self.other_user = self.User.objects.create_user(
            username='other-user',
            email='other@example.test',
            password='secure-test-password',
        )
        self.client.force_authenticate(self.user)
        self.settings_url = reverse('email_settings')
        self.connect_url = reverse('email_connect')
        self.verify_url = reverse('email_verify')
        self.resend_url = reverse('email_resend')
        self.test_email_url = reverse('email_test')

    def test_settings_initial_state(self):
        response = self.client.get(self.settings_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('status', response.data)
        self.assertEqual(response.data['status'], 'not_connected')
        self.assertFalse(response.data['is_verified'])
        self.assertEqual(response.data['recipient_email'], '')

    def test_connect_rejects_invalid_email(self):
        response = self.client.post(self.connect_url, {'email': 'invalid-email-address'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('valid email', response.data['message'].lower())

    def test_connect_rejects_header_injection(self):
        response = self.client.post(self.connect_url, {'email': "victim@example.com\nBcc: hacker@example.com"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('users.email_views.email_delivery_is_configured', return_value=True)
    def test_connect_sends_verification_email_and_stores_hash(self, _mock_cfg):
        response = self.client.post(self.connect_url, {'email': 'alerts@mycompany.org'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'pending_verification')
        self.assertEqual(response.data['unverified_email'], 'alerts@mycompany.org')

        self.user.refresh_from_db()
        self.assertEqual(self.user.email_unverified_recipient, 'alerts@mycompany.org')
        self.assertFalse(self.user.email_verified)
        self.assertIsNotNone(self.user.email_verification_token_hash)
        self.assertIsNotNone(self.user.email_verification_expires_at)
        self.assertGreater(self.user.email_verification_expires_at, timezone.now())

        # Check outbox in locmem
        self.assertGreaterEqual(len(mail.outbox), 1)
        sent = mail.outbox[-1]
        self.assertIn('alerts@mycompany.org', sent.to)
        self.assertIn('Verify your email address', sent.subject)

    @patch('users.email_views.email_delivery_is_configured', return_value=True)
    def test_resend_rate_limiting_enforces_cooldown(self, _mock_cfg):
        self.client.post(self.connect_url, {'email': 'alerts@mycompany.org'}, format='json')
        
        # Second immediate request must return 429 Too Many Requests
        response = self.client.post(self.resend_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('wait', response.data['message'].lower())
        self.assertGreater(response.data['cooldown'], 0)

    @patch('users.email_views.email_delivery_is_configured', return_value=True)
    def test_verify_with_correct_code_activates_notifications(self, _mock_cfg):
        # Setup pending verification
        raw_code = '482910'
        token_hash = hashlib.sha256(f"{self.user.pk}:{raw_code}".encode()).hexdigest()
        self.user.email_unverified_recipient = 'verified@example.test'
        self.user.email_verification_token_hash = token_hash
        self.user.email_verification_expires_at = timezone.now() + timedelta(minutes=15)
        self.user.email_verified = False
        self.user.save()

        # Submit incorrect code
        bad_res = self.client.post(self.verify_url, {'code': '000000'}, format='json')
        self.assertEqual(bad_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('invalid', bad_res.data['message'].lower())

        # Submit correct code
        good_res = self.client.post(self.verify_url, {'code': raw_code}, format='json')
        self.assertEqual(good_res.status_code, status.HTTP_200_OK)
        self.assertTrue(good_res.data['success'])
        self.assertEqual(good_res.data['status'], 'connected')

        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)
        self.assertEqual(self.user.recipient_email, 'verified@example.test')
        self.assertIsNone(self.user.email_unverified_recipient)
        self.assertIsNone(self.user.email_verification_token_hash)
        self.assertTrue(self.user.enable_email_notifications)

    def test_verify_rejects_expired_code(self):
        raw_code = '123456'
        token_hash = hashlib.sha256(f"{self.user.pk}:{raw_code}".encode()).hexdigest()
        self.user.email_unverified_recipient = 'expired@example.test'
        self.user.email_verification_token_hash = token_hash
        self.user.email_verification_expires_at = timezone.now() - timedelta(minutes=1)
        self.user.save()

        response = self.client.post(self.verify_url, {'code': raw_code}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired', response.data['message'].lower())

    def test_link_verification_endpoint(self):
        raw_token = 'secret-link-token-xyz-123'
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        self.user.email_unverified_recipient = 'link-verified@example.test'
        self.user.email_verification_link_hash = token_hash
        self.user.email_verification_expires_at = timezone.now() + timedelta(minutes=15)
        self.user.save()

        link_url = reverse('email_verify_link') + f"?token={raw_token}"
        # Unauthenticated request from user clicking email link
        anon_client = self.client_class()
        response = anon_client.get(link_url)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn('email_verified=true', response.url)

        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)
        self.assertEqual(self.user.recipient_email, 'link-verified@example.test')

    def test_preferences_patch_updates_settings(self):
        self.user.email_verified = True
        self.user.recipient_email = 'user@example.test'
        self.user.save()

        payload = {
            'notify_offline_email': False,
            'notify_critical_email': True,
            'notify_on_laptop_unlock': True,
        }
        response = self.client.patch(self.settings_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['notify_offline_email'])
        self.assertTrue(response.data['notify_critical_email'])
        self.assertTrue(response.data['notify_on_laptop_unlock'])

        self.user.refresh_from_db()
        self.assertFalse(self.user.notify_offline_email)
        self.assertTrue(self.user.notify_critical_email)
        self.assertTrue(self.user.notify_on_laptop_unlock)

    def test_disconnect_clears_recipient_and_disables_notifications(self):
        self.user.recipient_email = 'to-disconnect@example.test'
        self.user.email_verified = True
        self.user.enable_email_notifications = True
        self.user.notify_on_laptop_unlock = True
        self.user.save()

        response = self.client.patch(self.settings_url, {'disconnect': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'not_connected')
        self.assertEqual(response.data['recipient_email'], '')

        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)
        self.assertIsNone(self.user.recipient_email)
        self.assertFalse(self.user.enable_email_notifications)
        self.assertFalse(self.user.notify_on_laptop_unlock)

    @patch('users.email_views.email_delivery_is_configured', return_value=True)
    def test_test_email_sends_to_verified_recipient(self, _mock_cfg):
        self.user.recipient_email = 'alerts@valid.test'
        self.user.email_verified = True
        self.user.save()

        response = self.client.post(self.test_email_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['recipient'], 'alerts@valid.test')

        self.assertGreaterEqual(len(mail.outbox), 1)
        sent = mail.outbox[-1]
        self.assertIn('Test Notification', sent.subject)
        self.assertIn('alerts@valid.test', sent.to)

    def test_user_cannot_access_other_users_email_settings(self):
        # Force authentication as other_user
        self.client.force_authenticate(self.other_user)
        response = self.client.get(self.settings_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return other_user's settings, not self.user's
        self.assertEqual(response.data['recipient_email'], '')


class UnlockAlertsEmailIntegrationTests(APITestCase):
    def setUp(self):
        users = get_user_model()
        self.owner = users.objects.create_user(
            username='unlock-multi-owner',
            email='owner@example.test',
            password='test-only-password',
            recipient_email='owner-alerts@example.test',
            email_verified=True,
            enable_email_notifications=True,
            notify_on_laptop_unlock=True,
            notify_on_laptop_unlock_telegram=True,
            telegram_chat_id='998877',
        )
        self.server = Server.objects.create(
            owner=self.owner,
            name='Office Laptop',
            hostname='laptop-01',
            operating_system='Windows 11',
            ip_address='192.168.1.50',
        )
        self.device_token = 'device-token-unlock-123'
        self.server.device_token_hash = digest(self.device_token)
        self.server.save(update_fields=['device_token_hash'])
        self.client.credentials(HTTP_X_DEVICE_TOKEN=self.device_token)
        self.url = reverse('agent-laptop-unlocked')
        import uuid
        self.event = {'event_id': str(uuid.uuid4()), 'session_id': 2}

    @override_settings(TELEGRAM_BOT_TOKEN='test-token')
    @patch('users.telegram_service.send_telegram_message')
    @patch('users.unlock_views.deliver_laptop_unlock_email')
    def test_sends_both_telegram_and_email_when_both_enabled(self, deliver_email, send_telegram):
        response = self.client.post(self.url, self.event, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'sent')
        self.assertIn('Telegram and email', response.data['detail'])

        send_telegram.assert_called_once()
        deliver_email.assert_called_once_with(self.owner, self.server)
        self.assertEqual(UnlockNotification.objects.get().delivery_status, 'Sent')

    @override_settings(TELEGRAM_BOT_TOKEN='test-token')
    @patch('users.telegram_service.send_telegram_message')
    @patch('users.unlock_views.deliver_laptop_unlock_email')
    def test_sends_email_only_when_telegram_disabled(self, deliver_email, send_telegram):
        self.owner.notify_on_laptop_unlock_telegram = False
        self.owner.save(update_fields=['notify_on_laptop_unlock_telegram'])

        response = self.client.post(self.url, self.event, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'sent')
        self.assertIn('email', response.data['detail'])

        send_telegram.assert_not_called()
        deliver_email.assert_called_once()

    @patch('users.unlock_views.deliver_laptop_unlock_email')
    def test_does_not_send_email_when_unverified(self, deliver_email):
        self.owner.email_verified = False
        self.owner.email_unverified_recipient = 'pending@example.test'
        self.owner.notify_on_laptop_unlock_telegram = False
        self.owner.save(update_fields=['email_verified', 'email_unverified_recipient', 'notify_on_laptop_unlock_telegram'])

        response = self.client.post(self.url, self.event, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'disabled')
        deliver_email.assert_not_called()
