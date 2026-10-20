from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.conf import settings
import urllib.parse
from users.google_oauth import generate_state, verify_state, GoogleOAuthError

User = get_user_model()


class GoogleOAuthTests(TestCase):
    def setUp(self):
        self.client_id = settings.GOOGLE_CLIENT_ID or "test-client-id"
        self.client_secret = settings.GOOGLE_CLIENT_SECRET or "test-client-secret"

    def _create_mock_get(self, userinfo_data):
        def side_effect(url, *args, **kwargs):
            resp = MagicMock()
            resp.status_code = 200
            if 'tokeninfo' in url:
                resp.json.return_value = {
                    'aud': self.client_id,
                    'sub': userinfo_data.get('sub', ''),
                    'email': userinfo_data.get('email', ''),
                    'email_verified': userinfo_data.get('email_verified', True),
                }
            else:
                resp.json.return_value = userinfo_data
            return resp
        return side_effect

    def test_state_generation_and_verification(self):
        redirect_uri = "http://127.0.0.1:5173/auth/callback"
        state = generate_state(redirect_uri)
        self.assertTrue(bool(state))

        data = verify_state(state)
        self.assertEqual(data.get('redirect_uri'), redirect_uri)

        # Invalid state fails
        with self.assertRaises(GoogleOAuthError):
            verify_state("tampered_state_value")

    def test_auth_url_endpoint_success(self):
        url = reverse('google_auth_url')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIn('url', data)
        self.assertIn('client_id', data)
        self.assertIn('state', data)

        auth_url = data['url']
        self.assertTrue(auth_url.startswith("https://accounts.google.com/o/oauth2/v2/auth"))

        parsed = urllib.parse.urlparse(auth_url)
        params = urllib.parse.parse_qs(parsed.query)

        self.assertIn('client_id', params)
        self.assertIn('prompt', params)
        self.assertEqual(params['prompt'], ['select_account'])
        self.assertIn('scope', params)
        self.assertIn('state', params)
        self.assertIn('response_type', params)
        self.assertEqual(params['response_type'], ['code'])

    def test_auth_url_custom_redirect_uri(self):
        custom_redirect = "http://localhost:5173/auth/callback"
        url = f"{reverse('google_auth_url')}?redirect_uri={urllib.parse.quote(custom_redirect)}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data.get('redirect_uri'), custom_redirect)

    def test_exchange_missing_code(self):
        url = reverse('google_auth_exchange')
        response = self.client.post(url, {}, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get('error'), 'missing_code')

    def test_exchange_invalid_state(self):
        url = reverse('google_auth_exchange')
        response = self.client.post(url, {
            'code': 'sample_code',
            'state': 'corrupted_state',
        }, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get('error'), 'state_invalid')

    @patch('users.google_oauth.requests.post')
    def test_exchange_redirect_uri_mismatch(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            'error': 'redirect_uri_mismatch',
            'error_description': 'Bad Request'
        }
        mock_post.return_value = mock_resp

        url = reverse('google_auth_exchange')
        response = self.client.post(url, {
            'code': 'sample_code',
            'redirect_uri': 'http://unregistered-host/callback'
        }, content_type='application/json')

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get('error'), 'redirect_uri_mismatch')
        self.assertIn('Authorized redirect URIs', data.get('detail', ''))

    @patch('users.google_oauth.requests.post')
    def test_exchange_invalid_client(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            'error': 'invalid_client',
            'error_description': 'The OAuth client was not found.'
        }
        mock_post.return_value = mock_resp

        url = reverse('google_auth_exchange')
        response = self.client.post(url, {
            'code': 'sample_code'
        }, content_type='application/json')

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get('error'), 'invalid_client')

    @patch('users.google_oauth.requests.get')
    @patch('users.google_oauth.requests.post')
    def test_exchange_unverified_email_rejected(self, mock_post, mock_get):
        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {
            'access_token': 'fake_access_token',
            'id_token': 'fake_id_token',
        }
        mock_post.return_value = mock_token_resp

        userinfo = {
            'sub': 'google_12345',
            'email': 'unverified@example.com',
            'email_verified': False,
        }
        mock_get.side_effect = self._create_mock_get(userinfo)

        url = reverse('google_auth_exchange')
        response = self.client.post(url, {
            'code': 'sample_code'
        }, content_type='application/json')

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get('error'), 'email_not_verified')

    @patch('users.google_oauth.requests.get')
    @patch('users.google_oauth.requests.post')
    def test_exchange_new_user_success(self, mock_post, mock_get):
        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {
            'access_token': 'fake_access_token',
            'id_token': 'fake_id_token',
        }
        mock_post.return_value = mock_token_resp

        userinfo = {
            'sub': 'google_unique_sub_101',
            'email': 'newuser@example.com',
            'email_verified': True,
            'given_name': 'New',
            'family_name': 'User',
            'name': 'New User',
        }
        mock_get.side_effect = self._create_mock_get(userinfo)

        url = reverse('google_auth_exchange')
        response = self.client.post(url, {
            'code': 'sample_code'
        }, content_type='application/json')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('access', data)
        self.assertIn('refresh', data)
        self.assertIn('user', data)
        self.assertEqual(data['user']['email'], 'newuser@example.com')
        self.assertTrue(data['user']['is_google_linked'])

        # Verify in database
        user = User.objects.get(email='newuser@example.com')
        self.assertEqual(user.google_id, 'google_unique_sub_101')
        self.assertEqual(user.role, 'INDIVIDUAL')
        self.assertFalse(user.has_usable_password())

    @patch('users.google_oauth.requests.get')
    @patch('users.google_oauth.requests.post')
    def test_exchange_links_existing_password_user(self, mock_post, mock_get):
        # Create existing email/password user
        existing_user = User.objects.create_user(
            username='existing@example.com',
            email='existing@example.com',
            password='Password123!',
            first_name='Existing',
            last_name='User'
        )
        self.assertIsNone(existing_user.google_id)
        self.assertTrue(existing_user.check_password('Password123!'))

        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {
            'access_token': 'fake_access_token',
            'id_token': 'fake_id_token',
        }
        mock_post.return_value = mock_token_resp

        userinfo = {
            'sub': 'google_linked_sub_202',
            'email': 'existing@example.com',
            'email_verified': True,
            'name': 'Existing User',
        }
        mock_get.side_effect = self._create_mock_get(userinfo)

        url = reverse('google_auth_exchange')
        response = self.client.post(url, {
            'code': 'sample_code'
        }, content_type='application/json')

        self.assertEqual(response.status_code, 200)
        existing_user.refresh_from_db()
        self.assertEqual(existing_user.google_id, 'google_linked_sub_202')
        # Existing password remains intact!
        self.assertTrue(existing_user.check_password('Password123!'))
        # No duplicate accounts created
        self.assertEqual(User.objects.filter(email='existing@example.com').count(), 1)

    @patch('users.google_oauth.requests.get')
    @patch('users.google_oauth.requests.post')
    def test_exchange_prevents_account_conflict(self, mock_post, mock_get):
        User.objects.create_user(
            username='linked@example.com',
            email='linked@example.com',
            google_id='google_first_sub'
        )

        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {
            'access_token': 'fake_access_token',
            'id_token': 'fake_id_token',
        }
        mock_post.return_value = mock_token_resp

        userinfo = {
            'sub': 'google_different_sub',
            'email': 'linked@example.com',
            'email_verified': True,
        }
        mock_get.side_effect = self._create_mock_get(userinfo)

        url = reverse('google_auth_exchange')
        response = self.client.post(url, {
            'code': 'sample_code'
        }, content_type='application/json')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json().get('error'), 'account_conflict')

    def test_callback_access_denied_redirects_to_frontend(self):
        url = f"{reverse('google_auth_callback')}?error=access_denied&error_description=User+cancelled"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)
        redirect_url = response['Location']
        self.assertIn('/auth/callback', redirect_url)
        self.assertIn('error=access_denied', redirect_url)

    @patch('users.google_oauth.requests.get')
    @patch('users.google_oauth.requests.post')
    def test_callback_success_redirects_with_tokens(self, mock_post, mock_get):
        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {
            'access_token': 'fake_access_token',
            'id_token': 'fake_id_token',
        }
        mock_post.return_value = mock_token_resp

        userinfo = {
            'sub': 'google_cb_sub_303',
            'email': 'cbuser@example.com',
            'email_verified': True,
        }
        mock_get.side_effect = self._create_mock_get(userinfo)

        url = f"{reverse('google_auth_callback')}?code=valid_cb_code"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)
        redirect_url = response['Location']
        self.assertIn('access_token=', redirect_url)
        self.assertIn('refresh_token=', redirect_url)

    def test_client_secret_is_never_leaked(self):
        secret = settings.GOOGLE_CLIENT_SECRET
        if not secret:
            return

        # Check in URL generator response
        res = self.client.get(reverse('google_auth_url'))
        self.assertNotIn(secret, res.content.decode())

        # Check in exchange error response
        res2 = self.client.post(reverse('google_auth_exchange'), {'code': 'bad'}, content_type='application/json')
        self.assertNotIn(secret, res2.content.decode())

    @patch('users.google_oauth.requests.get')
    @patch('users.google_oauth.requests.post')
    def test_exchange_uses_state_redirect_uri(self, mock_post, mock_get):
        original_uri = "http://127.0.0.1:5173/auth/callback"
        signed_state = generate_state(original_uri)

        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {
            'access_token': 'fake_access_token',
            'id_token': 'fake_id_token',
        }
        mock_post.return_value = mock_token_resp

        userinfo = {
            'sub': 'google_sub_state_test',
            'email': 'state_test@example.com',
            'email_verified': True,
        }
        mock_get.side_effect = self._create_mock_get(userinfo)

        url = reverse('google_auth_exchange')
        # Frontend might omit or supply a different redirect_uri, but signed state should be authoritative
        response = self.client.post(url, {
            'code': 'valid_code',
            'state': signed_state,
        }, content_type='application/json')

        self.assertEqual(response.status_code, 200)
        # Verify the post to GOOGLE_TOKEN_ENDPOINT used original_uri
        self.assertTrue(mock_post.called)
        called_data = mock_post.call_args[1].get('data', {})
        self.assertEqual(called_data.get('redirect_uri'), original_uri)

