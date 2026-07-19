from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from alerts.models import Alert
from servers.models import Server

import logging
logger = logging.getLogger(__name__)

def send_alert_email(user, server, title, description, metric=None):
    if not user.enable_email_notifications:
        return

    # Check if user has an organization
    recipients = []
    if user.role in ['ORGANIZATION_ADMIN', 'MEMBER'] and user.organization:
        org = user.organization
        # Primary alert email
        if org.alert_email:
            recipients.append(org.alert_email)
        # Additional alert recipients
        if org.alert_recipients:
            extra_recipients = [e.strip() for e in org.alert_recipients.split(',') if e.strip()]
            recipients.extend(extra_recipients)
    else:
        # Individual account routing
        rec = user.recipient_email or user.email
        if rec:
            recipients.append(rec)

    # Remove duplicates
    recipients = list(set(recipients))
    if not recipients:
        return

    subject = f"🚨 NodeBeacon Alert - {title}"
    
    # HTML formatted email template with NodeBeacon branding and details
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          background-color: #070707;
          color: #F4F4F4;
          margin: 0;
          padding: 20px;
        }}
        .container {{
          max-width: 600px;
          background-color: #101010;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 30px;
          margin: 0 auto;
        }}
        .header {{
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding-bottom: 15px;
          margin-bottom: 20px;
        }}
        .logo {{
          font-size: 20px;
          font-weight: bold;
          color: #FFFFFF;
        }}
        .accent {{
          color: #57E389;
        }}
        .title {{
          font-size: 24px;
          font-weight: bold;
          color: #FF5F57;
          margin: 15px 0;
        }}
        .table-info {{
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }}
        .table-info td {{
          padding: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 14px;
        }}
        .label {{
          color: #8A8A8A;
          font-weight: 500;
          width: 150px;
        }}
        .value {{
          color: #FFFFFF;
        }}
        .btn {{
          display: inline-block;
          background-color: #57E389;
          color: #070707 !important;
          text-decoration: none;
          font-weight: bold;
          font-size: 13px;
          padding: 12px 24px;
          border-radius: 8px;
          margin-top: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }}
        .footer {{
          margin-top: 30px;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 15px;
          font-size: 11px;
          color: #8A8A8A;
          text-align: center;
          line-height: 1.5;
        }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="logo">Node<span class="accent">Beacon</span></span>
        </div>
        <div class="title">🚨 {title}</div>
        <p style="font-size: 14px; color: #E0E0E0; line-height: 1.5;">{description}</p>
        
        <table class="table-info">
          <tr>
            <td class="label">Server Name</td>
            <td class="value">{server.name}</td>
          </tr>
          <tr>
            <td class="label">Hostname</td>
            <td class="value">{server.hostname}</td>
          </tr>
          <tr>
            <td class="label">Operating System</td>
            <td class="value">{server.operating_system}</td>
          </tr>
          <tr>
            <td class="label">IP Address</td>
            <td class="value">{server.ip_address}</td>
          </tr>
          <tr>
            <td class="label">CPU Usage</td>
            <td class="value">{metric.cpu_usage if metric else '—'}%</td>
          </tr>
          <tr>
            <td class="label">Memory Usage</td>
            <td class="value">{metric.memory_usage if metric else '—'}%</td>
          </tr>
          <tr>
            <td class="label">Disk Usage</td>
            <td class="value">{metric.disk_usage if metric else '—'}%</td>
          </tr>
          <tr>
            <td class="label">Triggered Time</td>
            <td class="value">{timezone.now().strftime('%Y-%m-%d %H:%M:%S UTC')}</td>
          </tr>
          <tr>
            <td class="label">Severity</td>
            <td class="value" style="color: #FF5F57; font-weight: bold;">Critical</td>
          </tr>
        </table>
        
        <div style="text-align: center;">
          <a href="http://127.0.0.1:5173" class="btn">View Dashboard</a>
        </div>
        
        <div class="footer">
          This message was automatically generated by NodeBeacon Infrastructure Monitoring.<br>
          &copy; 2026 NodeBeacon. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

    # Plaintext fallback body
    text_content = (
        f"🚨 NodeBeacon Alert - {title}\n\n"
        f"Description: {description}\n\n"
        f"Server Name: {server.name}\n"
        f"Hostname: {server.hostname}\n"
        f"Operating System: {server.operating_system}\n"
        f"IP Address: {server.ip_address}\n"
        f"CPU: {metric.cpu_usage if metric else '—'}%\n"
        f"Memory: {metric.memory_usage if metric else '—'}%\n"
        f"Disk: {metric.disk_usage if metric else '—'}%\n"
        f"Triggered Time: {timezone.now().strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
        f"Severity: Critical\n\n"
        f"View Dashboard: http://127.0.0.1:5173\n\n"
        f"This message was automatically generated by NodeBeacon Infrastructure Monitoring."
    )

    try:
        from django.core.mail import EmailMultiAlternatives
        from_email = getattr(settings, 'EMAIL_HOST_USER', 'noreply@nodebeacon.net') or 'noreply@nodebeacon.net'
        msg = EmailMultiAlternatives(subject, text_content, from_email, recipients)
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        logger.info(f"NodeBeacon alert email dispatched successfully to {recipients} for {server.name}")
    except Exception as e:
        logger.error(f"Failed to dispatch alert email to {recipient}: {e}", exc_info=True)

def evaluate_metrics_alerts(metric):
    """
    Evaluates system metric values against user-configured threshold rules.
    Fires active alerts and resolves them when conditions return to normal.
    """
    server = metric.server
    user = server.owner
    
    cpu_limit = user.cpu_threshold
    mem_limit = user.memory_threshold
    disk_limit = user.disk_threshold

    # 1. CPU Usage Alert
    cpu_title = "High CPU Usage"
    cpu_alert = Alert.objects.filter(server=server, title=cpu_title, status='Active').first()
    if metric.cpu_usage > cpu_limit:
        if not cpu_alert:
            desc = f"CPU usage is {metric.cpu_usage}%, exceeding the critical {cpu_limit}% limit."
            Alert.objects.create(
                server=server,
                metric=metric,
                title=cpu_title,
                description=desc,
                severity='Critical',
                status='Active'
            )
            send_alert_email(user, server, cpu_title, desc, metric)
    else:
        if cpu_alert:
            cpu_alert.status = 'Resolved'
            cpu_alert.resolved_at = timezone.now()
            cpu_alert.save(update_fields=['status', 'resolved_at'])

    # 2. Memory Usage Alert
    mem_title = "High Memory Usage"
    mem_alert = Alert.objects.filter(server=server, title=mem_title, status='Active').first()
    if metric.memory_usage > mem_limit:
        if not mem_alert:
            desc = f"Memory usage is {metric.memory_usage}%, exceeding the critical {mem_limit}% limit."
            Alert.objects.create(
                server=server,
                metric=metric,
                title=mem_title,
                description=desc,
                severity='Critical',
                status='Active'
            )
            send_alert_email(user, server, mem_title, desc, metric)
    else:
        if mem_alert:
            mem_alert.status = 'Resolved'
            mem_alert.resolved_at = timezone.now()
            mem_alert.save(update_fields=['status', 'resolved_at'])

    # 3. Disk Usage Alert
    disk_title = "Disk Usage Critical"
    disk_alert = Alert.objects.filter(server=server, title=disk_title, status='Active').first()
    if metric.disk_usage > disk_limit:
        if not disk_alert:
            desc = f"Disk space usage is {metric.disk_usage}%, exceeding the critical {disk_limit}% limit."
            Alert.objects.create(
                server=server,
                metric=metric,
                title=disk_title,
                description=desc,
                severity='Critical',
                status='Active'
            )
            send_alert_email(user, server, disk_title, desc, metric)
    else:
        if disk_alert:
            disk_alert.status = 'Resolved'
            disk_alert.resolved_at = timezone.now()
            disk_alert.save(update_fields=['status', 'resolved_at'])

    # 4. Resolve "Server Offline" if active
    offline_title = "Server Offline"
    offline_alert = Alert.objects.filter(server=server, title=offline_title, status='Active').first()
    if offline_alert:
        offline_alert.status = 'Resolved'
        offline_alert.resolved_at = timezone.now()
        offline_alert.save(update_fields=['status', 'resolved_at'])

    # 5. Check other offline nodes
    check_and_trigger_offline_servers(user)

def check_and_trigger_offline_servers(user=None):
    """
    Scans for Online servers whose heartbeat 'last_seen' is older than user threshold timeout limit.
    """
    if user:
        users = [user]
    else:
        from django.contrib.auth import get_user_model
        users = get_user_model().objects.all()

    for u in users:
        timeout = u.heartbeat_timeout
        cutoff = timezone.now() - timezone.timedelta(seconds=timeout)
        
        offline_servers = Server.objects.filter(
            owner=u,
            status='Online',
            last_seen__lt=cutoff
        )
        
        for server in offline_servers:
            server.status = 'Offline'
            server.save(update_fields=['status', 'updated_at'])

            offline_title = "Server Offline"
            if not Alert.objects.filter(server=server, title=offline_title, status='Active').exists():
                desc = f"No metrics received for more than {timeout} seconds. Last heartbeat: {server.last_seen}"
                Alert.objects.create(
                    server=server,
                    title=offline_title,
                    description=desc,
                    severity='Critical',
                    status='Active'
                )
                send_alert_email(u, server, offline_title, desc)
