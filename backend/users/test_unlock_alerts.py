import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from servers.agent_api import digest
from servers.models import Server, UnlockNotification
from users.serializers import UserSerializer


class LaptopUnlockNotificationTests(APITestCase):
    def setUp(self):
        users = get_user_model()
        self.owner = users.objects.create_user(username='unlock-owner', email='owner@example.test', password='test-only-password')
        self.other = users.objects.create_user(username='unlock-other', email='other@example.test', password='test-only-password')
        self.server = Server.objects.create(owner=self.owner, name='Laptop', hostname='laptop', operating_system='Windows', ip_address='127.0.0.1')
        self.device_token = 'test-device-token-for-unlock-alerts'
        self.server.device_token_hash = digest(self.device_token)
        self.server.save(update_fields=['device_token_hash'])
        self.url = reverse('agent-laptop-unlocked')
        self.event = {'event_id': str(uuid.uuid4()), 'session_id': 3}

    def set_device(self, token=None):
        self.client.credentials(HTTP_X_DEVICE_TOKEN=token or self.device_token)

    @patch('users.unlock_views.email_delivery_is_configured', return_value=True)
    @patch('users.unlock_views.deliver_laptop_unlock_email')
    def test_disabled_account_does_not_send(self, deliver, _ready):
        self.set_device()
        response = self.client.post(self.url, self.event, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'disabled')
        deliver.assert_not_called()
        self.assertEqual(UnlockNotification.objects.get().delivery_status, 'Disabled')

    @patch('users.unlock_views.email_delivery_is_configured', return_value=True)
    @patch('users.unlock_views.deliver_laptop_unlock_email')
    def test_owner_email_sends_once_for_repeated_event(self, deliver, _ready):
        self.owner.notify_on_laptop_unlock = True
        self.owner.recipient_email = 'phone-inbox@example.test'
        self.owner.save(update_fields=['notify_on_laptop_unlock', 'recipient_email'])
        self.set_device()
        first = self.client.post(self.url, self.event, format='json')
        repeated = self.client.post(self.url, self.event, format='json')
        self.assertEqual(first.data['status'], 'sent')
        self.assertEqual(repeated.data['status'], 'sent')
        self.assertEqual(UnlockNotification.objects.count(), 1)
        deliver.assert_called_once()
        args = deliver.call_args.args
        self.assertEqual(args[0].pk, self.owner.pk)
        self.assertEqual(args[1].pk, self.server.pk)

    @patch('users.unlock_views.email_delivery_is_configured', return_value=True)
    @patch('users.unlock_views.deliver_laptop_unlock_email')
    def test_delivery_error_visible_and_same_event_can_retry(self, deliver, _ready):
        self.owner.notify_on_laptop_unlock = True
        self.owner.save(update_fields=['notify_on_laptop_unlock'])
        deliver.side_effect = [OSError('mail unavailable'), None]
        self.set_device()
        failed = self.client.post(self.url, self.event, format='json')
        retried = self.client.post(self.url, self.event, format='json')
        self.assertEqual(failed.status_code, 503)
        self.assertEqual(failed.data['status'], 'failed')
        self.assertIn('SMTP', failed.data['detail'])
        self.assertEqual(retried.data['status'], 'sent')
        self.assertEqual(UnlockNotification.objects.get().delivery_status, 'Sent')
        self.assertEqual(deliver.call_count, 2)

    @patch('users.unlock_views.email_delivery_is_configured', return_value=False)
    @patch('users.unlock_views.deliver_laptop_unlock_email')
    def test_missing_smtp_is_a_visible_error_without_real_email(self, deliver, _ready):
        self.owner.notify_on_laptop_unlock = True
        self.owner.save(update_fields=['notify_on_laptop_unlock'])
        self.set_device()
        response = self.client.post(self.url, self.event, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['status'], 'failed')
        deliver.assert_not_called()

    @patch('users.unlock_views.email_delivery_is_configured', return_value=True)
    @patch('users.unlock_views.deliver_laptop_unlock_email')
    def test_invalid_event_and_non_owner_device_cannot_send(self, deliver, _ready):
        self.owner.notify_on_laptop_unlock = True
        self.owner.save(update_fields=['notify_on_laptop_unlock'])
        self.set_device()
        self.assertEqual(self.client.post(self.url, {'event_id': 'bad', 'session_id': 1}, format='json').status_code, 400)
        other_server = Server.objects.create(owner=self.other, name='Other', hostname='other', operating_system='Windows', ip_address='127.0.0.2')
        other_server.device_token_hash = digest('second-device-token')
        other_server.save(update_fields=['device_token_hash'])
        self.set_device('second-device-token')
        self.assertEqual(self.client.post(self.url, self.event, format='json').data['status'], 'disabled')
        deliver.assert_not_called()

    def test_profile_allows_owner_to_save_unlock_preference(self):
        serializer = UserSerializer(instance=self.owner, data={'notify_on_laptop_unlock': True}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        user.refresh_from_db()
        self.assertTrue(user.notify_on_laptop_unlock)

    @override_settings(TELEGRAM_BOT_TOKEN='test-bot-token')
    @patch('users.telegram_service.send_telegram_message')
    @patch('users.unlock_views.deliver_laptop_unlock_email')
    def test_unlock_event_uses_owners_verified_telegram_chat_once(self, send_email, send_telegram):
        self.owner.telegram_chat_id = '7431'
        self.owner.notify_on_laptop_unlock_telegram = True
        self.owner.enable_email_notifications = False
        self.owner.save(update_fields=['telegram_chat_id', 'notify_on_laptop_unlock_telegram', 'enable_email_notifications'])
        self.set_device()
        with self.assertLogs(level='INFO') as logs:
            first = self.client.post(self.url, self.event, format='json')
        repeated = self.client.post(self.url, self.event, format='json')
        self.assertEqual(first.data['status'], 'sent')
        self.assertIn('Telegram', first.data['detail'])
        self.assertEqual(repeated.data['status'], 'sent')
        send_telegram.assert_called_once()
        self.assertEqual(send_telegram.call_args.args[0], '7431')
        send_email.assert_not_called()
        output = '\n'.join(logs.output)
        self.assertIn('[NodeBeacon] Unlock event received', output)
        self.assertIn('[NodeBeacon] Telegram unlock alerts enabled: True', output)
        self.assertIn('[NodeBeacon] Sending Telegram unlock notification', output)
        self.assertIn('[NodeBeacon] Telegram notification sent successfully', output)
        self.assertIn('[Telegram] Notification triggered (Windows unlock event).', output)
        self.assertIn('[Telegram] Configuration loaded: YES', output)

    @override_settings(TELEGRAM_BOT_TOKEN='test-bot-token')
    @patch('users.telegram_service.send_telegram_message')
    def test_telegram_disabled_does_not_send_unlock_message(self, send_telegram):
        self.owner.telegram_chat_id = '7431'
        self.owner.notify_on_laptop_unlock_telegram = False
        self.owner.save(update_fields=['telegram_chat_id', 'notify_on_laptop_unlock_telegram'])
        self.set_device()
        with self.assertLogs(level='INFO') as logs:
            response = self.client.post(self.url, self.event, format='json')
        self.assertEqual(response.data['status'], 'disabled')
        self.assertIn('[NodeBeacon] Telegram unlock alerts enabled: False', '\n'.join(logs.output))
        send_telegram.assert_not_called()

    @override_settings(TELEGRAM_BOT_TOKEN='test-bot-token')
    @patch('users.telegram_service.send_telegram_message', side_effect=RuntimeError('private test failure'))
    def test_telegram_api_failure_is_reported_and_event_can_be_retried(self, send_telegram):
        self.owner.telegram_chat_id = '7431'
        self.owner.notify_on_laptop_unlock_telegram = True
        self.owner.save(update_fields=['telegram_chat_id', 'notify_on_laptop_unlock_telegram'])
        self.set_device()
        with self.assertLogs(level='WARNING') as logs:
            response = self.client.post(self.url, self.event, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['status'], 'failed')
        self.assertIn('RuntimeError', '\n'.join(logs.output))
        self.assertNotIn('private test failure', '\n'.join(logs.output))
        self.assertEqual(UnlockNotification.objects.get().delivery_status, 'Failed')
        send_telegram.assert_called_once()

    @override_settings(TELEGRAM_BOT_TOKEN='test-bot-token')
    def test_telegram_unlock_setting_requires_a_connected_chat_at_delivery(self):
        self.owner.notify_on_laptop_unlock_telegram = True
        self.owner.save(update_fields=['notify_on_laptop_unlock_telegram'])
        self.set_device()
        response = self.client.post(self.url, self.event, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['status'], 'failed')
