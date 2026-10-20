# NodeBeacon

NodeBeacon is a lightweight infrastructure monitoring platform built with React, Django, and Python. It allows administrators to monitor servers in real time, collect system metrics, and visualize resource usage through a modern web dashboard.

This project was developed to explore full-stack development, monitoring systems, and agent-based architecture.

## Features

- User authentication using JWT
- Real-time server monitoring
- CPU, memory, disk, and network metrics
- Server registration and management
- Online/offline detection
- Alert management
- Interactive dashboard
- Windows monitoring agent
- Modern responsive interface
- Optional laptop-unlock email notifications and persistent light/dark mode
- Optional Telegram laptop-unlock alerts

## Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Axios
- Framer Motion
- Recharts

### Backend

- Django
- Django REST Framework
- MySQL 8.x
- JWT Authentication

### Monitoring Agent

- Python
- psutil
- requests
- PyInstaller

## Project Structure

```
NodeBeacon
├── frontend
├── backend
├── agent
└── README.md
```

## Running the project

### Backend

```bash
cd backend
py -3.11 -m venv venv
venv\Scripts\Activate.ps1
py -3.11 -m pip install -r requirements.txt
copy .env.example .env
py -3.11 manage.py migrate
py -3.11 manage.py createsuperuser
py -3.11 manage.py runserver
```

### MySQL setup

Install MySQL Server 8.x and create a database and application user. Run the
following in MySQL as an administrator:

```sql
CREATE DATABASE nodebeacon
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'nodebeacon_app'@'localhost'
  IDENTIFIED BY 'replace-with-a-strong-password';

GRANT ALL PRIVILEGES ON nodebeacon.*
  TO 'nodebeacon_app'@'localhost';

FLUSH PRIVILEGES;
```

Copy `backend/.env.example` to `backend/.env` and set the real values for
`SECRET_KEY`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. The `.env` file must not
be committed. The previous `backend/db.sqlite3` file and Django migrations are
left untouched, but the application now uses MySQL when started.

Then run:

```bash
cd backend
venv\Scripts\activate
py -3.11 manage.py check
py -3.11 manage.py showmigrations
py -3.11 manage.py migrate
py -3.11 manage.py createsuperuser
py -3.11 manage.py runserver
```

The database model and optional MySQL view/stored-procedure examples are
documented in `backend/DATABASE.md` and `backend/mysql_examples.sql`.

Laptop-unlock alerts require configured backend SMTP settings and are opt-in
per account. The message is email (which reaches your phone only if you can
access that mailbox there); WhatsApp delivery is not implemented. See
`AGENT_SETUP.md` for notification setup and update/reinstall instructions.
The dashboard theme toggle defaults to dark and remembers your choice in the
browser.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Agent

```bash
cd agent
py -3.11 -m pip install -r requirements.txt
py -3.11 build.py
```

The Windows installer is now downloaded per device from **Download Agent** on
the authenticated dashboard. Extract the full ZIP, including `_internal` and
`enrollment.json`, then open `NodeBeaconAgent.exe`. Installation needs Windows
administrator approval. See [AGENT_SETUP.md](AGENT_SETUP.md) for Start/Stop,
remote configuration, security, reinstall, uninstall and verification steps.

## Screenshots

### Dashboard

_Add dashboard screenshot here._

### Servers

_Add server management screenshot here._

### Alerts

_Add alerts screenshot here._

## Current Status

Completed

- Authentication
- Dashboard
- Monitoring Agent
- Metrics Collection
- Server Management
- Alert System

Planned

- Slack integration
- Discord integration
- Docker deployment
- Grafana integration

## Future Improvements

- Multi-user organizations
- Agent auto-discovery
- WebSocket-based live updates
- Linux service installer
- Production deployment

## Author

Neeraj

GitHub: https://github.com/neeraj181-dot
