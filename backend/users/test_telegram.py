from urllib.parse import parse_qs, urlparse
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from users.models import TelegramPairing
from users.telegram_service import TelegramServiceError, bot_information


class TelegramPairingTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='telegram-user', email='telegram@example.test', password='test-only-password',
        )
        self.client.force_authenticate(self.user)

    @patch('users.telegram_service._api', return_value={
        'id': 123456, 'first_name': 'NodeBeacon Alerts', 'username': 'NodeBeaconTestBot',
    })
    def test_bot_information_contains_only_safe_dynamic_display_fields(self, api):
        self.assertEqual(bot_information(), {
            'bot_name': 'NodeBeacon Alerts',
            'bot_username': 'NodeBeaconTestBot',
            'bot_url': 'https://t.me/NodeBeaconTestBot',
        })
        api.assert_called_once_with('getMe')

    @patch('users.telegram_service._api', return_value={'username': 'bad/name'})
    def test_bot_information_rejects_invalid_username_for_url(self, _api):
        with self.assertRaises(TelegramServiceError):
            bot_information()

    @patch('users.telegram_service._api', return_value={'username': 'NodeBeaconTestBot'})
    def test_start_returns_deep_link_and_only_hashes_pair_code(self, _api):
        response = self.client.post(reverse('telegram_connect_start'), {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('https://t.me/NodeBeaconTestBot?start=', response.data['bot_url'])
        code = parse_qs(urlparse(response.data['bot_url']).query)['start'][0]
        pairing = TelegramPairing.objects.get(user=self.user)
        self.assertNotEqual(pairing.code_hash, code)
        self.assertEqual(len(pairing.code_hash), 64)

    @patch('users.telegram_service._api')
    def test_private_start_message_pairs_this_owner_and_sends_handshake(self, api):
        api.side_effect = [
            {'username': 'NodeBeaconTestBot'},
            [{'update_id': 42, 'message': {
                'text': '/start placeholder',
                'from': {'id': 7431},
                'chat': {'id': 7431, 'type': 'private'},
            }}],
            {'message_id': 912},
        ]
        started = self.client.post(reverse('telegram_connect_start'), {}, format='json')
        code = parse_qs(urlparse(started.data['bot_url']).query)['start'][0]
        api.side_effect = [
            [{'update_id': 43, 'message': {
                'text': f'/start {code}',
                'from': {'id': 7431},
                'chat': {'id': 7431, 'type': 'private'},
            }}],
            {'message_id': 913},
        ]
        response = self.client.post(reverse('telegram_connect_verify'), {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.telegram_chat_id, '7431')
        self.assertFalse(TelegramPairing.objects.filter(user=self.user).exists())

    @patch('users.telegram_service._api')
    def test_bare_start_message_pairs_verifying_owner(self, api):
        api.side_effect = [
            {'username': 'NodeBeaconTestBot'},
        ]
        self.client.post(reverse('telegram_connect_start'), {}, format='json')
        api.side_effect = [
            [{'update_id': 50, 'message': {
                'text': '/start',
                'from': {'id': 9988},
                'chat': {'id': 9988, 'type': 'private'},
            }}],
            {'message_id': 999},
        ]
        response = self.client.post(reverse('telegram_connect_verify'), {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.telegram_chat_id, '9988')
        self.assertFalse(TelegramPairing.objects.filter(user=self.user).exists())

    @patch('users.telegram_service._api', return_value=[])
    def test_unmatched_or_group_start_does_not_connect_chat(self, _api):
        _api.side_effect = [{'username': 'NodeBeaconTestBot'}, []]
        start = self.client.post(reverse('telegram_connect_start'), {}, format='json')
        code = parse_qs(urlparse(start.data['bot_url']).query)['start'][0]
        _api.return_value = [{'update_id': 1, 'message': {
            'text': f'/start {code}', 'from': {'id': 7431}, 'chat': {'id': -1, 'type': 'group'},
        }}]
        response = self.client.post(reverse('telegram_connect_verify'), {}, format='json')
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.telegram_chat_id)

    @patch('users.telegram_service.telegram_is_configured', return_value=True)
    @patch('users.telegram_service.bot_information', return_value={
        'bot_name': 'NodeBeacon Alerts', 'bot_username': 'NodeBeaconTestBot',
        'bot_url': 'https://t.me/NodeBeaconTestBot',
    })
    def test_settings_endpoint_returns_public_bot_info_without_private_ids(self, _bot_info, _configured):
        self.user.telegram_chat_id = '7431'
        self.user.save(update_fields=['telegram_chat_id'])
        response = self.client.get(reverse('telegram_settings'))
        self.assertTrue(response.data['connected'])
        self.assertTrue(response.data['bot_info_available'])
        self.assertEqual(response.data['bot_name'], 'NodeBeacon Alerts')
        self.assertEqual(response.data['bot_username'], 'NodeBeaconTestBot')
        self.assertEqual(response.data['bot_url'], 'https://t.me/NodeBeaconTestBot')
        self.assertNotIn('telegram_chat_id', response.data)
        self.assertNotIn('7431', str(response.data))
        self.assertNotIn('TELEGRAM_BOT_TOKEN', response.data)

    @patch('users.telegram_service.bot_information', side_effect=TelegramServiceError('private provider failure'))
    @patch('users.telegram_service.telegram_is_configured', return_value=True)
    def test_settings_stays_available_when_bot_info_cannot_be_loaded(self, _configured, _bot_info):
        response = self.client.get(reverse('telegram_settings'))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['bot_info_available'])
        self.assertEqual(response.data['bot_name'], '')
        self.assertNotIn('private provider failure', str(response.data))

    @patch('users.telegram_service.bot_information', return_value={
        'bot_name': 'NodeBeacon Alerts', 'bot_username': 'NodeBeaconTestBot',
        'bot_url': 'https://t.me/NodeBeaconTestBot',
    })
    def test_unlock_telegram_preference_requires_connected_chat(self, _bot_info):
        response = self.client.patch(
            reverse('telegram_settings'),
            {'notify_on_laptop_unlock_telegram': True}, format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.user.telegram_chat_id = '7431'
        self.user.save(update_fields=['telegram_chat_id'])
        with patch('users.telegram_service.telegram_is_configured', return_value=True):
            response = self.client.patch(
                reverse('telegram_settings'),
                {'notify_on_laptop_unlock_telegram': True}, format='json',
            )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.notify_on_laptop_unlock_telegram)

    @patch('users.telegram_service.telegram_is_configured', return_value=True)
    @patch('users.telegram_service.send_telegram_message')
    def test_test_message_only_targets_authenticated_users_verified_chat(self, send, _configured):
        self.user.telegram_chat_id = '7431'
        self.user.save(update_fields=['telegram_chat_id'])
        response = self.client.post(reverse('telegram_test'), {}, format='json')
        self.assertEqual(response.status_code, 200)
        send.assert_called_once()
        self.assertEqual(send.call_args.args[0], '7431')

    @override_settings(DEBUG=True, TELEGRAM_BOT_TOKEN='test-token', TELEGRAM_CHAT_ID='8800790784')
    @patch('users.telegram_service.bot_information', return_value={
        'bot_name': 'NodeBeacon Alerts', 'bot_username': 'NodeBeaconTestBot',
        'bot_url': 'https://t.me/NodeBeaconTestBot',
    })
    @patch('users.telegram_service.send_telegram_message')
    def test_development_test_uses_env_chat_without_exposing_it(self, send, _bot_info):
        settings = self.client.get(reverse('telegram_settings'))
        self.assertTrue(settings.data['development_test_available'])
        self.assertNotIn('telegram_chat_id', settings.data)
        self.assertNotIn('TELEGRAM_CHAT_ID', settings.data)
        self.assertNotIn('8800790784', str(settings.data))

        response = self.client.post(reverse('telegram_test'), {}, format='json')
        self.assertEqual(response.status_code, 200)
        send.assert_called_once_with('8800790784', 'NodeBeacon Telegram test notification')

    @override_settings(DEBUG=False, TELEGRAM_BOT_TOKEN='test-token', TELEGRAM_CHAT_ID='8800790784')
    @patch('users.telegram_service.bot_information', return_value={
        'bot_name': 'NodeBeacon Alerts', 'bot_username': 'NodeBeaconTestBot',
        'bot_url': 'https://t.me/NodeBeaconTestBot',
    })
    def test_env_chat_fallback_is_not_available_outside_development(self, _bot_info):
        settings = self.client.get(reverse('telegram_settings'))
        self.assertFalse(settings.data['development_test_available'])
        response = self.client.post(reverse('telegram_test'), {}, format='json')
        self.assertEqual(response.status_code, 400)

    @override_settings(TELEGRAM_BOT_TOKEN='never-log-this-token')
    def test_configuration_log_never_contains_the_bot_token(self):
        from users.telegram_service import telegram_is_configured
        with self.assertLogs('users.telegram_service', level='INFO') as logs:
            self.assertTrue(telegram_is_configured())
        output = '\n'.join(logs.output)
        self.assertIn('[Telegram] Configuration loaded: YES', output)
        self.assertNotIn('never-log-this-token', output)

    @override_settings(TELEGRAM_BOT_TOKEN='secret-test-token')
    @patch('users.telegram_service.requests.post')
    def test_send_logs_success_without_token_chat_id_or_message(self, post):
        response = Mock()
        response.json.return_value = {'ok': True, 'result': {'message_id': 123}}
        post.return_value = response
        with self.assertLogs('users.telegram_service', level='INFO') as logs:
            from users.telegram_service import send_telegram_message
            send_telegram_message('private-test-chat', 'private test content')
        output = '\n'.join(logs.output)
        self.assertIn('[Telegram] Sending message...', output)
        self.assertIn('[Telegram] Telegram API response: success', output)
        self.assertNotIn('secret-test-token', output)
        self.assertNotIn('private-test-chat', output)
        self.assertNotIn('private test content', output)

    @override_settings(TELEGRAM_BOT_TOKEN='secret-test-token')
    @patch('users.telegram_service.requests.post')
    def test_send_logs_api_rejection_without_response_details_or_secrets(self, post):
        response = Mock()
        response.json.return_value = {'ok': False, 'description': 'private provider response'}
        post.return_value = response
        with self.assertLogs('users.telegram_service', level='WARNING') as logs:
            from users.telegram_service import TelegramServiceError, send_telegram_message
            with self.assertRaises(TelegramServiceError):
                send_telegram_message('private-test-chat', 'private test content')
        output = '\n'.join(logs.output)
        self.assertIn('[Telegram] Telegram API response: error', output)
        self.assertNotIn('secret-test-token', output)
        self.assertNotIn('private-test-chat', output)
        self.assertNotIn('private test content', output)
        self.assertNotIn('private provider response', output)

    @patch('users.telegram_service.bot_information', return_value={
        'bot_name': 'NodeBeacon Alerts', 'bot_username': 'NodeBeaconTestBot',
        'bot_url': 'https://t.me/NodeBeaconTestBot',
    })
    def test_disconnect_clears_only_current_users_chat_and_disables_telegram_unlocks(self, _bot_info):
        self.user.telegram_chat_id = '7431'
        self.user.notify_on_laptop_unlock_telegram = True
        self.user.save(update_fields=['telegram_chat_id', 'notify_on_laptop_unlock_telegram'])
        response = self.client.patch(reverse('telegram_settings'), {'disconnect': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['connected'])
        self.user.refresh_from_db()
        self.assertIsNone(self.user.telegram_chat_id)
        self.assertFalse(self.user.notify_on_laptop_unlock_telegram)
