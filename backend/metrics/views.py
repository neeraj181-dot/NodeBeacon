from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from servers.models import Server
from metrics.models import Metric
from metrics.serializers import MetricSerializer
from metrics.authentication import AgentAPIKeyAuthentication
from metrics.permissions import IsAgent

class MetricsListCreateView(generics.ListCreateAPIView):
    """
    POST /api/metrics/ - Agent submits server metrics (API Key auth)
    GET /api/metrics/ - User lists all server metrics (JWT auth)
    """
    serializer_class = MetricSerializer

    def get_authenticators(self):
        if self.request and self.request.method == 'POST':
            return [AgentAPIKeyAuthentication()]
        return super().get_authenticators()

    def get_permissions(self):
        if self.request and self.request.method == 'POST':
            return [IsAgent()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role in ['ORGANIZATION_ADMIN', 'MEMBER'] and user.organization:
            qs = Metric.objects.filter(server__organization=user.organization)
        else:
            qs = Metric.objects.filter(server__owner=user)

        period = self.request.query_params.get('period')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if period or (start_date and end_date):
            from metrics.services import get_reporting_window
            window_start, window_end, _ = get_reporting_window(period, start_date, end_date)
            qs = qs.filter(timestamp__gte=window_start, timestamp__lte=window_end)

        return qs.order_by('-timestamp', '-pk')

    def perform_create(self, serializer):
        server = self.request.auth  # Server instance resolved by API Key auth
        metric = serializer.save(server=server)
        
        # Update server status and timestamp
        server.status = 'Online'
        server.last_seen = timezone.now()
        
        # Update server metadata if provided in request payload (auto-detected from agent)
        agent_os = self.request.data.get('operating_system')
        agent_hostname = self.request.data.get('hostname')
        
        # Resolve client IP
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else self.request.META.get('REMOTE_ADDR')
        
        update_fields = ['status', 'last_seen', 'updated_at']
        
        if agent_os and server.operating_system != agent_os:
            server.operating_system = agent_os
            update_fields.append('operating_system')
            
        if agent_hostname and server.hostname != agent_hostname:
            server.hostname = agent_hostname
            update_fields.append('hostname')
            
        if ip and ip != '127.0.0.1' and server.ip_address != ip:
            server.ip_address = ip
            update_fields.append('ip_address')
            
        server.save(update_fields=update_fields)

        # Evaluate alert rules for the newly stored metric
        from alerts.services import evaluate_metrics_alerts
        evaluate_metrics_alerts(metric)



    def create(self, request, *args, **kwargs):
        super().create(request, *args, **kwargs)
        return Response(
            {"message": "Metric stored successfully."},
            status=status.HTTP_201_CREATED
        )


class ServerMetricsListView(generics.ListAPIView):
    """
    GET /api/servers/{server_id}/metrics/
    Endpoint to retrieve historical metrics for a specific server.
    Requires JWT authentication.
    """
    serializer_class = MetricSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        server_id = self.kwargs.get('server_id')
        user = self.request.user
        if user.role in ['ORGANIZATION_ADMIN', 'MEMBER'] and user.organization:
            server = get_object_or_404(Server, id=server_id, organization=user.organization)
        else:
            server = get_object_or_404(Server, id=server_id, owner=user)
        
        queryset = Metric.objects.filter(server=server).order_by('-timestamp', '-pk')
        
        # Support limit parameter
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                limit = int(limit)
                if limit > 0:
                    queryset = queryset[:limit]
            except ValueError:
                pass  # Ignore invalid limit parameters
                
        return queryset


class ReportDataView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        from metrics.services import get_report_data
        period = request.query_params.get('period', '7d')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        report_data = get_report_data(
            user=request.user,
            period=period,
            start_date_str=start_date,
            end_date_str=end_date,
        )

        data = {
            'selected_period': report_data['selected_period'],
            'window_start': report_data['window_start'],
            'window_end': report_data['window_end'],
            'has_data': report_data['has_data'],
            'coverage_start': report_data['coverage_start'],
            'coverage_end': report_data['coverage_end'],
            'coverage_label': report_data['coverage_label'],
            'report_period_str': report_data['report_period_str'],
            'metrics_count': report_data['metrics_count'],
            'avg_cpu': report_data['avg_cpu'],
            'avg_memory': report_data['avg_memory'],
            'avg_disk': report_data['avg_disk'],
            'peak_cpu': report_data['peak_cpu'],
            'peak_server': report_data['peak_server'],
            'fleet_uptime': report_data['fleet_uptime'],
            'audited_hours': report_data['audited_hours'],
            'incidents_count': report_data['incidents_count'],
            'active_alerts': report_data['active_alerts'],
            'cpu_trends': report_data['cpu_trends'],
            'incidents': report_data['incidents'],
        }
        return Response(data, status=status.HTTP_200_OK)


class ExportPDFReportView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        import io
        import tempfile
        import os
        from datetime import datetime, timedelta
        from django.http import HttpResponse
        from django.utils.timezone import now
        from servers.models import Server
        from metrics.models import Metric
        from alerts.models import Alert
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import matplotlib.dates as mdates
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.pdfgen import canvas

        # Custom NumberedCanvas to dynamically output accurate Page X of Y footers
        class NumberedCanvas(canvas.Canvas):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self._saved_page_states = []

            def showPage(self):
                self._saved_page_states.append(dict(self.__dict__))
                self._startPage()

            def save(self):
                num_pages = len(self._saved_page_states)
                for state in self._saved_page_states:
                    self.__dict__.update(state)
                    self.draw_page_decorations(num_pages)
                    super().showPage()
                super().save()

            def draw_page_decorations(self, page_count):
                self.saveState()
                # Margins are 25px
                margin = 25
                width, height = A4
                
                # Header background band and lines on content pages (skip cover page 1)
                if self._pageNumber > 1:
                    # Top running header bar
                    self.setStrokeColor(colors.HexColor('#1E2836'))
                    self.setLineWidth(0.5)
                    self.line(margin, height - 60, width - margin, height - 60)
                    
                    # Top running text
                    self.setFont('Helvetica-Bold', 8)
                    self.setFillColor(colors.HexColor('#E2E8F0'))
                    self.drawString(margin, height - 50, "NodeBeacon Infrastructure Monitoring")
                    
                    self.setFont('Helvetica', 8)
                    self.setFillColor(colors.HexColor('#94A3B8'))
                    self.drawRightString(width - margin, height - 50, "System Health Report")
                    
                    # Bottom running footer bar
                    self.line(margin, 45, width - margin, 45)
                    self.drawString(margin, 30, "Generated automatically by NodeBeacon")
                    self.drawRightString(width - margin, 30, f"Page {self._pageNumber} of {page_count}")
                self.restoreState()

        def draw_page_background(canvas_obj, document):
            canvas_obj.saveState()
            canvas_obj.setFillColor(colors.HexColor('#0B0F12'))
            canvas_obj.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
            canvas_obj.restoreState()

        from reportlab.lib.units import inch
        import traceback
        import logging
        logger = logging.getLogger(__name__)

        try:
            # 1. Fetch Report Data strictly within the reporting window
            from metrics.services import get_report_data
            period = request.query_params.get('period')
            start_date_param = request.query_params.get('start_date')
            end_date_param = request.query_params.get('end_date')

            report_data = get_report_data(
                user=request.user,
                period=period,
                start_date_str=start_date_param,
                end_date_str=end_date_param
            )

            servers = report_data['servers']
            total_servers = servers.count()
            online_servers = servers.filter(status='Online').count()
            offline_servers = total_servers - online_servers

            avg_cpu = report_data['avg_cpu']
            avg_mem = report_data['avg_memory']
            avg_disk = report_data['avg_disk']
            uptime_pct = report_data['fleet_uptime']
            active_alerts = report_data['active_alerts']
            report_period_str = report_data['report_period_str']
            period_metrics = report_data['period_metrics']

            # 2. Render professional Matplotlib chart to memory (Dark theme matching dashboard)
            import numpy as np
            fig, axes = plt.subplots(2, 2, figsize=(7.4, 4.4), facecolor='#0B0F12')

            # Gap threshold to break lines across missing intervals (no continuous lines across gaps)
            GAP_THRESHOLD = timedelta(minutes=15)

            # General axis styling
            for ax in axes.flat:
                ax.set_facecolor('#11161B')
                ax.grid(True, color='#1E2836', linestyle='--', linewidth=0.5)
                ax.tick_params(colors='#94A3B8', labelsize=7)
                for spine in ax.spines.values():
                    spine.set_color('#1E2836')

            servers_with_data = [s for s in servers if period_metrics.filter(server=s).exists()]

            if servers_with_data:
                # Color palette for servers
                palette = ['#57E389', '#5B8CFF', '#F472B6', '#FBBF24', '#38BDF8', '#A78BFA']
                is_multi = len(servers_with_data) > 1

                all_disks = []
                all_nets = []

                for s_idx, s in enumerate(servers_with_data):
                    s_metrics = list(period_metrics.filter(server=s).order_by('timestamp'))
                    s_color = palette[s_idx % len(palette)]
                    s_label = s.name

                    times = []
                    cpu_vals = []
                    mem_vals = []
                    disk_vals = []
                    net_vals = []

                    for i, m in enumerate(s_metrics):
                        if i > 0:
                            prev_m = s_metrics[i-1]
                            prev_t = prev_m.timestamp
                            curr_t = m.timestamp
                            dt = (curr_t - prev_t).total_seconds()

                            if curr_t - prev_t > GAP_THRESHOLD:
                                # Insert gap marker (NaN) so lines break across missing intervals
                                gap_t = prev_t + (curr_t - prev_t) / 2
                                times.append(gap_t)
                                cpu_vals.append(np.nan)
                                mem_vals.append(np.nan)
                                disk_vals.append(np.nan)
                                net_vals.append(np.nan)

                            # Calculate actual network throughput rate in KB/s from consecutive telemetry
                            if 0 < dt <= GAP_THRESHOLD.total_seconds():
                                din = m.network_in - prev_m.network_in
                                dout = m.network_out - prev_m.network_out
                                if din >= 0 and dout >= 0:
                                    rate_kbps = round((din + dout) / (dt * 1024.0), 1)
                                else:
                                    rate_kbps = 0.0
                            else:
                                rate_kbps = 0.0
                        else:
                            # First metric point rate approximation if subsequent point exists
                            if len(s_metrics) > 1:
                                next_m = s_metrics[1]
                                dt_next = (next_m.timestamp - m.timestamp).total_seconds()
                                if 0 < dt_next <= GAP_THRESHOLD.total_seconds():
                                    din = next_m.network_in - m.network_in
                                    dout = next_m.network_out - m.network_out
                                    rate_kbps = round((din + dout) / (dt_next * 1024.0), 1) if (din >= 0 and dout >= 0) else 0.0
                                else:
                                    rate_kbps = 0.0
                            else:
                                rate_kbps = 0.0

                        times.append(m.timestamp)
                        cpu_vals.append(m.cpu_usage)
                        mem_vals.append(m.memory_usage)
                        disk_vals.append(m.disk_usage)
                        net_vals.append(rate_kbps)
                        all_disks.append(m.disk_usage)
                        all_nets.append(rate_kbps)

                    # Subplot [0, 0]: CPU Trend
                    cpu_c = s_color if is_multi else '#57E389'
                    axes[0, 0].plot(times, cpu_vals, color=cpu_c, linewidth=1.5, label=s_label)

                    # Subplot [0, 1]: Memory Trend
                    mem_c = s_color if is_multi else '#5B8CFF'
                    axes[0, 1].plot(times, mem_vals, color=mem_c, linewidth=1.5, label=s_label)

                    # Subplot [1, 0]: Disk Trend (Preserve actual measurements without artificially lowering)
                    disk_max_s = max([d for d in disk_vals if not np.isnan(d)], default=100.0)
                    disk_c = s_color if is_multi else ('#FFB020' if disk_max_s >= 80 else '#FF5F57')
                    axes[1, 0].plot(times, disk_vals, color=disk_c, linewidth=1.5, label=s_label)

                    # Subplot [1, 1]: Network Activity Trend (Actual KB/s)
                    net_c = s_color if is_multi else '#A78BFA'
                    axes[1, 1].plot(times, net_vals, color=net_c, linewidth=1.5, label=s_label)

                # Set Titles and Limits
                axes[0, 0].set_title('CPU Load Trend (%)', fontsize=8, color='#FFFFFF', weight='bold')
                axes[0, 0].set_ylim(0, 105)

                axes[0, 1].set_title('Memory Usage (%)', fontsize=8, color='#FFFFFF', weight='bold')
                axes[0, 1].set_ylim(0, 105)

                max_all_disk = max(all_disks, default=100.0)
                axes[1, 0].set_title('Disk Utilization (%)', fontsize=8, color='#FFFFFF', weight='bold')
                axes[1, 0].set_ylim(0, max(105, int(max_all_disk + 5)))

                max_all_net = max(all_nets, default=10.0)
                axes[1, 1].set_title('Network Activity (KB/s)', fontsize=8, color='#FFFFFF', weight='bold')
                axes[1, 1].set_ylim(0, max(10.0, max_all_net * 1.15))

                # Legends for all subplots
                for ax in axes.flat:
                    ax.legend(
                        loc='upper left',
                        fontsize=6.5,
                        facecolor='#161E26',
                        edgecolor='#1E2836',
                        labelcolor='#E2E8F0',
                        framealpha=0.85
                    )

                # Date formatting and X-axis range strictly covering available data
                earliest_ts = report_data.get('earliest_ts')
                latest_ts = report_data.get('latest_ts')
                if earliest_ts and latest_ts:
                    duration = latest_ts - earliest_ts
                    if duration <= timedelta(hours=24):
                        date_fmt = '%H:%M'
                    elif duration <= timedelta(days=4):
                        date_fmt = '%b %d\n%H:%M'
                    else:
                        date_fmt = '%b %d'

                    for ax in axes.flat:
                        ax.xaxis.set_major_formatter(mdates.DateFormatter(date_fmt))
                        ax.xaxis.set_major_locator(mdates.AutoDateLocator(minticks=3, maxticks=6))
                        if earliest_ts == latest_ts:
                            ax.set_xlim(earliest_ts - timedelta(minutes=15), latest_ts + timedelta(minutes=15))
                        else:
                            ax.set_xlim(earliest_ts, latest_ts)
            else:
                for ax in axes.flat:
                    ax.text(0.5, 0.5, 'NO MONITORING DATA AVAILABLE', horizontalalignment='center', verticalalignment='center', transform=ax.transAxes, color='#94A3B8', fontsize=8, weight='bold')

            plt.tight_layout(pad=1.2)

            # Save chart to virtual file
            chart_buffer = io.BytesIO()
            plt.savefig(chart_buffer, format='png', dpi=150, facecolor='#0B0F12', edgecolor='none')
            chart_buffer.seek(0)
            plt.close()

            # 3. Build ReportLab PDF
            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = 'attachment; filename="NodeBeacon_Report.pdf"'

            doc = SimpleDocTemplate(
                response,
                pagesize=A4,
                rightMargin=25,
                leftMargin=25,
                topMargin=75,
                bottomMargin=60
            )

            styles = getSampleStyleSheet()
            surface_card = colors.HexColor('#11161B')
            surface_row_alt = colors.HexColor('#151C22')
            surface_header = colors.HexColor('#161E26')
            border_dark = colors.HexColor('#1E2836')
            text_white = colors.HexColor('#FFFFFF')
            text_body = colors.HexColor('#E2E8F0')
            text_muted = colors.HexColor('#94A3B8')
            text_kpi_label = colors.HexColor('#8A99A8')

            # Custom paragraph styles
            title_style = ParagraphStyle(
                'ReportTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=26, leading=32, textColor=text_white, spaceAfter=4
            )
            subtitle_style = ParagraphStyle(
                'ReportSubtitle', parent=styles['Normal'], fontName='Helvetica', fontSize=12, leading=16, textColor=text_muted, spaceAfter=14
            )
            meta_label_style = ParagraphStyle(
                'MetaLabel', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=text_white
            )
            meta_value_style = ParagraphStyle(
                'MetaValue', parent=styles['Normal'], fontName='Helvetica', fontSize=9.5, leading=13, textColor=text_muted
            )
            section_heading = ParagraphStyle(
                'SecHeading', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=text_white, spaceBefore=18, spaceAfter=10
            )
            body_style = ParagraphStyle(
                'SummaryText', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=12, textColor=text_muted
            )
            kpi_title_style = ParagraphStyle(
                'KPITitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=text_kpi_label, alignment=1
            )
            kpi_value_style = ParagraphStyle(
                'KPIValue', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=16, leading=20, textColor=text_white, alignment=1
            )
            table_hdr_style = ParagraphStyle(
                'TableHdr', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=11, textColor=text_white
            )
            table_cell_style = ParagraphStyle(
                'TableCell', parent=styles['Normal'], fontName='Helvetica', fontSize=7.5, leading=10, textColor=text_body
            )

            story = []

            # PAGE 1: COVER HEADER
            story.append(Paragraph('Node<font color="#57E389">Beacon</font>', title_style))
            story.append(Paragraph("System Performance Health Audit", subtitle_style))

            # Metadata Block
            meta_data = [
                [Paragraph("Report Period:", meta_label_style), Paragraph(report_period_str, meta_value_style),
                 Paragraph("Generated Date:", meta_label_style), Paragraph(now().strftime('%B %d, %Y at %I:%M %p'), meta_value_style)]
            ]
            t_meta = Table(meta_data, colWidths=[90, 180, 95, 180])
            t_meta.setStyle(TableStyle([
                ('LINEBELOW', (0,0), (-1,-1), 1, border_dark),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('TOPPADDING', (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ]))
            story.append(t_meta)
            story.append(Spacer(1, 14))

            # Executive Summary Section
            story.append(Paragraph("Executive Summary", section_heading))
            
            # KPI Card Grid with dynamic health/utilization highlights (Green uptime/online, Amber >=80% load, Red alerts/offline)
            uptime_color = '#57E389' if (uptime_pct != '0.0%' and not uptime_pct.startswith('0')) else '#FF5F57'
            cpu_color = '#FFB020' if avg_cpu >= 80 else None
            mem_color = '#FFB020' if avg_mem >= 80 else None
            disk_color = '#FFB020' if avg_disk >= 80 else None
            alerts_color = '#FF5F57' if active_alerts > 0 else '#57E389'
            offline_color = '#FF5F57' if offline_servers > 0 else None

            def _kpi_cell(lbl, val_str, color_hex=None):
                if color_hex:
                    val_p = Paragraph(f'<font color="{color_hex}"><b>{val_str}</b></font>', kpi_value_style)
                else:
                    val_p = Paragraph(val_str, kpi_value_style)
                return [
                    Paragraph(lbl, kpi_title_style),
                    Spacer(1, 5),
                    val_p
                ]

            kpi_data = [
                [
                    _kpi_cell("TOTAL SERVERS", str(total_servers)),
                    _kpi_cell("ONLINE SERVERS", str(online_servers), '#57E389' if online_servers > 0 else None),
                    _kpi_cell("OFFLINE SERVERS", str(offline_servers), offline_color),
                    _kpi_cell("FLEET UPTIME", uptime_pct, uptime_color),
                ],
                [
                    _kpi_cell("AVG CPU LOAD", f"{avg_cpu}%", cpu_color),
                    _kpi_cell("AVG MEMORY LOAD", f"{avg_mem}%", mem_color),
                    _kpi_cell("AVG DISK USAGE", f"{avg_disk}%", disk_color),
                    _kpi_cell("CRITICAL ALERTS", str(active_alerts), alerts_color),
                ]
            ]
            
            t_kpis = Table(kpi_data, colWidths=[136.25, 136.25, 136.25, 136.25], rowHeights=[58, 58])
            t_kpis.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), surface_card),
                ('GRID', (0,0), (-1,-1), 1, border_dark),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('TOPPADDING', (0,0), (-1,-1), 8),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ]))
            story.append(t_kpis)
            story.append(Spacer(1, 18))

            # Server List Table
            story.append(Paragraph("Fleet Server Inventory", section_heading))
            inventory_cols = [
                Paragraph("Server Name", table_hdr_style),
                Paragraph("Hostname", table_hdr_style),
                Paragraph("Operating System", table_hdr_style),
                Paragraph("IP Address", table_hdr_style),
                Paragraph("CPU", table_hdr_style),
                Paragraph("RAM", table_hdr_style),
                Paragraph("Disk", table_hdr_style),
                Paragraph("Status", table_hdr_style),
            ]
            
            inventory_data = [inventory_cols]
            for s in servers:
                s_metric = period_metrics.filter(server=s).first()
                cpu_val = f"{s_metric.cpu_usage}%" if s_metric else "—"
                ram_val = f"{s_metric.memory_usage}%" if s_metric else "—"
                disk_val = f"{s_metric.disk_usage}%" if s_metric else "—"
                
                # Amber warning highlights for high resource utilization (>=80%)
                cpu_formatted = f"<font color='#FFB020'>{cpu_val}</font>" if (s_metric and s_metric.cpu_usage >= 80) else cpu_val
                ram_formatted = f"<font color='#FFB020'>{ram_val}</font>" if (s_metric and s_metric.memory_usage >= 80) else ram_val
                disk_formatted = f"<font color='#FFB020'>{disk_val}</font>" if (s_metric and s_metric.disk_usage >= 80) else disk_val
                status_tag = "<font color='#57E389'>● Online</font>" if s.status == 'Online' else "<font color='#FF5F57'>● Offline</font>"

                row = [
                    Paragraph(s.name, table_cell_style),
                    Paragraph(s.hostname, table_cell_style),
                    Paragraph(s.operating_system, table_cell_style),
                    Paragraph(s.ip_address, table_cell_style),
                    Paragraph(cpu_formatted, table_cell_style),
                    Paragraph(ram_formatted, table_cell_style),
                    Paragraph(disk_formatted, table_cell_style),
                    Paragraph(status_tag, table_cell_style),
                ]
                inventory_data.append(row)

            t_inventory = Table(inventory_data, colWidths=[80, 80, 100, 85, 45, 45, 45, 65])
            t_inventory_style = [
                ('BACKGROUND', (0,0), (-1,0), surface_header),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('PADDING', (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,0), 7),
                ('TOPPADDING', (0,0), (-1,0), 7),
            ]
            # Alternating dark row colors
            for idx in range(1, len(inventory_data)):
                row_bg = surface_row_alt if idx % 2 == 0 else surface_card
                t_inventory_style.append(('BACKGROUND', (0, idx), (-1, idx), row_bg))
            t_inventory_style.append(('GRID', (0,0), (-1,-1), 0.5, border_dark))
            t_inventory.setStyle(TableStyle(t_inventory_style))
            story.append(t_inventory)

            # PAGE 2: CHARTS
            story.append(PageBreak())
            story.append(Paragraph("Infrastructure Telemetry Trends", section_heading))
            
            # Save temp image for Matplotlib charts
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_img:
                tmp_img.write(chart_buffer.getvalue())
                tmp_img_name = tmp_img.name

            story.append(Spacer(1, 10))
            story.append(Image(tmp_img_name, width=7.4*inch, height=4.4*inch))
            story.append(Spacer(1, 15))

            # PAGE 3: ALERTS HISTORY
            story.append(PageBreak())
            story.append(Paragraph("System Incident & Alerts Log", section_heading))
            alert_cols = [
                Paragraph("Severity", table_hdr_style),
                Paragraph("Server", table_hdr_style),
                Paragraph("Alert Message / Description", table_hdr_style),
                Paragraph("Triggered Time", table_hdr_style),
                Paragraph("Resolved Time", table_hdr_style),
                Paragraph("Status", table_hdr_style),
            ]
            
            alert_table_data = [alert_cols]
            for a in report_data['alerts'][:20]: # Limit count to preserve document flow
                triggered = a.created_at.strftime('%Y-%m-%d %H:%M')
                resolved = a.resolved_at.strftime('%Y-%m-%d %H:%M') if a.resolved_at else "—"
                
                # Colored status tag helper matching dashboard
                status_color = '#FF5F57' if a.status == 'Active' else '#57E389'
                severity_color = '#FF5F57' if a.severity == 'Critical' else '#FFB020'
                
                row = [
                    Paragraph(f"<font color='{severity_color}'><b>{a.severity}</b></font>", table_cell_style),
                    Paragraph(a.server.name, table_cell_style),
                    Paragraph(a.description, table_cell_style),
                    Paragraph(triggered, table_cell_style),
                    Paragraph(resolved, table_cell_style),
                    Paragraph(f"<font color='{status_color}'><b>{a.status}</b></font>", table_cell_style),
                ]
                alert_table_data.append(row)

            t_alerts = Table(alert_table_data, colWidths=[65, 80, 185, 85, 85, 50])
            t_alerts_style = [
                ('BACKGROUND', (0,0), (-1,0), surface_header),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('PADDING', (0,0), (-1,-1), 5),
            ]
            for idx in range(1, len(alert_table_data)):
                row_bg = surface_row_alt if idx % 2 == 0 else surface_card
                t_alerts_style.append(('BACKGROUND', (0, idx), (-1, idx), row_bg))
            t_alerts_style.append(('GRID', (0,0), (-1,-1), 0.5, border_dark))
            t_alerts.setStyle(TableStyle(t_alerts_style))
            story.append(t_alerts)

            # Build document using NumberedCanvas and dark page background
            doc.build(story, canvasmaker=NumberedCanvas, onFirstPage=draw_page_background, onLaterPages=draw_page_background)

            # Cleanup temp file
            if os.path.exists(tmp_img_name):
                try:
                    os.remove(tmp_img_name)
                except OSError:
                    pass

            return response
        except Exception as e:
            logger.error("Error generating PDF: " + str(e), exc_info=True)
            from django.http import JsonResponse
            return JsonResponse(
                {"error": "Failed to compile PDF report", "details": str(e), "traceback": traceback.format_exc()},
                status=500
            )

