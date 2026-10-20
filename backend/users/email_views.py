"""API views for managing user email notification integration and verification."""
import hashlib
import logging
import secrets
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.email_service import (
    email_delivery_is_configured,
    is_user_email_verified,
    send_test_email,
    send_verification_email,
)

logger = logging.getLogger(__name__)

VERIFICATION_EXPIRY_MINUTES = 15
RESEND_COOLDOWN_SECONDS = 60
TEST_EMAIL_COOLDOWN_SECONDS = 10


def hash_token(token):
    return hashlib.sha256(str(token).encode('utf-8')).hexdigest()


def compute_status(user, configured):
    if not configured:
        return 'error' if (user.recipient_email or user.email_unverified_recipient) else 'not_configured'
    if is_user_email_verified(user):
        return 'connected'
    if user.email_unverified_recipient and user.email_verification_token_hash:
        if user.email_verification_expires_at and timezone.now() > user.email_verification_expires_at:
            return 'pending_verification'
        return 'pending_verification'
    return 'not_connected'


class EmailSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        configured = email_delivery_is_configured()
        current_status = compute_status(user, configured)

        cooldown = 0
        if user.email_verification_sent_at:
            elapsed = (timezone.now() - user.email_verification_sent_at).total_seconds()
            if elapsed < RESEND_COOLDOWN_SECONDS:
                cooldown = int(RESEND_COOLDOWN_SECONDS - elapsed)

        return Response({
            'configured': configured,
            'status': current_status,
            'recipient_email': user.recipient_email or '',
            'unverified_email': user.email_unverified_recipient or '',
            'is_verified': is_user_email_verified(user),
            'enable_email_notifications': user.enable_email_notifications,
            'notify_offline_email': user.notify_offline_email,
            'notify_critical_email': user.notify_critical_email,
            'notify_on_laptop_unlock': user.notify_on_laptop_unlock,
            'resend_cooldown': cooldown,
        })

    def patch(self, request):
        user = request.user
        data = request.data

        # Handle disconnect
        if data.get('disconnect') is True:
            user.recipient_email = None
            user.email_unverified_recipient = None
            user.email_verified = False
            user.email_verification_token_hash = None
            user.email_verification_link_hash = None
            user.email_verification_expires_at = None
            user.email_verification_sent_at = None
            user.enable_email_notifications = False
            user.notify_on_laptop_unlock = False
            user.save(update_fields=[
                'recipient_email', 'email_unverified_recipient', 'email_verified',
                'email_verification_token_hash', 'email_verification_link_hash',
                'email_verification_expires_at', 'email_verification_sent_at',
                'enable_email_notifications', 'notify_on_laptop_unlock'
            ])
            return self.get(request)

        update_fields = []
        for field in ('enable_email_notifications', 'notify_offline_email', 'notify_critical_email', 'notify_on_laptop_unlock'):
            if field in data and isinstance(data[field], bool):
                setattr(user, field, data[field])
                update_fields.append(field)

        if update_fields:
            user.save(update_fields=update_fields)

        return self.get(request)


class EmailConnectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        email = str(request.data.get('email', '')).strip().lower()

        if not email:
            return Response({'message': 'Please enter a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate header injection & email format
        if '\n' in email or '\r' in email:
            return Response({'message': 'Invalid characters in email address.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_email(email)
        except ValidationError:
            return Response({'message': 'Please enter a valid email address (e.g. name@example.com).'}, status=status.HTTP_400_BAD_REQUEST)

        if not email_delivery_is_configured():
            return Response({
                'message': 'SMTP is not configured on the NodeBeacon backend. Please check backend environment settings.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Rate limiting check
        if user.email_verification_sent_at:
            elapsed = (timezone.now() - user.email_verification_sent_at).total_seconds()
            if elapsed < RESEND_COOLDOWN_SECONDS:
                remaining = int(RESEND_COOLDOWN_SECONDS - elapsed)
                return Response({
                    'message': f'Please wait {remaining} seconds before requesting another verification email.',
                    'cooldown': remaining
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # Generate cryptographic 6-digit code and link token
        code = f"{secrets.randbelow(900000) + 100000}"
        link_token = secrets.token_urlsafe(32)

        user.email_unverified_recipient = email
        user.email_verified = False
        user.email_verification_token_hash = hash_token(f"{user.pk}:{code}")
        user.email_verification_link_hash = hash_token(link_token)
        user.email_verification_sent_at = timezone.now()
        user.email_verification_expires_at = timezone.now() + timedelta(minutes=VERIFICATION_EXPIRY_MINUTES)
        user.save(update_fields=[
            'email_unverified_recipient', 'email_verified',
            'email_verification_token_hash', 'email_verification_link_hash',
            'email_verification_sent_at', 'email_verification_expires_at'
        ])

        # Build verification URL
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://127.0.0.1:5173').rstrip('/')
        verification_link = f"{request.scheme}://{request.get_host()}/api/email/verify-link/?token={link_token}"

        try:
            send_verification_email(user, email, code, verification_link)
            return Response({
                'status': 'pending_verification',
                'unverified_email': email,
                'message': f'Verification code sent to {email}. Check your inbox and spam folder.'
            }, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.error("Failed to dispatch verification email: %s", exc, exc_info=True)
            return Response({
                'message': 'Could not deliver the verification email. Check SMTP settings and try again.'
            }, status=status.HTTP_502_BAD_GATEWAY)


class EmailVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        code = str(request.data.get('code', '')).strip()
        token = str(request.data.get('token', '')).strip()

        if not code and not token:
            return Response({'message': 'Please enter the 6-digit verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.email_unverified_recipient:
            return Response({'message': 'No pending email verification found. Please enter your email address first.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.email_verification_expires_at or timezone.now() > user.email_verification_expires_at:
            return Response({'message': 'Verification code has expired. Please request a new code.'}, status=status.HTTP_400_BAD_REQUEST)

        is_valid = False
        if code:
            expected_hash = hash_token(f"{user.pk}:{code}")
            if user.email_verification_token_hash and secrets.compare_digest(expected_hash, user.email_verification_token_hash):
                is_valid = True
        elif token:
            expected_link_hash = hash_token(token)
            if user.email_verification_link_hash and secrets.compare_digest(expected_link_hash, user.email_verification_link_hash):
                is_valid = True

        if not is_valid:
            return Response({'message': 'Invalid verification code. Please check the code and try again.'}, status=status.HTTP_400_BAD_REQUEST)

        verified_email = user.email_unverified_recipient
        user.recipient_email = verified_email
        user.email_verified = True
        user.email_unverified_recipient = None
        user.email_verification_token_hash = None
        user.email_verification_link_hash = None
        user.email_verification_expires_at = None
        user.enable_email_notifications = True
        user.save(update_fields=[
            'recipient_email', 'email_verified', 'email_unverified_recipient',
            'email_verification_token_hash', 'email_verification_link_hash',
            'email_verification_expires_at', 'enable_email_notifications'
        ])

        return Response({
            'success': True,
            'message': f'Email {verified_email} verified successfully. Notifications are now active.',
            'recipient_email': verified_email,
            'is_verified': True,
            'status': 'connected',
        }, status=status.HTTP_200_OK)


class EmailResendView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        email = user.email_unverified_recipient

        if not email:
            return Response({'message': 'No pending email address to verify. Enter your email first.'}, status=status.HTTP_400_BAD_REQUEST)

        if not email_delivery_is_configured():
            return Response({'message': 'SMTP is not configured on the NodeBeacon backend.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if user.email_verification_sent_at:
            elapsed = (timezone.now() - user.email_verification_sent_at).total_seconds()
            if elapsed < RESEND_COOLDOWN_SECONDS:
                remaining = int(RESEND_COOLDOWN_SECONDS - elapsed)
                return Response({
                    'message': f'Please wait {remaining} seconds before resending.',
                    'cooldown': remaining
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        code = f"{secrets.randbelow(900000) + 100000}"
        link_token = secrets.token_urlsafe(32)

        user.email_verification_token_hash = hash_token(f"{user.pk}:{code}")
        user.email_verification_link_hash = hash_token(link_token)
        user.email_verification_sent_at = timezone.now()
        user.email_verification_expires_at = timezone.now() + timedelta(minutes=VERIFICATION_EXPIRY_MINUTES)
        user.save(update_fields=[
            'email_verification_token_hash', 'email_verification_link_hash',
            'email_verification_sent_at', 'email_verification_expires_at'
        ])

        verification_link = f"{request.scheme}://{request.get_host()}/api/email/verify-link/?token={link_token}"

        try:
            send_verification_email(user, email, code, verification_link)
            return Response({
                'message': f'Verification email resent to {email}.',
                'cooldown': RESEND_COOLDOWN_SECONDS
            }, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.error("Failed to resend verification email: %s", exc, exc_info=True)
            return Response({'message': 'Failed to resend verification email. Check SMTP settings.'}, status=status.HTTP_502_BAD_GATEWAY)


class EmailVerifyLinkView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        token = request.query_params.get('token', '').strip()
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://127.0.0.1:5173').rstrip('/')

        if not token:
            params = urlencode({'email_verified': 'false', 'error': 'missing_token'})
            return HttpResponseRedirect(f"{frontend_url}/#/?{params}")

        token_hash = hash_token(token)
        user = User.objects.filter(
            email_verification_link_hash=token_hash,
            email_verification_expires_at__gt=timezone.now()
        ).first()

        if not user or not user.email_unverified_recipient:
            params = urlencode({'email_verified': 'false', 'error': 'invalid_or_expired'})
            return HttpResponseRedirect(f"{frontend_url}/#/?{params}")

        verified_email = user.email_unverified_recipient
        user.recipient_email = verified_email
        user.email_verified = True
        user.email_unverified_recipient = None
        user.email_verification_token_hash = None
        user.email_verification_link_hash = None
        user.email_verification_expires_at = None
        user.enable_email_notifications = True
        user.save(update_fields=[
            'recipient_email', 'email_verified', 'email_unverified_recipient',
            'email_verification_token_hash', 'email_verification_link_hash',
            'email_verification_expires_at', 'enable_email_notifications'
        ])

        params = urlencode({'email_verified': 'true', 'recipient': verified_email})
        return HttpResponseRedirect(f"{frontend_url}/#/?{params}")


class EmailTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        recipient = (user.recipient_email or user.email or '').strip()

        if not recipient:
            return Response({'success': False, 'message': 'Set a recipient email address before sending a test notification.'}, status=status.HTTP_400_BAD_REQUEST)

        if not email_delivery_is_configured():
            return Response({'success': False, 'message': 'SMTP is not configured on the backend.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            send_test_email(user, recipient)
            return Response({
                'success': True,
                'recipient': recipient,
                'message': f'Test notification sent to {recipient}. Check your inbox and spam folder.'
            }, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.warning("Test email failed: %s", exc)
            return Response({
                'success': False,
                'message': 'Email delivery failed. Check backend SMTP settings and recipient address.'
            }, status=status.HTTP_502_BAD_GATEWAY)
