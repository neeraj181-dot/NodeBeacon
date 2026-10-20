# NodeBeacon MySQL database design

NodeBeacon uses MySQL 8.x through Django's MySQL backend. The database stores
application state and monitoring history; the React frontend and monitoring
agent communicate with it only through the Django REST API.

## Tables and relationships

- `users_user`: login accounts, roles, thresholds, and notification settings.
- `users_organization`: organization settings and the organization owner.
- `servers_server`: monitored devices and their current status/API credential.
- `metrics_metric`: time-series CPU, memory, disk, network, and uptime samples.
- `alerts_alert`: threshold and offline alerts for a server.
- `servers_unlocknotification`: unique unlock-event IDs and notification delivery state.
- `users_telegrampairing`: expiring, hashed one-time Telegram connection codes.
- `users_telegrambotcursor`: consumed Telegram update offset for safe pairing.

Relationships:

```text
Organization 1 ---- many User
User         1 ---- many Server
Server       1 ---- many Metric
Server       1 ---- many Alert
Server       1 ---- many UnlockNotification
User         1 ---- many TelegramPairing (temporary; expires after ten minutes)
Metric       1 ---- many Alert (optional alert reference)
```

All Django primary keys are integer auto-increment keys. Foreign keys use the
model relationships and their configured `on_delete` behavior. Existing models
are normalized around users, organizations, servers, metrics, and alerts.

## Indexes

Django already indexes foreign keys and important timestamps. Additional
composite indexes support the actual dashboard queries:

- metrics by server and newest timestamp
- servers by owner and newest creation time
- servers by organization and newest creation time
- alerts by server/status
- alerts by status and newest creation time
- unlock notifications by server and newest timestamp; unique event UUID prevents duplicate delivery

Metric history is append-heavy. For a larger deployment, add a retention or
aggregation policy so the metrics table does not grow indefinitely.

## MySQL notes

- Use MySQL 8.x with `utf8mb4`.
- Django manages foreign keys and migrations; do not edit tables manually after
  migrations have been applied.
- `DateTimeField` values are stored with timezone support through Django's
  `USE_TZ` setting.
- Boolean fields map to MySQL-compatible boolean/tiny integer columns.
- Text fields are used for alert descriptions and comma-separated recipients.
- Usernames and emails should be validated at the application layer; MySQL
  collation should be selected consistently if case-insensitive uniqueness is
  required.

## Windows device enrollment and configuration

`servers_server` remains the device record, with its auto-increment `id` PK,
`owner_id` FK to User and optional `organization_id` FK. A nullable unique
UUID `device_id` identifies an enrolled installation independently of its IP.
`device_token_hash` is indexed for authentication; raw device tokens are not
stored in MySQL. The table also holds `agent_server_url`, nullable
`agent_server_port`, `config_version`, `agent_status`, `agent_last_seen` and
`agent_version`. Local enabled/disabled preference belongs to the installed
Windows configuration, not a remote Start/Stop API.

`servers_agentenrollment` has an auto-increment `id` PK, `server_id` FK
(`CASCADE`), a unique indexed `token_hash`, indexed `expires_at`, nullable
`used_at` and `created_at`. Multiple historical enrollments relate to one
Server; only its latest unconsumed, unexpired enrollment can be redeemed.
A `(server_id, expires_at)` index supports lifecycle queries. Registration
consumption and credential creation are one transaction with row locks.
Migrations `servers.0004`/`0005` add these fields/table without deleting
existing servers, metrics or SQLite files.

This preserves normalization: users own servers, each server has many
enrollments and metrics, and configuration is not duplicated in every metric.
Device credentials authenticate only their associated Server; management is
owner-only even when organization fleet metrics are shared.

Telegram bot credentials are environment secrets and are never stored in these
tables. `users_user.telegram_chat_id` is unique and nullable so one private chat
cannot be bound to multiple NodeBeacon accounts; the base profile serializer
does not expose it. `notify_on_laptop_unlock_telegram` is a default-off owner
preference. `users_telegrampairing` stores only a unique SHA-256 pairing-code
hash, owner FK, and expiry; raw deep-link codes are shown only once to that
owner. `users_telegrambotcursor` persists the Telegram update offset used during
pairing. Migration `users.0005` adds these fields/tables without modifying
existing account or monitoring records.

`users_user.notify_on_laptop_unlock` is a default-off Boolean preference. It is
owned by that account; a device-authenticated unlock request resolves the
device's own Server and only that Server owner's email settings. The
`servers_unlocknotification` table has an integer PK, cascading `server_id`
FK, globally unique `event_id` UUID, delivery status, created/attempted/sent
timestamps, and a `(server_id, created_at DESC)` index. This is an append-style
delivery audit/idempotency table; email content and SMTP credentials are not
stored there. Django migration `users.0004` adds the preference and
`servers.0006` adds the event table.
