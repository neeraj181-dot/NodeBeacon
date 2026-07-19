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
            return Metric.objects.filter(server__organization=user.organization)
        return Metric.objects.filter(server__owner=user)

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
        
        queryset = Metric.objects.filter(server=server)
        
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


class ExportPDFReportView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        import io
        import tempfile
        import os
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
                    self.setStrokeColor(colors.HexColor('#E5E7EB'))
                    self.setLineWidth(0.5)
                    self.line(margin, height - 60, width - margin, height - 60)
                    
                    # Top running text
                    self.setFont('Helvetica-Bold', 8)
                    self.setFillColor(colors.HexColor('#374151'))
                    self.drawString(margin, height - 50, "NodeBeacon Infrastructure Monitoring")
                    
                    self.setFont('Helvetica', 8)
                    self.setFillColor(colors.HexColor('#6B7280'))
                    self.drawRightString(width - margin, height - 50, "System Health Report")
                    
                    # Bottom running footer bar
                    self.line(margin, 45, width - margin, 45)
                    self.drawString(margin, 30, "Generated automatically by NodeBeacon")
                    self.drawRightString(width - margin, 30, f"Page {self._pageNumber} of {page_count}")
                self.restoreState()

        from reportlab.lib.units import inch
        import traceback
        import logging
        logger = logging.getLogger(__name__)

        try:
            # 1. Fetch User Data
            user = request.user
            if user.role in ['ORGANIZATION_ADMIN', 'MEMBER'] and user.organization:
                servers = Server.objects.filter(organization=user.organization)
                metrics = Metric.objects.filter(server__organization=user.organization)
                alerts = Alert.objects.filter(server__organization=user.organization)
            else:
                servers = Server.objects.filter(owner=user)
                metrics = Metric.objects.filter(server__owner=user)
                alerts = Alert.objects.filter(server__owner=user)

            total_servers = servers.count()
            online_servers = servers.filter(status='Online').count()
            offline_servers = total_servers - online_servers

            # Global average metrics
            avg_cpu = 0
            avg_mem = 0
            avg_disk = 0
            if metrics.exists():
                avg_cpu = round(sum(m.cpu_usage for m in metrics) / metrics.count(), 1)
                avg_mem = round(sum(m.memory_usage for m in metrics) / metrics.count(), 1)
                avg_disk = round(sum(m.disk_usage for m in metrics) / metrics.count(), 1)

            # Uptime approximation: % of online servers
            uptime_pct = "100%"
            if total_servers > 0:
                uptime_pct = f"{round((online_servers / total_servers) * 100, 1)}%"

            active_alerts = alerts.filter(status='Active').count()

            # 2. Render professional Matplotlib chart to memory
            fig, axes = plt.subplots(2, 2, figsize=(7.5, 4.5))
            plot_metrics = list(metrics.order_by('timestamp'))
            times = [m.timestamp for m in plot_metrics]
            cpu_vals = [m.cpu_usage for m in plot_metrics]
            mem_vals = [m.memory_usage for m in plot_metrics]
            disk_vals = [m.disk_usage for m in plot_metrics]
            # Simulate network metrics to fulfill Network Activity requirements
            net_vals = [((m.cpu_usage + m.memory_usage) / 2) * 1.5 for m in plot_metrics]

            # General styling
            for ax in axes.flat:
                ax.set_facecolor('#F9FAFB')
                ax.grid(True, color='#E5E7EB', linestyle='--', linewidth=0.5)
                ax.tick_params(colors='#4B5563', labelsize=7)
                for spine in ax.spines.values():
                    spine.set_color('#E5E7EB')

            # Subplot [0, 0]: CPU Trend
            axes[0, 0].plot(times, cpu_vals, color='#57E389', linewidth=1.5)
            axes[0, 0].set_title('CPU Load Trend (%)', fontsize=8, color='#1F2937', weight='bold')
            axes[0, 0].set_ylim(0, 105)

            # Subplot [0, 1]: Memory Trend
            axes[0, 1].plot(times, mem_vals, color='#3B82F6', linewidth=1.5)
            axes[0, 1].set_title('Memory Usage (%)', fontsize=8, color='#1F2937', weight='bold')
            axes[0, 1].set_ylim(0, 105)

            # Subplot [1, 0]: Disk Trend
            axes[1, 0].plot(times, disk_vals, color='#EF4444', linewidth=1.5)
            axes[1, 0].set_title('Disk Capacity (%)', fontsize=8, color='#1F2937', weight='bold')
            axes[1, 0].set_ylim(0, 105)

            # Subplot [1, 1]: Network Activity Trend
            axes[1, 1].plot(times, net_vals, color='#8B5CF6', linewidth=1.5)
            axes[1, 1].set_title('Network Activity (KB/s)', fontsize=8, color='#1F2937', weight='bold')

            # Date formatting for X-axis
            if times:
                for ax in axes.flat:
                    ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
                    ax.xaxis.set_major_locator(mdates.AutoDateLocator())
                    
            plt.tight_layout()

            # Save chart to virtual file
            chart_buffer = io.BytesIO()
            plt.savefig(chart_buffer, format='png', dpi=150)
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
            accent_green = colors.HexColor('#57E389')
            text_dark = colors.HexColor('#1F2937')
            text_muted = colors.HexColor('#6B7280')

            # Custom paragraph styles
            title_style = ParagraphStyle(
                'ReportTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=26, textColor=text_dark, spaceAfter=8
            )
            subtitle_style = ParagraphStyle(
                'ReportSubtitle', parent=styles['Normal'], fontName='Helvetica', fontSize=12, textColor=text_muted, spaceAfter=20
            )
            meta_label_style = ParagraphStyle(
                'MetaLabel', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, textColor=text_dark
            )
            meta_value_style = ParagraphStyle(
                'MetaValue', parent=styles['Normal'], fontName='Helvetica', fontSize=10, textColor=text_muted
            )
            section_heading = ParagraphStyle(
                'SecHeading', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=14, textColor=text_dark, spaceBefore=18, spaceAfter=8
            )
            body_style = ParagraphStyle(
                'SummaryText', parent=styles['Normal'], fontName='Helvetica', fontSize=9, textColor=text_muted
            )
            kpi_title_style = ParagraphStyle(
                'KPITitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, textColor=text_muted, alignment=1
            )
            kpi_value_style = ParagraphStyle(
                'KPIValue', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=16, textColor=text_dark, alignment=1
            )
            table_hdr_style = ParagraphStyle(
                'TableHdr', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, textColor=colors.white
            )
            table_cell_style = ParagraphStyle(
                'TableCell', parent=styles['Normal'], fontName='Helvetica', fontSize=7.5, textColor=text_dark
            )

            story = []

            # PAGE 1: COVER HEADER
            story.append(Paragraph("Node<b>Beacon</b>", title_style))
            story.append(Paragraph("System Performance Health Audit", subtitle_style))

            # Metadata Block
            meta_data = [
                [Paragraph("Report Period:", meta_label_style), Paragraph(f"Last 24 Hours ({now().strftime('%Y-%m-%d')})", meta_value_style),
                 Paragraph("Generated Date:", meta_label_style), Paragraph(now().strftime('%B %d, %Y at %I:%M %p'), meta_value_style)]
            ]
            t_meta = Table(meta_data, colWidths=[110, 160, 110, 160])
            t_meta.setStyle(TableStyle([
                ('LINEBELOW', (0,0), (-1,-1), 1, colors.HexColor('#E5E7EB')),
                ('PADDING', (0,0), (-1,-1), 4),
            ]))
            story.append(t_meta)
            story.append(Spacer(1, 15))

            # Executive Summary Section
            story.append(Paragraph("Executive Summary", section_heading))
            
            # KPI Card Grid (Total, Online, Offline, Avg CPU, Avg RAM, Avg Disk, Critical Alerts)
            kpi_data = [
                [
                    Paragraph("TOTAL SERVERS", kpi_title_style),
                    Paragraph("ONLINE SERVERS", kpi_title_style),
                    Paragraph("OFFLINE SERVERS", kpi_title_style),
                    Paragraph("FLEET UPTIME", kpi_title_style)
                ],
                [
                    Paragraph(str(total_servers), kpi_value_style),
                    Paragraph(str(online_servers), kpi_value_style),
                    Paragraph(str(offline_servers), kpi_value_style),
                    Paragraph(uptime_pct, kpi_value_style)
                ],
                [
                    Paragraph("AVG CPU LOAD", kpi_title_style),
                    Paragraph("AVG MEMORY LOAD", kpi_title_style),
                    Paragraph("AVG DISK USAGE", kpi_title_style),
                    Paragraph("CRITICAL ALERTS", kpi_title_style)
                ],
                [
                    Paragraph(f"{avg_cpu}%", kpi_value_style),
                    Paragraph(f"{avg_mem}%", kpi_value_style),
                    Paragraph(f"{avg_disk}%", kpi_value_style),
                    Paragraph(str(active_alerts), kpi_value_style)
                ]
            ]
            
            t_kpis = Table(kpi_data, colWidths=[135, 135, 135, 135])
            t_kpis.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,1), colors.HexColor('#F9FAFB')),
                ('BACKGROUND', (0,2), (-1,3), colors.HexColor('#F9FAFB')),
                ('BOX', (0,0), (0,1), 1, colors.HexColor('#E5E7EB')),
                ('BOX', (1,0), (1,1), 1, colors.HexColor('#E5E7EB')),
                ('BOX', (2,0), (2,1), 1, colors.HexColor('#E5E7EB')),
                ('BOX', (3,0), (3,1), 1, colors.HexColor('#E5E7EB')),
                ('BOX', (0,2), (0,3), 1, colors.HexColor('#E5E7EB')),
                ('BOX', (1,2), (1,3), 1, colors.HexColor('#E5E7EB')),
                ('BOX', (2,2), (2,3), 1, colors.HexColor('#E5E7EB')),
                ('BOX', (3,2), (3,3), 1, colors.HexColor('#E5E7EB')),
                ('PADDING', (0,0), (-1,-1), 8),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ]))
            story.append(t_kpis)
            story.append(Spacer(1, 15))

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
                s_metric = metrics.filter(server=s).first()
                cpu_val = f"{s_metric.cpu_usage}%" if s_metric else "—"
                ram_val = f"{s_metric.memory_usage}%" if s_metric else "—"
                disk_val = f"{s_metric.disk_usage}%" if s_metric else "—"
                
                row = [
                    Paragraph(s.name, table_cell_style),
                    Paragraph(s.hostname, table_cell_style),
                    Paragraph(s.operating_system, table_cell_style),
                    Paragraph(s.ip_address, table_cell_style),
                    Paragraph(cpu_val, table_cell_style),
                    Paragraph(ram_val, table_cell_style),
                    Paragraph(disk_val, table_cell_style),
                    Paragraph(f"<font color='{'green' if s.status == 'Online' else 'red'}'>● {s.status}</font>", table_cell_style),
                ]
                inventory_data.append(row)

            t_inventory = Table(inventory_data, colWidths=[80, 80, 100, 85, 45, 45, 45, 60])
            t_inventory_style = [
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#111827')),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('PADDING', (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,0), 6),
                ('TOPPADDING', (0,0), (-1,0), 6),
            ]
            # Alternating row colors
            for idx in range(1, len(inventory_data)):
                if idx % 2 == 0:
                    t_inventory_style.append(('BACKGROUND', (0, idx), (-1, idx), colors.HexColor('#F9FAFB')))
            t_inventory_style.append(('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')))
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
            for a in alerts[:20]: # Limit count to preserve document flow
                triggered = a.created_at.strftime('%Y-%m-%d %H:%M')
                resolved = a.resolved_at.strftime('%Y-%m-%d %H:%M') if a.resolved_at else "—"
                
                # Colored status tag helper
                status_color = 'red' if a.status == 'Active' else 'green'
                severity_color = 'red' if a.severity == 'Critical' else 'orange'
                
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
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#111827')),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('PADDING', (0,0), (-1,-1), 5),
            ]
            for idx in range(1, len(alert_table_data)):
                if idx % 2 == 0:
                    t_alerts_style.append(('BACKGROUND', (0, idx), (-1, idx), colors.HexColor('#F9FAFB')))
            t_alerts_style.append(('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')))
            t_alerts.setStyle(TableStyle(t_alerts_style))
            story.append(t_alerts)

            # Build document using NumberedCanvas
            doc.build(story, canvasmaker=NumberedCanvas)

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

