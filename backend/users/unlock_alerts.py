"""Deliver a single laptop-unlock email to the enrolled device's owner."""
from django.conf import settings
from django.core.mail import send_mail


def email_delivery_is_configured():
    backend = getattr(settings, 'EMAIL_BACKEND', '')
    if 'locmem' in backend or 'console' in backend:
        return True
    return (
        backend == 'django.core.mail.backends.smtp.EmailBackend'
        and bool(getattr(settings, 'EMAIL_HOST', ''))
        and bool(getattr(settings, 'EMAIL_HOST_USER', ''))
        and bool(getattr(settings, 'EMAIL_HOST_PASSWORD', ''))
    )


def deliver_laptop_unlock_email(user, server):
    recipient = (user.recipient_email or user.email).strip()
    if not recipient:
        raise ValueError('Set a recipient email in Settings before enabling unlock alerts.')
    send_mail(
        subject=f'NodeBeacon: {server.name} was unlocked',
        message=(f'Your NodeBeacon monitored laptop "{server.name}" ({server.hostname}) was unlocked.\n\n'
                 'This alert was sent by NodeBeacon because laptop-unlock notifications are enabled.'),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient],
        fail_silently=False,
    )
