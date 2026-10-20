# NodeBeacon Windows agent integration

## Architecture and what was preserved

The existing application uses React/Vite, Django REST Framework/JWT, MySQL,
and a Python/psutil monitoring agent. The website already polls metrics and
servers every ten seconds; there is no WebSocket requirement. Existing users,
organizations, fleet metrics, alerts, PDF reports, and legacy API-key telemetry
remain supported. No frontend/backend framework was replaced.

The existing Windows service is retained because monitoring must survive
closing the desktop window and Windows startup. Its single worker collects
metrics. A separate single-instance Tk desktop window controls that service.
There can legitimately be two EXE processes while the controls are open:
one service worker and one UI, never a worker spawned by each UI launch.
The directory-based PyInstaller package avoids one-file bootloader child
processes and startup extraction delays.

## Build and start development

From the repository root in PowerShell:

```powershell
cd backend
py -3.11 -m pip install -r requirements.txt
# Configure backend/.env; do not overwrite your existing real credentials.
py -3.11 manage.py check
py -3.11 manage.py migrate
py -3.11 manage.py collectstatic --noinput
py -3.11 manage.py runserver 127.0.0.1:8000 --noreload
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Build on Windows with Python 3.11:

```powershell
cd agent
py -3.11 -m pip install -r requirements.txt
py -3.11 build.py
```

Output: `agent/dist/NodeBeaconAgent/NodeBeaconAgent.exe` plus `_internal`.
The maintained spec resolves paths relative to itself. No backend IP,
database password, or permanent device credential is compiled into the EXE.
The old top-level one-file EXE may remain on disk, but is not used for downloads.

## Address configuration: four different concepts

- `VITE_API_URL`: website's API base URL (frontend build environment).
- `AGENT_PUBLIC_URL`: enrollment/configuration backend origin, configured in
  `backend/.env`. If blank, the authenticated download request's backend origin
  is used. Use a reachable address, not localhost, for another PC.
- Device host/port: metrics destination edited in **Configure / Install agent**.
- Node IP and device UUID: monitored PC metadata and identity, respectively.

For another PC on the LAN, choose the backend machine's LAN host for
`AGENT_PUBLIC_URL`, add that host to `ALLOWED_HOSTS`, bind Django to
`0.0.0.0:8000` for development, and permit the necessary firewall port yourself.
These steps do not change the monitored PC's Wi-Fi address. Production must
use HTTPS, a stable domain and a production server, not Django runserver.

The original management origin remains fixed locally so the agent can discover
a destination change even when the old metrics address fails. A new metrics
host must be a trusted endpoint serving the SAME NodeBeacon backend/database
and device credential. This is endpoint switching, not database migration.
Moving to an unrelated backend is not supported. Keep the management origin
reachable; moving it requires a reinstall/reset or a stable DNS/reverse proxy.

## Download, install, control and configure

1. Log in at the website. Create a node for the authorized PC if needed.
2. Open **Download Agent** or the node's **Configure / Install agent** button.
   Only the owner can manage device enrollment/configuration.
3. Set a backend host/URL and optional port and choose **Save & Apply**.
4. Download setup. Extract the entire ZIP; `_internal`, `enrollment.json` and
   `NodeBeaconAgent.exe` must stay together. Do not share the ZIP.
5. Run the EXE and approve UAC. Click Install within thirty minutes of download.
   Downloading again invalidates prior unused enrollment packages.
6. Setup copies the EXE/dependencies to `C:\Program Files\NodeBeacon Agent`,
   creates the automatic `NodeBeaconAgent` service and shortcuts, registers
   Windows Apps uninstall information, and saves configuration in
   `C:\ProgramData\NodeBeacon\config.json`.
7. Open the desktop shortcut for status, backend host/port, device ID/name,
   last successful connection and version. Closing the window does not stop
   monitoring. **Stop agent** requests SCM shutdown, waits for the worker and
   persists `enabled=false`. **Start agent** persists true and starts SCM.
8. Change host/port on the website and save. The worker polls configuration on
   each cycle, validates device identity/version, atomically saves the change
   and reconnects without modifying or reinstalling the EXE.

Stop allows an already in-flight request to finish and sends one final
`Stopped` heartbeat. After worker shutdown there is no polling, collection,
heartbeat or reconnect activity. Website edits while stopped are picked up
after Start. If the backend is unreachable at shutdown, it may show Offline
rather than Stopped until the agent reconnects.

The worker uses interruptible 5/10/30/60-second retry delays and resets after
successful telemetry. Failed authentication is shown explicitly. Requests
have bounded timeouts and do not follow redirects with device credentials.
Logs rotate at `C:\ProgramData\NodeBeacon\logs\agent.log` (2 MB, three backups).

## Laptop-unlock email alerts

The Windows service subscribes to Windows Service Control Manager session
change notifications and reacts only to `WTS_SESSION_UNLOCK` (not startup,
screen activity or lock events). It queues the event once, assigns a UUID, and
reuses that ID during network retries so the backend sends at most one email
per unlock. Stopping the service stops notification delivery; the service
resumes detection when started. The desktop controls show the last unlock-alert
delivery state/error.

Unlock alerts are opt-in and owner-only. In **Settings → Notifications**, enable
Email Alarms, set the recipient email (or use your account email), then enable
**Laptop unlock email**. Configure the existing Django SMTP settings in
`backend/.env` (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS` or
`EMAIL_USE_SSL`, `EMAIL_HOST_USER`, and `EMAIL_HOST_PASSWORD`), restart the
backend, and verify email delivery. TLS and SSL must not both be enabled. For
Gmail, use an app password rather than your normal account password. Keep this
secret only in the ignored `.env` file or deployment secret store; do not put
it in the agent package, source code, chat, logs, or MySQL. Use HTTPS in production.
If SMTP is missing or delivery fails, the agent displays an error and retries
temporary backend/network failures. Tests mock the mail sender and never send
messages to real people.

This feature sends email, not SMS/WhatsApp. An email alert reaches your phone
only if you can access that mailbox on the phone. WhatsApp notifications would
require a separately configured approved WhatsApp Business provider; NodeBeacon
does not claim or attempt WhatsApp support.

## Telegram laptop-unlock alerts

1. In Telegram, open the official `@BotFather`, run `/newbot`, and follow its
   prompts. Treat the resulting bot token like a password.
2. Add `TELEGRAM_BOT_TOKEN=<your token>` to the private `backend/.env` file.
   Never put the token in the frontend, a downloaded agent, source control, or
   chat. Restart Django after changing `.env`; the backend needs outbound HTTPS
   access to `api.telegram.org`. Do not configure a webhook for this bot; the
   NodeBeacon pairing flow uses Telegram's `getUpdates` API.
   `TELEGRAM_CHAT_ID` is optional and is used only as a recipient for the
   authenticated development test button when `DEBUG=True`. Real unlock alerts
   always go to the account's verified Telegram chat stored by the pairing flow.
3. In NodeBeacon, go to **Integrations → Telegram Unlock Alerts → Connect
   Telegram**. Open the generated bot link in Telegram, press **Start**, return
   to NodeBeacon, and press **Verify Connection**. Pairing links expire after
   ten minutes. NodeBeacon verifies the private chat using that one-time code
   and sends a setup test message; no chat ID needs to be copied or shared.
4. Press **Send Test Telegram** to test again, then enable **Unlock Alerts** on
   the Telegram card. Each enrolled agent's Windows unlock event will be sent
   to that connected chat. The feature is owner/account-scoped; a chat can only
   be connected to one NodeBeacon account at a time.

The bot token stays in backend environment configuration. The database stores
only the account's Telegram chat ID and a hash of any temporary pairing code;
the token and pairing code are not returned by profile APIs. Telegram delivery
status is reported by the connection/test flow and the agent's unlock status.

Existing installations need the updated service binary. Stop and uninstall the
old agent, use **Reset enrollment for reinstall** on the owner's device page,
then download and install the current package. This invalidates the old device
credential but preserves the server and its metrics. Configure the settings
afterward and start the new service.

## Security and persistence

Enrollment tokens are single-use, thirty-minute random credentials. Permanent
device tokens are returned once after enrollment and stored as SHA-256 hashes
in MySQL. Tokens are never returned in the fleet/configuration APIs.
The local config stores Windows machine-scoped DPAPI ciphertext, not plaintext
device tokens. Setup restricts ProgramData to SYSTEM and Administrators.
Atomic fsync + replace writes prevent partially written JSON. Copying the
encrypted config to another Windows machine will not transfer its credential.

Management uses the existing website JWT authentication and owner filtering;
device requests use `X-Device-Token` and resolve their own Server only.
Shared organization fleet views retain metrics access but omit agent secrets
and owner-only device settings. Non-owners cannot modify/delete shared nodes.
The profile API cannot edit role/organization fields. No remote command
execution or remote Start/Stop was introduced.

If enrollment succeeds but local installation crashes before saving the
credential, use **Reset enrollment for reinstall**, then download again.
Reset explicitly revokes both previous device and legacy API-key credentials
without deleting metrics history. Stop/uninstall the previous application
first. Only one installation on a PC is supported by the service/data paths.

## APIs

Server-agent paths start with `/api/servers/`; user/account paths start with
`/api/`.

| Method/path | Authentication | Purpose |
| --- | --- | --- |
| POST `{id}/agent-download/` | Owner JWT | EXE/dependencies ZIP + one-use enrollment |
| POST `agents/register/` | Enrollment token in JSON `token` | Redeem once; issue hashed-at-rest device credential |
| GET/PATCH `{id}/agent-config/` | Owner JWT | Read or validate/save host/port; increment version |
| POST `{id}/agent-reset/` | Owner JWT + `confirm: true` | Explicitly revoke old enrollment credentials |
| GET `agents/config/` | Device token header | Retrieve this device's configuration |
| POST `agents/heartbeat/` | Device token header | Connected/Reconnecting/Stopped, version, last seen |
| POST `agents/unlocked/` | Device token header | Idempotent laptop-unlock email or Telegram delivery |
| GET/PATCH `/api/telegram/settings/` | Owner JWT | Read connection state; enable/disable Telegram unlock alerts |
| POST `/api/telegram/connect/start/` | Owner JWT | Create a short-lived pairing link |
| POST `/api/telegram/connect/verify/` | Owner JWT | Verify the private Telegram chat and send a setup message |
| POST `/api/telegram/test/` | Owner JWT | Send a test to the connected chat, or local development test recipient |

Existing `POST /api/metrics/` accepts the new device token or legacy
`X-API-Key`. Existing fleet APIs are reused for listing devices. The obsolete
unauthenticated `/api/agent/download/` returns 410 with migration guidance so
it cannot serve a stale, unconfigured binary.

## Database changes

No duplicate device table: Server now holds nullable unique `device_id`,
indexed `device_token_hash`, backend origin/port, version, status, last seen,
and agent version. New installations populate these; existing rows remain
valid. AgentEnrollment references Server with cascade deletion and contains
unique indexed token hash, expiry, used timestamp and creation timestamp.
Its composite `(server, expires_at)` index supports enrollment lifecycle
queries. Migrations `servers.0004` and `0005` add these structures.
Migrations `servers.0004`–`0006` add these structures, including an indexed
unlock-notification history table with unique event IDs. See `backend/DATABASE.md`
for the rest of the normalized schema/indexes.

## Uninstall

Use **Settings → Apps → Installed apps → NodeBeacon Agent → Uninstall**,
or close the desktop controls and run this in elevated PowerShell:

```powershell
& 'C:\Program Files\NodeBeacon Agent\NodeBeaconAgent.exe' --uninstall
```

The `&` is required to execute a quoted path in PowerShell. The uninstall
confirmation stops/waits for the service, removes SCM and Apps registration,
shortcuts, configuration/logs, and uses one hidden native PowerShell helper
to remove program files after the EXE exits. Targets are fixed and validated;
redirected installation/data folders are refused. Website metrics/history
are not deleted. Close other agent windows before uninstalling.

## Repeatable tests and manual acceptance

```powershell
cd backend
py -3.11 manage.py test --noinput
py -3.11 manage.py makemigrations --check --dry-run
cd ..\agent
py -3.11 -m unittest test_agent -v
py -3.11 smoke_test.py  # backend 8000 and frontend 5173 must be running
```

The smoke test creates/removes only its own temporary account, node and
metrics, redeems an actual downloaded package, runs the real collector/HTTP
worker with temporary local configuration, checks persisted Stop/Start,
changes the destination port to an unavailable localhost port, restores it,
and verifies recovery. It does not install a Windows service.

The EXE supports `--diagnostics <report-file>` for the same isolated unit
tests. `--probe-instance <report-file>` is a five-second diagnostic mutex
probe; launching three concurrently should give exactly one `acquired` and
two `duplicate` reports. Neither diagnostic mode starts monitoring.

Actual UAC/SCM installation, physical network disconnect, Windows restart,
interactive GUI clicks and complete file-removal uninstall must be checked
manually in an elevated interactive Windows session. Verify Connected and
last seen, stop and confirm no more metrics, start and confirm recovery,
save a reachable new host/port and inspect the local config, restart Windows
with enabled true/false, then uninstall and confirm no service/process/files.
Automated SCM/UI/uninstall tests use mocks; they are not substitutes for
these actual Windows acceptance checks. This build is unsigned; Windows
SmartScreen may require publisher signing before production distribution.
