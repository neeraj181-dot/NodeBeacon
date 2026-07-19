from django.utils import timezone
from alerts.models import Alert
from servers.models import Server

def evaluate_metrics_alerts(metric):
    """
    Evaluates system metric values against configured threshold rules:
    - CPU Usage > 90%
    - Memory Usage > 90%
    - Disk Usage > 95%
    Fires active alerts if thresholds are exceeded, and resolves them if they return to normal.
    """
    server = metric.server

    # 1. CPU Usage Alert Evaluation (> 90%)
    cpu_title = "High CPU Usage"
    cpu_alert = Alert.objects.filter(server=server, title=cpu_title, status='Active').first()
    if metric.cpu_usage > 90.0:
        if not cpu_alert:
            Alert.objects.create(
                server=server,
                metric=metric,
                title=cpu_title,
                description=f"CPU usage is {metric.cpu_usage}%, exceeding the critical 90% limit.",
                severity='Critical',
                status='Active'
            )
    else:
        if cpu_alert:
            cpu_alert.status = 'Resolved'
            cpu_alert.resolved_at = timezone.now()
            cpu_alert.save(update_fields=['status', 'resolved_at'])

    # 2. Memory Usage Alert Evaluation (> 90%)
    mem_title = "High Memory Usage"
    mem_alert = Alert.objects.filter(server=server, title=mem_title, status='Active').first()
    if metric.memory_usage > 90.0:
        if not mem_alert:
            Alert.objects.create(
                server=server,
                metric=metric,
                title=mem_title,
                description=f"Memory usage is {metric.memory_usage}%, exceeding the critical 90% limit.",
                severity='Critical',
                status='Active'
            )
    else:
        if mem_alert:
            mem_alert.status = 'Resolved'
            mem_alert.resolved_at = timezone.now()
            mem_alert.save(update_fields=['status', 'resolved_at'])

    # 3. Disk Usage Alert Evaluation (> 95%)
    disk_title = "High Disk Usage"
    disk_alert = Alert.objects.filter(server=server, title=disk_title, status='Active').first()
    if metric.disk_usage > 95.0:
        if not disk_alert:
            Alert.objects.create(
                server=server,
                metric=metric,
                title=disk_title,
                description=f"Disk space usage is {metric.disk_usage}%, exceeding the critical 95% limit.",
                severity='Critical',
                status='Active'
            )
    else:
        if disk_alert:
            disk_alert.status = 'Resolved'
            disk_alert.resolved_at = timezone.now()
            disk_alert.save(update_fields=['status', 'resolved_at'])

    # 4. Resolve "Server Offline" alert if active since the server has sent a new metric
    offline_title = "Server Offline"
    offline_alert = Alert.objects.filter(server=server, title=offline_title, status='Active').first()
    if offline_alert:
        offline_alert.status = 'Resolved'
        offline_alert.resolved_at = timezone.now()
        offline_alert.save(update_fields=['status', 'resolved_at'])

    # 5. Check and trigger other offline nodes
    check_and_trigger_offline_servers()


def check_and_trigger_offline_servers():
    """
    Scans for Online servers whose heartbeat 'last_seen' is older than 60 seconds.
    Marks them as 'Offline' and creates a Critical "Server Offline" alert.
    """
    cutoff = timezone.now() - timezone.timedelta(seconds=60)
    
    # Get servers which are currently marked 'Online' but haven't reported in over 60s
    offline_servers = Server.objects.filter(
        status='Online',
        last_seen__lt=cutoff
    )
    
    for server in offline_servers:
        server.status = 'Offline'
        server.save(update_fields=['status', 'updated_at'])

        offline_title = "Server Offline"
        # Prevent creating duplicate active alerts
        if not Alert.objects.filter(server=server, title=offline_title, status='Active').exists():
            Alert.objects.create(
                server=server,
                title=offline_title,
                description=f"No metrics received for more than 60 seconds. Last heartbeat: {server.last_seen}",
                severity='Critical',
                status='Active'
            )
