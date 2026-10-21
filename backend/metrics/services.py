from datetime import datetime, timedelta, time
from django.utils import timezone
from django.db.models import Min, Max, Avg
from django.db.models.functions import TruncDate
from servers.models import Server
from metrics.models import Metric
from alerts.models import Alert

def get_reporting_window(period='7d', start_date_str=None, end_date_str=None):
    """
    Computes (window_start, window_end, period_key) using the configured application timezone.
    By default: calculates the reporting window as the latest 7 calendar days, ending today.
    (From the start of the date 6 days before today through the end of today).
    """
    current_tz = timezone.get_current_timezone()
    now_tz = timezone.localtime(timezone.now(), current_tz)
    today = now_tz.date()

    if period == '24h':
        window_start = now_tz - timedelta(hours=24)
        window_end = now_tz
        period_key = '24h'
    elif period == '30d':
        start_date = today - timedelta(days=29)
        window_start = timezone.make_aware(datetime.combine(start_date, time.min), current_tz)
        window_end = timezone.make_aware(datetime.combine(today, time.max), current_tz)
        period_key = '30d'
    elif period == 'custom' or (start_date_str and end_date_str):
        if isinstance(start_date_str, str):
            start_date = datetime.strptime(start_date_str.strip()[:10], '%Y-%m-%d').date()
        else:
            start_date = start_date_str
        if isinstance(end_date_str, str):
            end_date = datetime.strptime(end_date_str.strip()[:10], '%Y-%m-%d').date()
        else:
            end_date = end_date_str
        
        if start_date > end_date:
            start_date, end_date = end_date, start_date

        window_start = timezone.make_aware(datetime.combine(start_date, time.min), current_tz)
        window_end = timezone.make_aware(datetime.combine(end_date, time.max), current_tz)
        period_key = 'custom'
    else:
        # Default: latest 7 calendar days ending today (6 days before today through end of today)
        start_date = today - timedelta(days=6)
        window_start = timezone.make_aware(datetime.combine(start_date, time.min), current_tz)
        window_end = timezone.make_aware(datetime.combine(today, time.max), current_tz)
        period_key = '7d'

    return window_start, window_end, period_key


