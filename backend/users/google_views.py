import logging
import urllib.parse
from django.conf import settings
from django.http import HttpResponseRedirect
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from users.google_oauth import (
    GoogleOAuthError,
    build_authorization_url,
    verify_state,
    exchange_code_for_tokens,
    verify_google_identity,
    authenticate_or_create_google_user,
    get_default_redirect_uri,
)
from users.serializers import UserSerializer

logger = logging.getLogger(__name__)


class GoogleAuthUrlView(APIView):
    """
    Returns the Google OAuth 2.0 authorization URL and public client ID.
    Clients can supply a redirect_uri query parameter if needed.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        requested_redirect = request.query_params.get('redirect_uri', '').strip()
        try:
            auth_data = build_authorization_url(
                redirect_uri=requested_redirect or None,
                request=request
            )
            return Response(auth_data, status=status.HTTP_200_OK)
        except GoogleOAuthError as e:
            return Response({'error': e.code, 'detail': e.message}, status=e.status_code)
        except Exception as e:
            logger.error(f"Error generating Google OAuth URL: {e}")
            return Response(
                {'error': 'server_error', 'detail': 'Could not initialize Google sign-in.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GoogleAuthExchangeView(APIView):
    """
    Exchanges an authorization code received by the frontend for JWT tokens.
    Verifies user identity, links or creates account, and logs the user in.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        code = request.data.get('code', '').strip()
        redirect_uri = request.data.get('redirect_uri', '').strip()
        state = request.data.get('state', '').strip()

        if not code:
            return Response(
                {'error': 'missing_code', 'detail': 'Authorization code is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify state signature if present
        state_data = {}
        if state:
            try:
                state_data = verify_state(state)
            except GoogleOAuthError as e:
                return Response({'error': e.code, 'detail': e.message}, status=e.status_code)

        resolved_redirect_uri = (
            (state_data.get('redirect_uri') if state_data else None)
            or getattr(settings, 'GOOGLE_REDIRECT_URI', '')
            or redirect_uri
            or get_default_redirect_uri(request)
        )

        try:
            tokens = exchange_code_for_tokens(code, resolved_redirect_uri)
            identity = verify_google_identity(tokens)
            user, jwt_tokens = authenticate_or_create_google_user(identity)

            return Response({
                'access': jwt_tokens['access'],
                'refresh': jwt_tokens['refresh'],
                'user': UserSerializer(user).data,
            }, status=status.HTTP_200_OK)

        except GoogleOAuthError as e:
            return Response({'error': e.code, 'detail': e.message}, status=e.status_code)
        except Exception as e:
            logger.error(f"Unhandled error in Google auth exchange: {e}", exc_info=True)
            return Response(
                {'error': 'auth_failed', 'detail': 'Google sign-in could not be completed.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GoogleAuthCallbackView(APIView):
    """
    Direct callback endpoint for Google OAuth redirects.
    Redirects back to the frontend application with JWT tokens or error details.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        error = request.query_params.get('error', '').strip()
        error_desc = request.query_params.get('error_description', '').strip()
        code = request.query_params.get('code', '').strip()
        state = request.query_params.get('state', '').strip()

        # Determine target frontend URL for redirection
        frontend_callback = get_default_redirect_uri(request)

        # Handle user cancellation / denied permissions
        if error:
            logger.info(f"Google OAuth callback received error: {error} - {error_desc}")
            params = urllib.parse.urlencode({
                'error': error,
                'error_description': error_desc or 'Google sign-in was cancelled or access was denied.',
            })
            return HttpResponseRedirect(f"{frontend_callback}?{params}")

        if not code:
            params = urllib.parse.urlencode({
                'error': 'missing_code',
                'error_description': 'No authorization code was received from Google.',
            })
            return HttpResponseRedirect(f"{frontend_callback}?{params}")

        # Verify state
        if state:
            try:
                verify_state(state)
            except GoogleOAuthError as e:
                params = urllib.parse.urlencode({'error': e.code, 'error_description': e.message})
                return HttpResponseRedirect(f"{frontend_callback}?{params}")

        try:
            # For direct backend callback, use the request's exact absolute URI without query params
            backend_redirect_uri = request.build_absolute_uri(request.path)
            tokens = exchange_code_for_tokens(code, backend_redirect_uri)
            identity = verify_google_identity(tokens)
            user, jwt_tokens = authenticate_or_create_google_user(identity)

            # Redirect user back to frontend with tokens
            params = urllib.parse.urlencode({
                'access_token': jwt_tokens['access'],
                'refresh_token': jwt_tokens['refresh'],
            })
            return HttpResponseRedirect(f"{frontend_callback}?{params}")

        except GoogleOAuthError as e:
            params = urllib.parse.urlencode({'error': e.code, 'error_description': e.message})
            return HttpResponseRedirect(f"{frontend_callback}?{params}")
        except Exception as e:
            logger.error(f"Error handling Google OAuth callback: {e}", exc_info=True)
            params = urllib.parse.urlencode({
                'error': 'auth_failed',
                'error_description': 'Google sign-in could not be completed.',
            })
            return HttpResponseRedirect(f"{frontend_callback}?{params}")
