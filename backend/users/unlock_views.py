"""Idempotent, device-authenticated laptop-unlock notification endpoint."""
import logging
from datetime import timedelta
from uuid import UUID

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from servers.models import Server, UnlockNotification
from users.unlock_alerts import deliver_laptop_unlock_email, email_delivery_is_configured
from users.telegram_service import telegram_is_configured

logger = logging.getLogger(__name__)


class UnlockEventSerializer(serializers.Serializer):
    event_id = serializers.UUIDField()
    session_id = serializers.IntegerField(min_value=0, max_value=4_294_967_295)


class LaptopUnlockNotificationView(APIView):
    authentication_classes = []
    permission_classes = [IsAuthenticated]

    def get_authenticators(self):
        from servers.agent_api import DeviceAuthentication
        return [DeviceAuthentication()]

    def post(self, request):
        serializer = UnlockEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event_id = serializer.validated_data['event_id']
        server_id = request.auth.pk
        logger.info('[NodeBeacon] Unlock event received')

        with transaction.atomic():
            # Serialize retries for one server while reserving the unique event ID.
            server = Server.objects.select_for_update().select_related('owner').get(pk=server_id)
            notification, created = UnlockNotification.objects.get_or_create(
                event_id=event_id,
                defaults={'server': server, 'delivery_status': 'Pending'},
            )
            if notification.server_id != server.pk:
                return Response({'status': 'rejected', 'detail': 'Unlock event does not match this device.'}, status=409)
            if not created and notification.delivery_status == 'Sent':
                return Response({'status': 'sent', 'detail': 'This unlock alert was already delivered.'})
            if not created and notification.delivery_status == 'Disabled':
                return Response({'status': 'disabled', 'detail': 'Laptop unlock alerts are disabled in account settings.'})
            if (not created and notification.delivery_status == 'Pending'
                    and notification.attempted_at and notification.attempted_at > timezone.now() - timedelta(minutes=10)):
                return Response({'status': 'sending', 'detail': 'This unlock alert is already being delivered.'}, status=202)

            user = server.owner
            use_telegram = bool(user.notify_on_laptop_unlock_telegram)
            logger.info('[NodeBeacon] Telegram unlock alerts enabled: %s', use_telegram)
            is_email_verified = getattr(user, 'email_verified', False) or (bool(user.recipient_email or user.email) and not getattr(user, 'email_unverified_recipient', None))
            use_email = bool(user.notify_on_laptop_unlock and user.enable_email_notifications and is_email_verified)
            logger.info('[NodeBeacon] Email unlock alerts enabled: %s', use_email)

            if use_telegram:
                logger.info('[Telegram] Notification triggered (Windows unlock event).')
                configured = telegram_is_configured()
            if not use_telegram and not use_email:
                notification.delivery_status = 'Disabled'
                notification.save(update_fields=['delivery_status'])
                return Response({'status': 'disabled', 'detail': 'Laptop unlock alerts are disabled in account settings.'})

            if use_telegram and (not user.telegram_chat_id or not configured) and not use_email:
                notification.delivery_status = 'Failed'
                notification.save(update_fields=['delivery_status'])
                return Response({'status': 'failed', 'detail': 'Telegram is not connected or configured. Connect Telegram in NodeBeacon settings.'}, status=503)

            if use_email and not email_delivery_is_configured() and not use_telegram:
                notification.delivery_status = 'Failed'
                notification.save(update_fields=['delivery_status'])
                return Response({'status': 'failed', 'detail': 'Email is not configured. Add the backend SMTP settings before enabling unlock alerts.'}, status=503)

            notification.delivery_status = 'Pending'
            notification.attempted_at = timezone.now()
            notification.save(update_fields=['delivery_status', 'attempted_at'])

        errors = []
        sent_channels = []

        if use_telegram:
            try:
                from users.telegram_service import send_telegram_message
                logger.info('[NodeBeacon] Sending Telegram unlock notification')
                send_telegram_message(user.telegram_chat_id,
                    f'NodeBeacon alert: {server.name} was unlocked ({server.hostname}).')
                sent_channels.append('Telegram')
                logger.info('[NodeBeacon] Telegram notification sent successfully')
            except Exception as exc:
                logger.warning('[Telegram] Telegram API response: error (%s).', type(exc).__name__)
                errors.append('Telegram')

        if use_email:
            try:
                logger.info('[NodeBeacon] Sending Email unlock notification')
                deliver_laptop_unlock_email(user, server)
                sent_channels.append('email')
                logger.info('[NodeBeacon] Email notification sent successfully')
            except Exception as exc:
                logger.warning('Laptop unlock notification delivery failed (%s).', type(exc).__name__)
                errors.append('email')

        if not sent_channels:
            notification.delivery_status = 'Failed'
            notification.save(update_fields=['delivery_status'])
            detail = 'Email delivery failed. Check backend SMTP settings and the recipient address.' if use_email and not use_telegram else 'Telegram delivery failed. Check the bot setup and Telegram connection.'
            return Response({'status': 'failed', 'detail': detail}, status=503)

        notification.delivery_status = 'Sent'
        notification.delivered_at = timezone.now()
        notification.save(update_fields=['delivery_status', 'delivered_at'])
        channel_str = ' and '.join(sent_channels)
        return Response({'status': 'sent', 'detail': f'Unlock alert sent by {channel_str}.'}, status=status.HTTP_200_OK)
