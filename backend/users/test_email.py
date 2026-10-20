from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase


class TestEmailViewTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='test-mail-user',
            email='account@example.test',
            password='test-only-password',
            recipient_email='alerts@example.test',
            enable_email_notifications=False,
        )
        self.client.force_authenticate(self.user)
        self.url = reverse('test_email')

    @patch('users.unlock_alerts.email_delivery_is_configured', return_value=True)
    @patch('django.core.mail.send_mail', return_value=1)
    def test_sends_test_message_to_users_configured_recipient(self, send_mail, _configured):
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['recipient'], 'alerts@example.test')
        self.assertIn('final inbox delivery cannot be confirmed', response.data['message'])
        self.assertEqual(send_mail.call_args.kwargs['recipient_list'], ['alerts@example.test'])
        self.assertEqual(send_mail.call_args.kwargs['subject'], 'NodeBeacon test email')

    @patch('users.unlock_alerts.email_delivery_is_configured', return_value=False)
    @patch('django.core.mail.send_mail', return_value=1)
    def test_unconfigured_smtp_returns_actionable_error_without_sending(self, send_mail, _configured):
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertIn('SMTP is not configured', response.data['message'])
        send_mail.assert_not_called()

    @patch('users.unlock_alerts.email_delivery_is_configured', return_value=True)
    @patch('django.core.mail.send_mail', side_effect=OSError('SMTP unavailable'))
    def test_smtp_failure_is_not_reported_as_success(self, send_mail, _configured):
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, 502)
        self.assertFalse(response.data['success'])
        self.assertIn('Email delivery failed', response.data['message'])
        send_mail.assert_called_once()

    @patch('users.unlock_alerts.email_delivery_is_configured', return_value=True)
    @patch('django.core.mail.send_mail', return_value=1)
    def test_falls_back_to_account_email_when_recipient_is_blank(self, send_mail, _configured):
        self.user.recipient_email = ''
        self.user.save(update_fields=['recipient_email'])
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(send_mail.call_args.kwargs['recipient_list'], ['account@example.test'])
