import logging
import urllib.parse
from django.conf import settings
from django.core import signing
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
import requests

logger = logging.getLogger(__name__)
User = get_user_model()

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_TOKENINFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo"


class GoogleOAuthError(Exception):
    def __init__(self, code, message, status_code=400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def get_default_redirect_uri(request=None):
    """
    Returns the configured redirect URI, or builds the frontend callback URI
    based on the incoming request origin or configured frontend URL.
    """
    if getattr(settings, 'GOOGLE_REDIRECT_URI', ''):
        return settings.GOOGLE_REDIRECT_URI

    # Prefer request origin or referer if it matches allowed dev origins or configured frontend
    if request:
        origin = request.headers.get('Origin') or request.headers.get('Referer', '')
        if origin:
            parsed = urllib.parse.urlparse(origin)
            frontend_url = getattr(settings, 'FRONTEND_URL', '')
            frontend_parsed = urllib.parse.urlparse(frontend_url) if frontend_url else None
            is_valid_origin = (
                parsed.hostname in ('localhost', '127.0.0.1')
                or (frontend_parsed and frontend_parsed.hostname and parsed.hostname == frontend_parsed.hostname)
            )
            if is_valid_origin:
                port_str = f":{parsed.port}" if parsed.port else ""
                return f"{parsed.scheme}://{parsed.hostname}{port_str}/auth/callback"

    # Fallback to configured FRONTEND_URL
    frontend_base = getattr(settings, 'FRONTEND_URL', 'http://127.0.0.1:5173').rstrip('/')
    return f"{frontend_base}/auth/callback"


def generate_state(redirect_uri=''):
    """
    Generates a cryptographically signed state token with timestamp and redirect URI.
    """
    payload = {
        'redirect_uri': redirect_uri,
        'salt': 'nb_google_oauth_state',
    }
    return signing.dumps(payload, salt='google-oauth-state')


def verify_state(state):
    """
    Verifies the cryptographic signature of the state token (valid for 15 minutes).
    """
    if not state:
        return {}
    try:
        return signing.loads(state, salt='google-oauth-state', max_age=900)
    except signing.SignatureExpired:
        raise GoogleOAuthError(
            'state_expired',
            'Authentication session expired. Please try signing in with Google again.',
            status_code=400
        )
    except signing.BadSignature:
        raise GoogleOAuthError(
            'state_invalid',
            'Invalid authentication state parameter. Please try signing in with Google again.',
            status_code=400
        )


def build_authorization_url(redirect_uri=None, request=None):
    """
    Builds the Google OAuth 2.0 authorization URL with prompt=select_account.
    """
    client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '').strip()
    if not client_id:
        raise GoogleOAuthError(
            'missing_client_id',
            'Google OAuth Client ID is not configured. Please set GOOGLE_CLIENT_ID in backend/.env.',
            status_code=500
        )

    resolved_redirect_uri = getattr(settings, 'GOOGLE_REDIRECT_URI', '') or redirect_uri or get_default_redirect_uri(request)
    state = generate_state(resolved_redirect_uri)

    params = {
        'client_id': client_id,
        'redirect_uri': resolved_redirect_uri,
        'response_type': 'code',
        'scope': 'openid email profile',
        'access_type': 'offline',
        'prompt': 'select_account',
        'state': state,
    }

    url = f"{GOOGLE_AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"
    return {
        'url': url,
        'client_id': client_id,
        'redirect_uri': resolved_redirect_uri,
        'state': state,
    }


def exchange_code_for_tokens(code, redirect_uri):
    """
    Exchanges the authorization code for Google tokens.
    Never exposes client_secret in error messages or logs.
    """
    client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '').strip()
    client_secret = getattr(settings, 'GOOGLE_CLIENT_SECRET', '').strip()

    if not client_id or not client_secret:
        raise GoogleOAuthError(
            'missing_credentials',
            'Google OAuth credentials are not properly configured on the server.',
            status_code=500
        )

    token_data = {
        'code': code,
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': redirect_uri,
        'grant_type': 'authorization_code',
    }

    try:
        response = requests.post(GOOGLE_TOKEN_ENDPOINT, data=token_data, timeout=10)
    except requests.RequestException as e:
        logger.error(f"Google token endpoint request failed: {e.__class__.__name__}")
        raise GoogleOAuthError(
            'network_error',
            'Could not reach Google authentication servers. Please check your internet connection.',
            status_code=502
        )

    try:
        payload = response.json()
    except Exception:
        payload = {}

    if response.status_code != 200:
        error_code = payload.get('error', 'token_exchange_failed')
        error_desc = payload.get('error_description', '')
        logger.warning(f"Google token exchange rejected: {error_code} - {error_desc}")

        if error_code == 'redirect_uri_mismatch':
            raise GoogleOAuthError(
                'redirect_uri_mismatch',
                f"Redirect URI mismatch: '{redirect_uri}' is not authorized in Google Cloud Console. "
                f"Please add '{redirect_uri}' to Authorized redirect URIs in Google Cloud Console.",
                status_code=400
            )
        elif error_code == 'invalid_client':
            raise GoogleOAuthError(
                'invalid_client',
                'Invalid Google OAuth client credentials. Please verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
                status_code=400
            )
        elif error_code in ('invalid_grant', 'invalid_request'):
            raise GoogleOAuthError(
                'invalid_grant',
                'The authorization code is invalid or has expired. Please try signing in again.',
                status_code=400
            )
        else:
            raise GoogleOAuthError(
                error_code,
                f"Google sign-in error: {error_desc or error_code}",
                status_code=400
            )

    return payload


