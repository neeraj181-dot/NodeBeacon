import os
import sys
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and stamp accurate 'Page X of Y'
    along with running header and footer rules on all pages except the cover page.
    """
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
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, page_count):
        self.saveState()
        margin = 36
        width, height = A4

        # Decorate content pages (Page 2 onwards)
        if self._pageNumber > 1:
            # Running Header
            self.setStrokeColor(colors.HexColor('#CBD5E1'))
            self.setLineWidth(0.6)
            self.line(margin, height - 38, width - margin, height - 38)

            self.setFont('Helvetica-Bold', 8)
            self.setFillColor(colors.HexColor('#0F172A'))
            self.drawString(margin, height - 30, "NodeBeacon Infrastructure Monitoring Platform")

            self.setFont('Helvetica', 8)
            self.setFillColor(colors.HexColor('#64748B'))
            self.drawRightString(width - margin, height - 30, "Technical Specifications & Working Report")

            # Running Footer
            self.setStrokeColor(colors.HexColor('#CBD5E1'))
            self.setLineWidth(0.6)
            self.line(margin, 38, width - margin, 38)

            self.setFont('Helvetica', 8)
            self.setFillColor(colors.HexColor('#64748B'))
            self.drawString(margin, 26, "NodeBeacon Academic Project Submission & Technical Report")
            self.drawRightString(width - margin, 26, f"Page {self._pageNumber} of {page_count}")

        self.restoreState()


def build_pdf(filename="NodeBeacon_Project_Report.pdf"):
    pdf_path = os.path.abspath(filename)
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=48,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()

    # Color Palette
    primary_dark = colors.HexColor('#0F172A')    # Slate 900
    accent_green = colors.HexColor('#10B981')    # Emerald / Beacon Green
    accent_dark_green = colors.HexColor('#047857')
    text_main = colors.HexColor('#1E293B')       # Slate 800
    text_muted = colors.HexColor('#475569')      # Slate 600
    bg_light = colors.HexColor('#F8FAFC')        # Slate 50
    border_color = colors.HexColor('#E2E8F0')    # Slate 200

    # Typography styles
    styles.add(ParagraphStyle(
        'CoverSuper',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=13,
        textColor=accent_dark_green,
        spaceAfter=4,
        textTransform='uppercase'
    ))
    styles.add(ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=primary_dark,
        spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=text_muted,
        spaceAfter=14
    ))
    styles.add(ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=primary_dark,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=accent_dark_green,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=text_main,
        spaceAfter=5
    ))
    styles.add(ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12,
        textColor=primary_dark,
        spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        'BulletItem',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=text_main,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    ))
    styles.add(ParagraphStyle(
        'CodeSnippet',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor('#0F172A'),
        backColor=colors.HexColor('#F1F5F9'),
        borderPadding=5,
        spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    ))
    styles.add(ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=text_main
    ))
    styles.add(ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=primary_dark
    ))

    printable_w = 523.27  # 595.27 - 72

    story = []

    # ==========================================
    # 1. COVER / TITLE HEADER BLOCK
    # ==========================================
    story.append(Paragraph("Project Technical Documentation & Specifications", styles['CoverSuper']))
    story.append(Paragraph("NodeBeacon: Infrastructure Monitoring & Telemetry Platform", styles['CoverTitle']))
    story.append(Paragraph("A Full-Stack Server Health Surveillance, Incident Alerting & Remote Diagnostic System", styles['CoverSubtitle']))

    # Metadata Card
    meta_table_data = [
        [
            Paragraph("<b>Author / Developer:</b> Neeraj", styles['TableCell']),
            Paragraph(f"<b>Documentation Date:</b> {datetime.now().strftime('%B %d, %Y')}", styles['TableCell']),
        ],
        [
            Paragraph("<b>Architecture:</b> 3-Tier Distributed (Agent / REST API / SPA)", styles['TableCell']),
            Paragraph("<b>Stack:</b> React 19, Django 5.2, MySQL 8, Python 3.11", styles['TableCell'])
        ],
        [
            Paragraph("<b>Target Operating Systems:</b> Windows 10/11, Windows Server, Linux", styles['TableCell']),
            Paragraph("<b>Security Model:</b> JWT SimpleJWT, Google OAuth 2.0, SHA-256 Tokens", styles['TableCell'])
        ]
    ]
    t_meta = Table(meta_table_data, colWidths=[261.6, 261.6])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))

    # ==========================================
    # 2. EXECUTIVE SUMMARY & PROBLEM STATEMENT
    # ==========================================
    story.append(Paragraph("1. Executive Summary & Problem Statement", styles['H1']))
    story.append(HRFlowable(width="100%", thickness=1, color=accent_green, spaceAfter=6, spaceBefore=2))

    story.append(Paragraph(
        "Modern digital services rely on continuous server availability. Traditional enterprise monitoring platforms (such as Datadog, Splunk, or New Relic) are often heavyweight, complex, costly, and demand high resident memory overhead on monitored nodes. <b>NodeBeacon</b> was engineered to solve this challenge by providing an autonomous, ultra-lightweight, and developer-friendly infrastructure monitoring suite.",
        styles['Body']
    ))
    story.append(Paragraph(
        "<b>Core Pillars of NodeBeacon:</b>", styles['BodyBold']
    ))
    story.append(Paragraph("&bull; <b>Autonomous Telemetry Agent:</b> A standalone compiled Windows executable (&lt;20 MB RAM footprint) requiring zero client configuration, capturing CPU, RAM, Disk, Network throughput, and OS uptime.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Automated Incident Engine:</b> Continuously evaluates server heartbeats and resource threshold violations; triggers automated alerts via responsive HTML emails, Telegram bot notifications, and desktop notifications.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Dual Authentication &amp; Google SSO:</b> Implements secure JSON Web Token (JWT) sessions, granular Role-Based Access Control (RBAC), and Google OAuth 2.0 Single Sign-On with cryptographically verified state tokens.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Dynamic Audit PDF Compilation:</b> Generates multi-page executive performance audit reports with high-resolution Matplotlib trend charts and ReportLab vector tables directly in memory.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Laptop Session Physical Security:</b> Native Windows Terminal Services (Wtsapi32.dll) event listener that alerts administrators whenever a monitored computer session is unlocked.", styles['BulletItem']))

    story.append(Spacer(1, 8))

    # ==========================================
    # 3. TECHNICAL SPECIFICATIONS USED
    # ==========================================
    story.append(Paragraph("2. Technical Specifications Used", styles['H1']))
    story.append(HRFlowable(width="100%", thickness=1, color=accent_green, spaceAfter=6, spaceBefore=2))

    specs_data = [
        [Paragraph("Tier / Layer", styles['TableHeader']), Paragraph("Technology / Library", styles['TableHeader']), Paragraph("Version", styles['TableHeader']), Paragraph("Role & Specification in NodeBeacon", styles['TableHeader'])],
        
        # Frontend
        [Paragraph("Frontend UI", styles['TableCellBold']), Paragraph("React", styles['TableCell']), Paragraph("19.2.7", styles['TableCell']), Paragraph("Core component rendering, virtual DOM state synchronization", styles['TableCell'])],
        [Paragraph("Build Tool", styles['TableCellBold']), Paragraph("Vite", styles['TableCell']), Paragraph("8.1.1", styles['TableCell']), Paragraph("Blazing-fast ESM dev server, bundling, hot module replacement", styles['TableCell'])],
        [Paragraph("Client Routing", styles['TableCellBold']), Paragraph("React Router DOM", styles['TableCell']), Paragraph("7.18.1", styles['TableCell']), Paragraph("Declarative routing, protected route boundaries, history management", styles['TableCell'])],
        [Paragraph("CSS &amp; Styling", styles['TableCellBold']), Paragraph("Tailwind CSS", styles['TableCell']), Paragraph("4.3.3", styles['TableCell']), Paragraph("Utility-first design system with persistent dark/light theme switching", styles['TableCell'])],
        [Paragraph("Data Viz", styles['TableCellBold']), Paragraph("Recharts", styles['TableCell']), Paragraph("3.9.2", styles['TableCell']), Paragraph("Interactive SVG time-series charts for CPU, RAM, Disk &amp; Network", styles['TableCell'])],
        [Paragraph("Micro-Animations", styles['TableCellBold']), Paragraph("Framer Motion", styles['TableCell']), Paragraph("12.42.2", styles['TableCell']), Paragraph("Fluid page tab transitions and status notification badges", styles['TableCell'])],
        [Paragraph("Icons", styles['TableCellBold']), Paragraph("Lucide React", styles['TableCell']), Paragraph("1.25.0", styles['TableCell']), Paragraph("Clean, modern SVG icons for system dashboards and server states", styles['TableCell'])],
        [Paragraph("HTTP Client", styles['TableCellBold']), Paragraph("Axios", styles['TableCell']), Paragraph("1.18.1", styles['TableCell']), Paragraph("Asynchronous REST requests, JWT bearer authorization interceptor", styles['TableCell'])],

        # Backend
        [Paragraph("Backend Framework", styles['TableCellBold']), Paragraph("Django (Python)", styles['TableCell']), Paragraph("5.2+", styles['TableCell']), Paragraph("Core Web Framework, ORM layer, settings, email dispatch, admin", styles['TableCell'])],
        [Paragraph("REST API", styles['TableCellBold']), Paragraph("Django REST Framework", styles['TableCell']), Paragraph("3.17.1", styles['TableCell']), Paragraph("Class-based API views, model serializers, rate limit throttles", styles['TableCell'])],
        [Paragraph("Authentication", styles['TableCellBold']), Paragraph("DRF SimpleJWT", styles['TableCell']), Paragraph("5.5.1", styles['TableCell']), Paragraph("HMAC SHA-256 signed access (short) and refresh (long) JWT tokens", styles['TableCell'])],
        [Paragraph("SSO Integration", styles['TableCellBold']), Paragraph("Google OAuth 2.0", styles['TableCell']), Paragraph("RFC 6749", styles['TableCell']), Paragraph("Single Sign-On with cryptographically verified HMAC state payloads", styles['TableCell'])],
        [Paragraph("Database Engine", styles['TableCellBold']), Paragraph("MySQL Server", styles['TableCell']), Paragraph("8.x", styles['TableCell']), Paragraph("Relational storage with utf8mb4 collation and foreign key cascades", styles['TableCell'])],
        [Paragraph("Database Driver", styles['TableCellBold']), Paragraph("mysqlclient", styles['TableCell']), Paragraph("2.2.0+", styles['TableCell']), Paragraph("C-optimized direct database connector for high throughput", styles['TableCell'])],
        [Paragraph("PDF &amp; Charting", styles['TableCellBold']), Paragraph("ReportLab &amp; Matplotlib", styles['TableCell']), Paragraph("5.0 / 3.11", styles['TableCell']), Paragraph("In-memory dual-canvas PDF compilation and 4-quadrant telemetry plots", styles['TableCell'])],

        # Agent
        [Paragraph("Monitoring Agent", styles['TableCellBold']), Paragraph("Python Native Binary", styles['TableCell']), Paragraph("3.11", styles['TableCell']), Paragraph("Autonomous telemetry daemon running every 10s on endpoints", styles['TableCell'])],
        [Paragraph("OS Metrics", styles['TableCellBold']), Paragraph("psutil", styles['TableCell']), Paragraph("7.2.2", styles['TableCell']), Paragraph("Harvests CPU (0.5s slice), virtual RAM, disk partition, net I/O, boot time", styles['TableCell'])],
        [Paragraph("Windows API", styles['TableCellBold']), Paragraph("pywin32 &amp; Wtsapi32", styles['TableCell']), Paragraph("&gt;=306", styles['TableCell']), Paragraph("Windows Terminal Services hooks for laptop unlock detection", styles['TableCell'])],
        [Paragraph("Binary Packaging", styles['TableCellBold']), Paragraph("PyInstaller", styles['TableCell']), Paragraph("6.21.0", styles['TableCell']), Paragraph("Packages agent into standalone zero-dependency Windows executable", styles['TableCell'])],
    ]

    t_specs = Table(specs_data, colWidths=[85, 115, 55, 268.27])
    t_specs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_dark),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
    ]))
    for row_idx in range(1, len(specs_data)):
        bg = bg_light if row_idx % 2 == 1 else colors.white
        t_specs.setStyle(TableStyle([('BACKGROUND', (0, row_idx), (-1, row_idx), bg)]))

    story.append(t_specs)
    story.append(Spacer(1, 8))

    # Hardware & System Requirements
    story.append(Paragraph("2.1 System & Hardware Requirements", styles['H2']))
    reqs_data = [
        [Paragraph("Parameter", styles['TableHeader']), Paragraph("Host / Cloud Server Specification", styles['TableHeader']), Paragraph("Monitored Endpoint (Agent) Specification", styles['TableHeader'])],
        [Paragraph("Processor (CPU)", styles['TableCellBold']), Paragraph("Dual-core 2.0 GHz or higher (x86_64)", styles['TableCell']), Paragraph("Any single or multi-core x86/x64 processor (&lt;0.5% load)", styles['TableCell'])],
        [Paragraph("Memory (RAM)", styles['TableCellBold']), Paragraph("Min 2 GB (4 GB recommended for PDF/DB)", styles['TableCell']), Paragraph("&lt;25 MB RAM consumption during execution", styles['TableCell'])],
        [Paragraph("Disk Storage", styles['TableCellBold']), Paragraph("5 GB free space for OS, DB &amp; log retention", styles['TableCell']), Paragraph("35 MB free disk space for executable &amp; buffers", styles['TableCell'])],
        [Paragraph("Operating System", styles['TableCellBold']), Paragraph("Windows 10/11, Windows Server, Linux (Ubuntu)", styles['TableCell']), Paragraph("Windows 10, Windows 11, Windows Server (Linux compatible)", styles['TableCell'])],
        [Paragraph("Network Ports", styles['TableCellBold']), Paragraph("8000 (Django API), 5173 (Vite), 3306 (MySQL), 587 (SMTP)", styles['TableCell']), Paragraph("Outbound HTTP/HTTPS to port 8000 (No inbound ports needed)", styles['TableCell'])],
    ]
    t_reqs = Table(reqs_data, colWidths=[95, 214.1, 214.1])
    t_reqs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_dark),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    for row_idx in range(1, len(reqs_data)):
        bg = bg_light if row_idx % 2 == 1 else colors.white
        t_reqs.setStyle(TableStyle([('BACKGROUND', (0, row_idx), (-1, row_idx), bg)]))

    story.append(t_reqs)
    story.append(PageBreak())

    # ==========================================
    # 4. SYSTEM ARCHITECTURE & HIGH-LEVEL DESIGN
    # ==========================================
    story.append(Paragraph("3. System Architecture & High-Level Design", styles['H1']))
    story.append(HRFlowable(width="100%", thickness=1, color=accent_green, spaceAfter=6, spaceBefore=2))

    story.append(Paragraph(
        "NodeBeacon is designed around an asynchronous, non-blocking telemetry model. Communication between tiers occurs over standard RESTful HTTP with strict separation of concerns.",
        styles['Body']
    ))

    arch_diagram = (
        "+-----------------------------------------------------------------------------------+\n"
        "|                             1. MONITORED ENDPOINTS (AGENTS)                       |\n"
        "|  - NodeBeaconAgent.exe (Native Windows daemon compiled via PyInstaller)           |\n"
        "|  - collector.py: Harvests CPU (0.5s interval), RAM, Disk, Net I/O every 10s       |\n"
        "|  - unlock.py: Wtsapi32 session listener detects desktop unlock events             |\n"
        "+-----------------------------------------------------------------------------------+\n"
        "                                          |  POST /api/metrics/ (X-Device-Token)\n"
        "                                          v\n"
        "+-----------------------------------------------------------------------------------+\n"
        "|                         2. NODEBEACON BACKEND (DJANGO REST)                       |\n"
        "|  - Ingestion Pipeline: Validates tokens, records samples, auto-updates server IP  |\n"
        "|  - Alerting Watchdog: Evaluates CPU/RAM/Disk thresholds, detects offline nodes    |\n"
        "|  - Notification Dispatcher: Sends responsive HTML emails & Telegram messages     |\n"
        "|  - Audit PDF Generator: Compiles Matplotlib charts & ReportLab vector tables      |\n"
        "|  - MySQL 8.x Database: Normalized tables with indexes on timestamps & server IDs  |\n"
        "+-----------------------------------------------------------------------------------+\n"
        "                                          ^  JSON over HTTP (JWT Bearer Token)\n"
        "                                          |\n"
        "+-----------------------------------------------------------------------------------+\n"
        "|                          3. CLIENT DASHBOARD (REACT 19 SPA)                       |\n"
        "|  - React Router v7: /login, /register, /forgot-password, /auth/callback, /        |\n"
        "|  - React Contexts: AuthContext, ServerContext, AlertContext, ThemeContext         |\n"
        "|  - Live Visualization: Recharts telemetry lines, alerts table, PDF export trigger|\n"
        "+-----------------------------------------------------------------------------------+"
    )
    story.append(Paragraph(arch_diagram.replace('\n', '<br/>').replace(' ', '&nbsp;'), styles['CodeSnippet']))
    story.append(Spacer(1, 6))

    # ==========================================
    # 5. DETAILED WORKING OF SUBSYSTEMS
    # ==========================================
    story.append(Paragraph("4. Detailed Working of Subsystems", styles['H1']))
    story.append(HRFlowable(width="100%", thickness=1, color=accent_green, spaceAfter=6, spaceBefore=2))

    # 4.1 Authentication & Security
    story.append(Paragraph("4.1 Authentication & Security Subsystem", styles['H2']))
    story.append(Paragraph(
        "NodeBeacon provides an enterprise-ready security perimeter supporting dual authentication models for users and machines:",
        styles['Body']
    ))
    story.append(Paragraph("&bull; <b>JWT Token Lifecycle:</b> Standard login (`/api/auth/login/`) validates salted password hashes and delivers an access token (5-minute TTL) and refresh token (24-hour TTL). The React frontend stores tokens securely in browser local storage and injects them into Axios request headers via HTTP interceptors. Silent token refresh (`/api/auth/refresh/`) guarantees seamless user experiences.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Google OAuth 2.0 Single Sign-On:</b> Built on RFC 6749. When the user selects 'Sign in with Google', the backend creates a cryptographically signed HMAC SHA-256 `state` token containing a timestamp and target redirect URI. Upon Google callback, the backend validates the state signature, performs server-to-server code exchange with Google token endpoints, verifies identity claims, and links or creates the user record.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Role-Based Access Control (RBAC):</b> Accounts are segregated into <i>Individual</i> (personal server fleets) and <i>Organization</i> (shared enterprise fleets). Organizations support tiered member roles: <i>Administrator</i> (full fleet creation, configuration, and API reset permissions), <i>Operator</i> (alert acknowledgement and operational restarts), and <i>Viewer</i> (read-only telemetry metrics inspection).", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Device Credential Isolation:</b> Machine agents do not use user credentials. Instead, each server entity has a 48-character API key and an enrolled 32-byte `device_token`. Only SHA-256 hashes (`device_token_hash`) are persisted in the MySQL database, ensuring compromise of the database never leaks cleartext machine credentials.", styles['BulletItem']))

    story.append(Spacer(1, 6))

    # 4.2 Monitoring Agent Working
    story.append(Paragraph("4.2 Endpoint Monitoring Agent Engine", styles['H2']))
    story.append(Paragraph(
        "The endpoint agent (`agent/`) is written in Python 3.11 and packaged into a standalone Windows binary (`NodeBeaconAgent.exe`) via PyInstaller. It functions autonomously with the following lifecycle:",
        styles['Body']
    ))
    story.append(Paragraph("1. <b>Zero-Friction One-Click Enrollment:</b> When a user registers a server, they click <b>Download Agent</b>. The backend bundles the executable and an ephemeral `enrollment.json` into a ZIP archive. The JSON file contains a one-time 32-byte token valid for 30 minutes. Upon initial launch, the agent calls `/api/servers/agents/register/`, consumes the token atomically with database row locks (`select_for_update`), and receives its permanent device token and telemetry configuration.", styles['BulletItem']))
    story.append(Paragraph("2. <b>High-Precision Metric Sampling:</b> Every 10 seconds, `collector.py` executes: CPU utilization via `psutil.cpu_percent(interval=0.5)` to measure real compute load rather than an instantaneous spike; Virtual memory via `psutil.virtual_memory().percent`; Disk utilization targeting `C:\\`; Network I/O byte counters (`bytes_sent`, `bytes_recv`); System boot time and uptime; and OS kernel build analysis to distinguish Windows 10 vs. Windows 11.", styles['BulletItem']))
    story.append(Paragraph("3. <b>Exponential Backoff &amp; Network Resilience:</b> Telemetry is posted to `/api/metrics/`. If the backend becomes unreachable, `runtime.py` catches the network timeout, sets local agent status to `Reconnecting`, and throttles retry attempts using an exponential delay sequence (`5s -> 10s -> 30s -> 60s`). When connectivity is restored, normal 10-second sampling resumes without crashing.", styles['BulletItem']))
    story.append(Paragraph("4. <b>Windows Session Physical Unlock Detection:</b> Implemented in `unlock.py`. The agent spins up a dedicated background thread with a Win32 message loop registered to `Wtsapi32.dll!WTSRegisterSessionNotification`. When an authenticated user unlocks the computer screen (`WTS_SESSION_UNLOCK = 0x8`), the event is captured, assigned an idempotent UUIDv4, filtered against a 3-second deduplication window, and transmitted to `/api/servers/agents/unlocked/` to notify the administrator.", styles['BulletItem']))

    story.append(Spacer(1, 6))

    # 4.3 Ingestion & Alerting Engine
    story.append(Paragraph("4.3 Ingestion & Automated Alerting Engine", styles['H2']))
    story.append(Paragraph(
        "The backend ingestion pipeline processes thousands of metrics with instant threshold evaluation:",
        styles['Body']
    ))
    story.append(Paragraph("&bull; <b>Telemetry Ingestion (`MetricsListCreateView`):</b> Validates `X-Device-Token`, saves the sample to `metrics_metric`, updates server status to `Online`, updates `last_seen` timestamp, and detects dynamic client IP changes through `HTTP_X_FORWARDED_FOR`.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Real-Time Threshold Evaluation (`evaluate_metrics_alerts`):</b> The new metric is checked against the user's configured limits: CPU limit (e.g. &gt;90%), Memory limit (e.g. &gt;90%), and Disk limit (e.g. &gt;95%). If breached, a new `Alert` is created with `severity='Critical'` and `status='Active'`. When metrics return to safe ranges in future samples, the alert is automatically resolved (`status='Resolved'`).", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Offline Heartbeat Watchdog (`check_and_trigger_offline_servers`):</b> If a server stops transmitting metrics for longer than `heartbeat_timeout` (default 60s), the server status flips to `Offline` and a critical 'Server Offline' alert is broadcast.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Multi-Channel Alert Dispatch:</b> Alerts are immediately formatted into a responsive HTML email with server metadata and dispatched via SMTP. If the user paired their Telegram bot using the deep-linking verification code (`users_telegrampairing`), an instant Telegram alert message is also delivered.", styles['BulletItem']))

    story.append(PageBreak())

    # 4.4 PDF Audit Subsystem
    story.append(Paragraph("4.4 Dynamic Audit & PDF Reporting Engine", styles['H2']))
    story.append(Paragraph(
        "Implemented in `backend/metrics/views.py` (`ExportPDFReportView`). Administrators can download complete infrastructure health audits at any time:",
        styles['Body']
    ))
    story.append(Paragraph("&bull; <b>In-Memory Visualization:</b> Uses Matplotlib with the non-GUI `Agg` backend to construct a 4-quadrant subplot (CPU Load Trend, Memory Usage, Disk Capacity, and Network Activity KB/s) directly into a BytesIO memory buffer.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>ReportLab Vector Layout:</b> Assembles an executive report containing cover branding, KPI metric summary tiles (Total Servers, Online Ratio, Fleet Uptime %, Average Loads), server inventory table with colored status badges, embedded telemetry trend charts, and incident resolution audit tables.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Two-Pass Dynamic Pagination:</b> Employs a custom `NumberedCanvas` to calculate total pages and output running header and footer banners (`Page X of Y`).", styles['BulletItem']))

    story.append(Spacer(1, 6))

    # 4.5 Frontend React SPA Architecture
    story.append(Paragraph("4.5 Frontend React SPA Architecture", styles['H2']))
    story.append(Paragraph(
        "The React 19 web application is structured for fast response times, smooth navigation, and clear separation of state:",
        styles['Body']
    ))
    story.append(Paragraph("&bull; <b>Declarative Routing (React Router v7):</b> Standard URL routing manages views (`/login`, `/register`, `/forgot-password`, `/auth/callback`, and protected `/`). Browser history buttons (Back/Forward) function naturally, and OAuth callbacks are parsed automatically.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>State Management via React Contexts:</b> `AuthContext` provides authenticated user profile and tokens; `ServerContext` supplies cached server lists and mutation hooks; `AlertContext` manages live unread notifications; and `ThemeContext` coordinates persistent dark/light theme switching via browser `localStorage`.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Interactive Dashboard &amp; Live Charts:</b> The main view offers a fleet-level summary card grid, live Recharts line charts with SVG tooltips, and server details drill-downs displaying real-time telemetry gauges.", styles['BulletItem']))
    story.append(Paragraph("&bull; <b>Desktop Web Push Notifications:</b> Uses the HTML5 `Notification` API to alert administrators of critical incidents even when the browser tab is minimized in the background.", styles['BulletItem']))

    story.append(Spacer(1, 8))

    # ==========================================
    # 6. DATABASE SCHEMA & RELATIONAL DESIGN
    # ==========================================
    story.append(Paragraph("5. Database Schema & Relational Design", styles['H1']))
    story.append(HRFlowable(width="100%", thickness=1, color=accent_green, spaceAfter=6, spaceBefore=2))

    story.append(Paragraph(
        "NodeBeacon utilizes MySQL 8.x with InnoDB storage engine for ACID transaction guarantees, strict foreign keys, and optimized composite B-tree indexes.",
        styles['Body']
    ))

    db_tables_data = [
        [Paragraph("Table Name", styles['TableHeader']), Paragraph("Primary Key & Relationships", styles['TableHeader']), Paragraph("Key Fields & Types", styles['TableHeader']), Paragraph("Indexes & Optimization Purpose", styles['TableHeader'])],
        [
            Paragraph("users_user", styles['TableCellBold']),
            Paragraph("id (PK)<br/>organization_id (FK)", styles['TableCell']),
            Paragraph("email (UK), role, cpu_threshold, memory_threshold, disk_threshold, heartbeat_timeout, telegram_chat_id, google_id", styles['TableCell']),
            Paragraph("Indexed on email and google_id for sub-millisecond login lookups.", styles['TableCell'])
        ],
        [
            Paragraph("users_organization", styles['TableCellBold']),
            Paragraph("id (PK)<br/>owner_id (FK to User)", styles['TableCell']),
            Paragraph("organization_name, alert_email, alert_recipients (Text), created_at", styles['TableCell']),
            Paragraph("Normalizes multi-tenant company accounts and shared notification lists.", styles['TableCell'])
        ],
        [
            Paragraph("servers_server", styles['TableCellBold']),
            Paragraph("id (PK)<br/>owner_id (FK)<br/>organization_id (FK)", styles['TableCell']),
            Paragraph("name, hostname, operating_system, ip_address, api_key (UK), status, device_id (UUID), device_token_hash, last_seen", styles['TableCell']),
            Paragraph("Composite indexes: <code>(owner, -created_at)</code> and <code>(device_token_hash)</code>.", styles['TableCell'])
        ],
        [
            Paragraph("metrics_metric", styles['TableCellBold']),
            Paragraph("id (PK)<br/>server_id (FK CASCADE)", styles['TableCell']),
            Paragraph("cpu_usage (Float), memory_usage (Float), disk_usage (Float), network_in (BigInt), network_out (BigInt), uptime, timestamp", styles['TableCell']),
            Paragraph("High-write append table. Composite index: <code>(server, -timestamp)</code> for fast chart telemetry queries.", styles['TableCell'])
        ],
        [
            Paragraph("alerts_alert", styles['TableCellBold']),
            Paragraph("id (PK)<br/>server_id (FK)<br/>metric_id (FK Null)", styles['TableCell']),
            Paragraph("title, description (Text), severity ('Critical'/'Warning'), status ('Active'/'Resolved'), created_at, resolved_at", styles['TableCell']),
            Paragraph("Composite indexes: <code>(server, status)</code> and <code>(status, -created_at)</code>.", styles['TableCell'])
        ],
        [
            Paragraph("servers_agentenrollment", styles['TableCellBold']),
            Paragraph("id (PK)<br/>server_id (FK CASCADE)", styles['TableCell']),
            Paragraph("token_hash (UK), expires_at (DateTime), used_at (DateTime Null), created_at", styles['TableCell']),
            Paragraph("Enforces single-use 30-minute agent installation handshakes with row locks.", styles['TableCell'])
        ],
        [
            Paragraph("servers_unlocknotification", styles['TableCellBold']),
            Paragraph("id (PK)<br/>server_id (FK CASCADE)", styles['TableCell']),
            Paragraph("event_id (UUID UK), delivery_status ('Pending'/'Sent'), created_at, attempted_at, delivered_at", styles['TableCell']),
            Paragraph("Composite index: <code>(server, -created_at)</code>. UUID UK guarantees delivery idempotency.", styles['TableCell'])
        ],
    ]

    t_db = Table(db_tables_data, colWidths=[95, 105, 160, 163.27])
    t_db.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_dark),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    for row_idx in range(1, len(db_tables_data)):
        bg = bg_light if row_idx % 2 == 1 else colors.white
        t_db.setStyle(TableStyle([('BACKGROUND', (0, row_idx), (-1, row_idx), bg)]))

    story.append(t_db)
    story.append(PageBreak())

    # ==========================================
    # 7. REST API ENDPOINTS SPECIFICATION
    # ==========================================
    story.append(Paragraph("6. REST API Endpoints Specification", styles['H1']))
    story.append(HRFlowable(width="100%", thickness=1, color=accent_green, spaceAfter=6, spaceBefore=2))

    api_data = [
        [Paragraph("HTTP Method", styles['TableHeader']), Paragraph("API Endpoint URI", styles['TableHeader']), Paragraph("Authentication", styles['TableHeader']), Paragraph("Functional Description", styles['TableHeader'])],
        
        # Auth
        [Paragraph("POST", styles['TableCellBold']), Paragraph("/api/auth/register/", styles['TableCell']), Paragraph("Public", styles['TableCell']), Paragraph("Registers a new administrator account", styles['TableCell'])],
        [Paragraph("POST", styles['TableCellBold']), Paragraph("/api/auth/login/", styles['TableCell']), Paragraph("Public", styles['TableCell']), Paragraph("Authenticates credentials and returns JWT Access &amp; Refresh pair", styles['TableCell'])],
        [Paragraph("GET", styles['TableCellBold']), Paragraph("/api/auth/google/url/", styles['TableCell']), Paragraph("Public", styles['TableCell']), Paragraph("Returns Google OAuth 2.0 authorization URL with signed state", styles['TableCell'])],
        [Paragraph("POST", styles['TableCellBold']), Paragraph("/api/auth/google/", styles['TableCell']), Paragraph("Public", styles['TableCell']), Paragraph("Exchanges Google authorization code for JWT user session", styles['TableCell'])],
        [Paragraph("POST", styles['TableCellBold']), Paragraph("/api/auth/refresh/", styles['TableCell']), Paragraph("Public", styles['TableCell']), Paragraph("Renews expired access token using valid refresh token", styles['TableCell'])],
        [Paragraph("GET / PATCH", styles['TableCellBold']), Paragraph("/api/auth/profile/", styles['TableCell']), Paragraph("JWT Bearer", styles['TableCell']), Paragraph("Fetches or updates user alert thresholds and contact info", styles['TableCell'])],

        # Servers & Agent
        [Paragraph("GET / POST", styles['TableCellBold']), Paragraph("/api/servers/", styles['TableCell']), Paragraph("JWT Bearer", styles['TableCell']), Paragraph("Lists all fleet servers or registers a new server entity", styles['TableCell'])],
        [Paragraph("GET / DELETE", styles['TableCellBold']), Paragraph("/api/servers/&lt;id&gt;/", styles['TableCell']), Paragraph("JWT Bearer", styles['TableCell']), Paragraph("Inspects or unregisters a specific server node", styles['TableCell'])],
        [Paragraph("POST", styles['TableCellBold']), Paragraph("/api/servers/&lt;id&gt;/agent-download/", styles['TableCell']), Paragraph("JWT Bearer", styles['TableCell']), Paragraph("Generates customized one-click Windows agent ZIP package", styles['TableCell'])],
        [Paragraph("POST", styles['TableCellBold']), Paragraph("/api/servers/agents/register/", styles['TableCell']), Paragraph("Public (Token)", styles['TableCell']), Paragraph("Agent enrollment handshake; exchanges one-time token for device token", styles['TableCell'])],
        [Paragraph("GET / PATCH", styles['TableCellBold']), Paragraph("/api/servers/agents/config/", styles['TableCell']), Paragraph("Device Token", styles['TableCell']), Paragraph("Fetches or patches remote polling interval and backend target URLs", styles['TableCell'])],
        [Paragraph("POST", styles['TableCellBold']), Paragraph("/api/servers/agents/heartbeat/", styles['TableCell']), Paragraph("Device Token", styles['TableCell']), Paragraph("Endpoint process heartbeat ('Connected', 'Reconnecting', 'Stopped')", styles['TableCell'])],
        [Paragraph("POST", styles['TableCellBold']), Paragraph("/api/servers/agents/unlocked/", styles['TableCell']), Paragraph("Device Token", styles['TableCell']), Paragraph("Delivers idempotent Windows session unlock notification event", styles['TableCell'])],

        # Metrics & Alerts
        [Paragraph("POST", styles['TableCellBold']), Paragraph("/api/metrics/", styles['TableCell']), Paragraph("Device Token / Key", styles['TableCell']), Paragraph("Ingests compute telemetry and triggers threshold alert checks", styles['TableCell'])],
        [Paragraph("GET", styles['TableCellBold']), Paragraph("/api/metrics/", styles['TableCell']), Paragraph("JWT Bearer", styles['TableCell']), Paragraph("Retrieves latest telemetry metrics across all owned servers", styles['TableCell'])],
        [Paragraph("GET", styles['TableCellBold']), Paragraph("/api/servers/&lt;id&gt;/metrics/", styles['TableCell']), Paragraph("JWT Bearer", styles['TableCell']), Paragraph("Retrieves historical time-series metrics for server charts", styles['TableCell'])],
        [Paragraph("GET", styles['TableCellBold']), Paragraph("/api/metrics/export-pdf/", styles['TableCell']), Paragraph("JWT Bearer", styles['TableCell']), Paragraph("Downloads dynamic PDF performance audit report with charts", styles['TableCell'])],
        [Paragraph("GET / PATCH", styles['TableCellBold']), Paragraph("/api/alerts/", styles['TableCell']), Paragraph("JWT Bearer", styles['TableCell']), Paragraph("Lists active and resolved alerts or marks incident resolved", styles['TableCell'])],
    ]

    t_api = Table(api_data, colWidths=[65, 175, 85, 198.27])
    t_api.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_dark),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 2.8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.8),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    for row_idx in range(1, len(api_data)):
        bg = bg_light if row_idx % 2 == 1 else colors.white
        t_api.setStyle(TableStyle([('BACKGROUND', (0, row_idx), (-1, row_idx), bg)]))

    story.append(t_api)
    story.append(PageBreak())

    # ==========================================
    # 8. END-TO-END EXECUTION WORKFLOW
    # ==========================================
    story.append(Paragraph("7. End-to-End Execution Workflow", styles['H1']))
    story.append(HRFlowable(width="100%", thickness=1, color=accent_green, spaceAfter=6, spaceBefore=2))

    flow_data = [
        [Paragraph("Phase", styles['TableHeader']), Paragraph("Action / Trigger", styles['TableHeader']), Paragraph("System Internal Mechanics", styles['TableHeader'])],
        [
            Paragraph("Phase 1: Onboarding", styles['TableCellBold']),
            Paragraph("User registers or signs in with Google SSO.", styles['TableCell']),
            Paragraph("Backend creates User record, establishes JWT session tokens, and loads default threshold settings (90% CPU, 90% RAM, 95% Disk).", styles['TableCell'])
        ],
        [
            Paragraph("Phase 2: Fleet Provisioning", styles['TableCellBold']),
            Paragraph("Admin adds a server and downloads the agent installer.", styles['TableCell']),
            Paragraph("Backend generates unique Server entity, issues an ephemeral 30-minute enrollment token, and bundles <code>NodeBeaconAgent.exe</code> with <code>enrollment.json</code>.", styles['TableCell'])
        ],
        [
            Paragraph("Phase 3: Agent Activation", styles['TableCellBold']),
            Paragraph("Admin extracts and launches the executable on the target server.", styles['TableCell']),
            Paragraph("Agent exchanges enrollment token for permanent <code>device_token</code>. Agent starts background collection loop and session unlock hooks.", styles['TableCell'])
        ],
        [
            Paragraph("Phase 4: Telemetry Streaming", styles['TableCellBold']),
            Paragraph("Agent posts metrics every 10s via HTTPS.", styles['TableCell']),
            Paragraph("Backend writes metric to MySQL, updates server status to 'Online', refreshes last seen time, and pushes latest points to dashboard charts.", styles['TableCell'])
        ],
        [
            Paragraph("Phase 5: Incident Resolution", styles['TableCellBold']),
            Paragraph("CPU utilization exceeds threshold or heartbeat is missed.", styles['TableCell']),
            Paragraph("Backend creates Active Critical Alert, dispatches responsive HTML email and Telegram notification. Resolves alert automatically once compute load stabilizes.", styles['TableCell'])
        ],
    ]

    t_flow = Table(flow_data, colWidths=[95, 160, 268.27])
    t_flow.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_dark),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    for row_idx in range(1, len(flow_data)):
        bg = bg_light if row_idx % 2 == 1 else colors.white
        t_flow.setStyle(TableStyle([('BACKGROUND', (0, row_idx), (-1, row_idx), bg)]))

    story.append(t_flow)
    story.append(Spacer(1, 8))

    # ==========================================
    # 9. KEY HIGHLIGHTS & VIVA SUMMARY
    # ==========================================
    story.append(Paragraph("8. Key Advantages & Presentation Highlights", styles['H1']))
    story.append(HRFlowable(width="100%", thickness=1, color=accent_green, spaceAfter=6, spaceBefore=2))

    story.append(Paragraph(
        "<b>Summary of Distinct Engineering Highlights:</b><br/>"
        "1. <b>Zero Configuration Onboarding:</b> Monitored servers require no Python installation, no manual credential typing, and no complex service configuration.<br/>"
        "2. <b>True Multi-Channel Alerting:</b> Instantaneous failover alerts delivered via SMTP Email, Telegram Bot deep links, and desktop notifications.<br/>"
        "3. <b>Dual Authentication Boundaries:</b> Human users authenticate with JWT and Google OAuth SSO, while server machines communicate strictly via SHA-256 hashed device tokens.<br/>"
        "4. <b>Low Resource Consumption:</b> The native monitoring daemon consumes less than 20 MB of resident RAM and under 0.5% CPU overhead.<br/>"
        "5. <b>Dynamic In-Memory PDF Reporting:</b> Generates vector audit reports with dynamic page counts and 4-quadrant telemetry plots without saving temporary files to disk.<br/>"
        "6. <b>Persistent Visual Themes:</b> Sleek dark/light theme switching with smooth transitions and persistent browser preferences.",
        styles['Body']
    ))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    return pdf_path

if __name__ == '__main__':
    target_file = sys.argv[1] if len(sys.argv) > 1 else "NodeBeacon_Project_Report.pdf"
    path = build_pdf(target_file)
    print(f"[SUCCESS] PDF Generated successfully at: {path}")