def get_report_data(user, period='7d', start_date_str=None, end_date_str=None):
    """
    Retrieves and calculates all report data for the given user and reporting window.
    Determines the actual coverage period using real monitoring records in the window.
    Calculates report metrics strictly from records within the selected window.
    """
    current_tz = timezone.get_current_timezone()
    window_start, window_end, period_key = get_reporting_window(period, start_date_str, end_date_str)

    # Resolve servers, metrics, and alerts for the user/organization
    if user.role in ['ORGANIZATION_ADMIN', 'MEMBER'] and user.organization:
        servers = Server.objects.filter(organization=user.organization)
        user_metrics = Metric.objects.filter(server__organization=user.organization)
        alerts = Alert.objects.filter(server__organization=user.organization)
    else:
        servers = Server.objects.filter(owner=user)
        user_metrics = Metric.objects.filter(server__owner=user)
        alerts = Alert.objects.filter(server__owner=user)

    total_servers = servers.count()
    online_servers = servers.filter(status='Online').count()
    offline_servers = total_servers - online_servers

    # Query monitoring records strictly within the window
    period_metrics = user_metrics.filter(timestamp__gte=window_start, timestamp__lte=window_end)
    has_data = period_metrics.exists()

    if not has_data:
        return {
            'selected_period': period_key,
            'window_start': window_start.isoformat(),
            'window_end': window_end.isoformat(),
            'has_data': False,
            'coverage_start': None,
            'coverage_end': None,
            'coverage_label': 'NO MONITORING DATA AVAILABLE',
            'report_period_str': 'NO MONITORING DATA AVAILABLE',
            'metrics_count': 0,
            'avg_cpu': 0.0,
            'avg_memory': 0.0,
            'avg_disk': 0.0,
            'peak_cpu': 0.0,
            'peak_server': 'None',
            'fleet_uptime': '—' if total_servers == 0 else f"{round((online_servers / total_servers) * 100, 2)}%",
            'audited_hours': 0,
            'incidents_count': 0,
            'cpu_trends': [],
            'incidents': [],
            'period_metrics': period_metrics,
            'servers': servers,
            'alerts': alerts.none(),
            'active_alerts': 0,
        }

    # Determine earliest and latest actual monitoring records within the window
    agg = period_metrics.aggregate(min_t=Min('timestamp'), max_t=Max('timestamp'))
    earliest_ts = agg['min_t']
    latest_ts = agg['max_t']
    earliest_date = timezone.localtime(earliest_ts, current_tz).date()
    latest_date = timezone.localtime(latest_ts, current_tz).date()

    if earliest_date == latest_date:
        coverage_label = earliest_date.strftime('%b %d, %Y')
    else:
        coverage_label = f"{earliest_date.strftime('%b %d, %Y')} - {latest_date.strftime('%b %d, %Y')}"

    # Calculate metrics strictly from period_metrics (never reuse stale cached metrics)
    metrics_count = period_metrics.count()
    avg_cpu = round(sum(m.cpu_usage for m in period_metrics) / metrics_count, 1)
    avg_mem = round(sum(m.memory_usage for m in period_metrics) / metrics_count, 1)
    avg_disk = round(sum(m.disk_usage for m in period_metrics) / metrics_count, 1)

    peak_metric = period_metrics.order_by('-cpu_usage').first()
    peak_cpu = round(peak_metric.cpu_usage, 1) if peak_metric else 0.0
    peak_server = peak_metric.server.name if (peak_metric and peak_metric.server) else 'None'

    uptime_pct = f"{round((online_servers / total_servers) * 100, 2)}%" if total_servers > 0 else "100%"
    audited_hours = max(1, int(round((window_end - window_start).total_seconds() / 3600)))

    period_alerts = alerts.filter(created_at__gte=window_start, created_at__lte=window_end)
    incidents_count = period_alerts.count()
    active_alerts = period_alerts.filter(status='Active').count()

    # Daily CPU trends for chart: iterate over each day in coverage period, representing missing days with None
    daily_stats = (
        period_metrics.annotate(date=TruncDate('timestamp'))
        .values('date')
        .annotate(avg_cpu=Avg('cpu_usage'))
        .order_by('date')
    )
    daily_map = {}
    for d in daily_stats:
        day_date = d['date']
        if isinstance(day_date, str):
            day_date = datetime.strptime(day_date, '%Y-%m-%d').date()
        daily_map[day_date] = round(d['avg_cpu'], 1)

    cpu_trends = []
    curr_d = earliest_date
    while curr_d <= latest_date:
        cpu_trends.append({
            'day': curr_d.strftime('%a'),
            'date': curr_d.strftime('%Y-%m-%d'),
            'CPU': daily_map.get(curr_d, None),
        })
        curr_d += timedelta(days=1)

    # Incidents details list
    incidents_list = []
    for a in period_alerts[:10]:
        incidents_list.append({
            'id': a.id,
            'title': f"{a.severity}: {a.server.name} {a.title.lower()}",
            'severity': a.severity,
            'status': a.status.lower(),
        })

    return {
        'selected_period': period_key,
        'window_start': window_start.isoformat(),
        'window_end': window_end.isoformat(),
        'has_data': True,
        'coverage_start': earliest_date.isoformat(),
        'coverage_end': latest_date.isoformat(),
        'coverage_label': coverage_label,
        'report_period_str': coverage_label,
        'earliest_ts': earliest_ts,
        'latest_ts': latest_ts,
        'metrics_count': metrics_count,
        'avg_cpu': avg_cpu,
        'avg_memory': avg_mem,
        'avg_disk': avg_disk,
        'peak_cpu': peak_cpu,
        'peak_server': peak_server,
        'fleet_uptime': uptime_pct,
        'audited_hours': audited_hours,
        'incidents_count': incidents_count,
        'active_alerts': active_alerts,
        'cpu_trends': cpu_trends,
        'incidents': incidents_list,
        'period_metrics': period_metrics,
        'servers': servers,
        'alerts': period_alerts,
    }