def verify_google_identity(tokens):
    """
    Verifies userinfo and id_token claims from Google.
    Ensures email_verified is True.
    """
    access_token = tokens.get('access_token')
    id_token = tokens.get('id_token')

    if not access_token and not id_token:
        raise GoogleOAuthError('missing_token', 'No tokens returned from Google.', status_code=400)

    userinfo = {}
    if access_token:
        try:
            resp = requests.get(
                GOOGLE_USERINFO_ENDPOINT,
                headers={'Authorization': f'Bearer {access_token}'},
                timeout=10
            )
            if resp.status_code == 200:
                userinfo = resp.json()
        except requests.RequestException as e:
            logger.warning(f"Could not fetch Google userinfo endpoint: {e}")

    # Also verify id_token with tokeninfo endpoint if available
    client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '').strip()
    if id_token:
        try:
            tokeninfo_resp = requests.get(
                f"{GOOGLE_TOKENINFO_ENDPOINT}?id_token={id_token}",
                timeout=10
            )
            if tokeninfo_resp.status_code == 200:
                tokeninfo = tokeninfo_resp.json()
                aud = tokeninfo.get('aud')
                if client_id and aud != client_id:
                    logger.error("Token audience mismatch against GOOGLE_CLIENT_ID")
                    raise GoogleOAuthError(
                        'audience_mismatch',
                        'Token audience verification failed.',
                        status_code=401
                    )
                # Merge into userinfo if userinfo was missing fields
                for k, v in tokeninfo.items():
                    if k not in userinfo:
                        userinfo[k] = v
        except GoogleOAuthError:
            raise
        except requests.RequestException as e:
            logger.warning(f"Tokeninfo check skipped: {e}")

    google_sub = str(userinfo.get('sub', '')).strip()
    email = str(userinfo.get('email', '')).strip().lower()
    email_verified = userinfo.get('email_verified')
    is_verified = (email_verified is True or str(email_verified).lower() == 'true')

    if not google_sub:
        raise GoogleOAuthError('missing_identity', 'Could not obtain Google user ID.', status_code=400)

    if not email:
        raise GoogleOAuthError('missing_email', 'Your Google account did not provide an email address.', status_code=400)

    if not is_verified:
        raise GoogleOAuthError(
            'email_not_verified',
            'Your Google email is not verified by Google. For security reasons, please verify your email in your Google Account before signing in.',
            status_code=400
        )

    return {
        'sub': google_sub,
        'email': email,
        'email_verified': True,
        'given_name': userinfo.get('given_name', ''),
        'family_name': userinfo.get('family_name', ''),
        'name': userinfo.get('name', ''),
        'picture': userinfo.get('picture', ''),
    }


def authenticate_or_create_google_user(identity):
    """
    Finds or creates a User according to NodeBeacon security requirements:
    1. Check if user with matching google_id exists.
    2. Check if user with matching email exists.
       - Prevent duplicate accounts.
       - If email account exists and identity is verified, link google_id securely.
       - If existing email account is already linked to another Google ID, reject.
    3. If new user, create user with INDIVIDUAL role and unusable password.
    4. Issue JWT access and refresh tokens.
    """
    google_sub = identity['sub']
    email = identity['email']
    given_name = identity.get('given_name', '')
    family_name = identity.get('family_name', '')
    full_name = identity.get('name', '')

    user = User.objects.filter(google_id=google_sub).first()

    if user:
        if not user.is_active:
            raise GoogleOAuthError('account_disabled', 'This account has been disabled. Please contact support.', status_code=403)
        # Update names if empty
        fields_to_update = []
        if not user.first_name and given_name:
            user.first_name = given_name
            fields_to_update.append('first_name')
        if not user.last_name and family_name:
            user.last_name = family_name
            fields_to_update.append('last_name')
        if fields_to_update:
            user.save(update_fields=fields_to_update)
    else:
        # Check by email
        user_by_email = User.objects.filter(email__iexact=email).first()

        if user_by_email:
            if not user_by_email.is_active:
                raise GoogleOAuthError('account_disabled', 'This account has been disabled. Please contact support.', status_code=403)

            # Prevent conflict if already linked to a different Google account
            if user_by_email.google_id and user_by_email.google_id != google_sub:
                raise GoogleOAuthError(
                    'account_conflict',
                    'This email address is already associated with a different Google account. '
                    'Please sign in using your existing credentials.',
                    status_code=409
                )

            # Link Google account to existing email/password account
            user_by_email.google_id = google_sub
            fields_to_update = ['google_id']
            if not user_by_email.first_name and given_name:
                user_by_email.first_name = given_name
                fields_to_update.append('first_name')
            if not user_by_email.last_name and family_name:
                user_by_email.last_name = family_name
                fields_to_update.append('last_name')
            user_by_email.save(update_fields=fields_to_update)
            user = user_by_email
        else:
            # Create a brand new user
            username = email
            # Guarantee username uniqueness in case of unusual username collision
            if User.objects.filter(username__iexact=username).exists():
                username = f"{email.split('@')[0]}_{google_sub[:6]}"

            first = given_name or (full_name.split()[0] if full_name else '')
            last = family_name or (' '.join(full_name.split()[1:]) if full_name and len(full_name.split()) > 1 else '')

            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first,
                last_name=last,
                role='INDIVIDUAL',
                member_role='VIEWER',
                google_id=google_sub,
            )
            # Prevent password guessing while allowing user to set one later
            user.set_unusable_password()
            user.save()

    refresh = RefreshToken.for_user(user)
    return user, {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }
