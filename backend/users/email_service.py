"""Reusable email notification service for NodeBeacon.

Handles email verification, test notifications, Windows session unlock alerts,
and system threshold incidents with HTML templates and safe delivery.
"""
import hashlib
import logging
import threading
from datetime import timedelta
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone

logger = logging.getLogger(__name__)


def email_delivery_is_configured():
    """Verify whether backend email delivery is properly configured."""
    backend = getattr(settings, 'EMAIL_BACKEND', '')
    if 'locmem' in backend or 'console' in backend:
        return True
    return (
        backend == 'django.core.mail.backends.smtp.EmailBackend'
        and bool(getattr(settings, 'EMAIL_HOST', ''))
        and bool(getattr(settings, 'EMAIL_HOST_USER', ''))
        and bool(getattr(settings, 'EMAIL_HOST_PASSWORD', ''))
    )


def is_user_email_verified(user):
    """Check if the user has a verified email address for notifications."""
    if not user:
        return False
    if getattr(user, 'email_verified', False):
        return True
    # If recipient_email is set and there is no pending unverified recipient or verification hash
    has_recipient = bool(getattr(user, 'recipient_email', ''))
    has_pending = bool(getattr(user, 'email_unverified_recipient', '')) or bool(getattr(user, 'email_verification_token_hash', ''))
    return has_recipient and not has_pending


def dispatch_email(msg, async_send=None):
    """
    Deliver an email message. In testing environments (locmem), delivery is synchronous.
    In live execution, delivery is asynchronous so it does not block monitoring or API requests.
    """
    backend = getattr(settings, 'EMAIL_BACKEND', '')
    if async_send is None:
        async_send = 'locmem' not in backend

    if not async_send:
        return msg.send(fail_silently=False)

    def _worker():
        try:
            msg.send(fail_silently=False)
            logger.info("Email delivered successfully to %s", msg.to)
        except Exception as exc:
            logger.warning("Asynchronous email delivery failed to %s (%s).", msg.to, type(exc).__name__)

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
    return 1


def send_verification_email(user, target_email, code, verification_link):
    """
    Sends an email containing a secure 6-digit verification code and verification link.
    """
    if not email_delivery_is_configured():
        raise RuntimeError("SMTP email delivery is not configured on the backend.")

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@nodebeacon.net')
    subject = "NodeBeacon: Verify your email address"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #070707; color: #F4F4F4; margin: 0; padding: 24px; }}
    .card {{ max-width: 540px; margin: 0 auto; background-color: #111111; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }}
    .logo {{ font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px; }}
    .logo-accent {{ color: #57E389; }}
    .title {{ font-size: 20px; font-weight: 700; color: #FFFFFF; margin: 24px 0 12px; }}
    .text {{ font-size: 14px; line-height: 1.6; color: #A1A1AA; margin: 0 0 20px; }}
    .code-box {{ background-color: #18181B; border: 1px solid rgba(87,227,137,0.3); border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }}
    .code-label {{ font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #71717A; margin-bottom: 6px; font-weight: 600; }}
    .code-value {{ font-family: 'SF Mono', Monaco, Inconsolata, 'Fira Code', monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #57E389; margin: 0; }}
    .btn {{ display: inline-block; background-color: #57E389; color: #072111 !important; text-decoration: none; font-weight: 700; font-size: 13px; padding: 12px 24px; border-radius: 10px; margin: 12px 0 20px; letter-spacing: 0.3px; }}
    .footer {{ border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; margin-top: 28px; font-size: 11px; color: #71717A; line-height: 1.5; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Node<span class="logo-accent">Beacon</span></div>
    <h1 class="title">Verify your email address</h1>
    <p class="text">You requested to connect <strong>{target_email}</strong> to receive NodeBeacon infrastructure alerts and notifications.</p>
    
    <div class="code-box">
      <div class="code-label">Verification Code</div>
      <div class="code-value">{code}</div>
    </div>

    <p class="text">Enter this 6-digit code in the NodeBeacon Integrations tab, or click the button below to verify immediately:</p>
    <div style="text-align: center;">
      <a href="{verification_link}" class="btn">Verify Email Address</a>
    </div>

    <div class="footer">
      This code is valid for 15 minutes. If you did not request this verification, you can safely ignore this email.<br>
      &copy; {timezone.now().year} NodeBeacon Infrastructure Monitoring.
    </div>
  </div>
</body>
</html>"""

    text_content = (
        f"NodeBeacon Email Verification\n\n"
        f"You requested to connect {target_email} for NodeBeacon notifications.\n\n"
        f"Your 6-digit verification code: {code}\n\n"
        f"Or verify via link: {verification_link}\n\n"
        f"This code expires in 15 minutes.\n"
    )

    msg = EmailMultiAlternatives(subject, text_content, from_email, [target_email])
    msg.attach_alternative(html_content, "text/html")
    return dispatch_email(msg)


def send_test_email(user, recipient=None):
    """
    Sends an authenticated test notification email to confirm delivery.
    """
    if not email_delivery_is_configured():
        raise RuntimeError("SMTP email delivery is not configured on the backend.")

    target = recipient or user.recipient_email or user.email
    if not target:
        raise ValueError("No recipient email address configured.")

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@nodebeacon.net')
    subject = "NodeBeacon: Test Notification"

    offline_status = "Enabled" if getattr(user, 'notify_offline_email', True) else "Disabled"
    critical_status = "Enabled" if getattr(user, 'notify_critical_email', True) else "Disabled"
    unlock_status = "Enabled" if getattr(user, 'notify_on_laptop_unlock', False) else "Disabled"
    now_str = timezone.now().strftime('%Y-%m-%d %H:%M:%S UTC')

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #070707; color: #F4F4F4; margin: 0; padding: 24px; }}
    .card {{ max-width: 540px; margin: 0 auto; background-color: #111111; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; }}
    .logo {{ font-size: 20px; font-weight: 800; color: #FFFFFF; }}
    .logo-accent {{ color: #57E389; }}
    .title {{ font-size: 18px; font-weight: 700; color: #57E389; margin: 20px 0 10px; }}
    .text {{ font-size: 14px; line-height: 1.5; color: #A1A1AA; margin: 0 0 16px; }}
    .table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
    .table td {{ padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }}
    .label {{ color: #71717A; width: 180px; font-weight: 500; }}
    .val {{ color: #FFFFFF; font-weight: 600; }}
    .status-badge {{ display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: rgba(87,227,137,0.15); color: #57E389; }}
    .footer {{ border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; margin-top: 24px; font-size: 11px; color: #71717A; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Node<span class="logo-accent">Beacon</span></div>
    <h2 class="title">Test Notification</h2>
    <p class="text">This is a test notification from NodeBeacon. If you received this message, your email integration is connected and functioning properly.</p>
    
    <table class="table">
      <tr><td class="label">Recipient</td><td class="val">{target}</td></tr>
      <tr><td class="label">Delivered At</td><td class="val">{now_str}</td></tr>
      <tr><td class="label">Server Offline Alerts</td><td class="val">{offline_status}</td></tr>
      <tr><td class="label">Critical System Alerts</td><td class="val">{critical_status}</td></tr>
      <tr><td class="label">Windows Unlock Alerts</td><td class="val">{unlock_status}</td></tr>
      <tr><td class="label">Delivery Status</td><td class="val"><span class="status-badge">Active</span></td></tr>
    </table>

    <div class="footer">
      NodeBeacon Infrastructure Monitoring &copy; {timezone.now().year}
    </div>
  </div>
</body>
</html>"""

    text_content = (
        f"NodeBeacon Test Notification\n\n"
        f"Your email notifications integration is connected and operating properly.\n\n"
        f"Recipient: {target}\n"
        f"Delivered At: {now_str}\n"
        f"Server Offline Alerts: {offline_status}\n"
        f"Critical System Alerts: {critical_status}\n"
        f"Windows Unlock Alerts: {unlock_status}\n"
    )

    msg = EmailMultiAlternatives(subject, text_content, from_email, [target])
    msg.attach_alternative(html_content, "text/html")
    return dispatch_email(msg)


def deliver_laptop_unlock_email(user, server, event_time=None, event_type="Windows Session Unlock"):
    """
    Sends a secure laptop unlock alert to the server owner's verified recipient email.
    Includes device name, hostname, OS, IP, and event timestamp without secrets.
    """
    recipient = (user.recipient_email or user.email or '').strip()
    if not recipient:
        raise ValueError('No recipient email configured for unlock alerts.')

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@nodebeacon.net')
    subject = f"🚨 NodeBeacon Security: {server.name} was unlocked"

    event_time_str = (event_time or timezone.now()).strftime('%Y-%m-%d %H:%M:%S UTC')

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #070707; color: #F4F4F4; margin: 0; padding: 24px; }}
    .card {{ max-width: 540px; margin: 0 auto; background-color: #111111; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; }}
    .logo {{ font-size: 20px; font-weight: 800; color: #FFFFFF; }}
    .logo-accent {{ color: #57E389; }}
    .alert-header {{ display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; color: #F59E0B; margin: 20px 0 10px; }}
    .text {{ font-size: 14px; line-height: 1.5; color: #A1A1AA; margin: 0 0 16px; }}
    .table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
    .table td {{ padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }}
    .label {{ color: #71717A; width: 160px; font-weight: 500; }}
    .val {{ color: #FFFFFF; font-weight: 600; }}
    .footer {{ border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; margin-top: 24px; font-size: 11px; color: #71717A; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Node<span class="logo-accent">Beacon</span></div>
    <div class="alert-header">⚠️ Device Unlock Detected</div>
    <p class="text">Your monitored device <strong>{server.name}</strong> was unlocked.</p>
    
    <table class="table">
      <tr><td class="label">Device Name</td><td class="val">{server.name}</td></tr>
      <tr><td class="label">Hostname</td><td class="val">{server.hostname}</td></tr>
      <tr><td class="label">Operating System</td><td class="val">{server.operating_system}</td></tr>
      <tr><td class="label">IP Address</td><td class="val">{server.ip_address}</td></tr>
      <tr><td class="label">Event Type</td><td class="val">{event_type}</td></tr>
      <tr><td class="label">Event Time</td><td class="val">{event_time_str}</td></tr>
    </table>

    <div class="footer">
      Sent by NodeBeacon Physical Device Surveillance.<br>
      If this was not you, inspect your device immediately.
    </div>
  </div>
</body>
</html>"""

    text_content = (
        f"🚨 NodeBeacon Security Alert: {server.name} was unlocked\n\n"
        f"Your monitored device '{server.name}' was unlocked.\n\n"
        f"Device Name: {server.name}\n"
        f"Hostname: {server.hostname}\n"
        f"Operating System: {server.operating_system}\n"
        f"IP Address: {server.ip_address}\n"
        f"Event Type: {event_type}\n"
        f"Event Time: {event_time_str}\n"
    )

    msg = EmailMultiAlternatives(subject, text_content, from_email, [recipient])
    msg.attach_alternative(html_content, "text/html")
    return dispatch_email(msg)
