# Audit dashboard

The audit log records security-relevant and content-management actions in the `audit_log` table. Phase 13 exposes it in the admin UI and via API.

## Admin UI

Open **System → Audit Log** (`/admin/audit`) when you have `audit:read`.

Features:

- Paginated list (newest first)
- Filter by action, entity type, actor user ID, date range
- Metadata search (`q` matches entity ID or JSON metadata)
- Detail panel with full entry JSON

## API

```http
GET /api/audit?action=login&entity_type=auth&limit=50&offset=0
```

Query parameters:

| Parameter | Description |
|-----------|-------------|
| `actor_id` | Filter by user ID |
| `action` | Exact action slug |
| `entity_type` | Entity type (e.g. `user`, `page`, `plugin`) |
| `q` | Search metadata JSON and entity ID |
| `from` | ISO date lower bound (`created_at >=`) |
| `to` | ISO date upper bound |
| `limit` | Page size (1–200, default 50) |
| `offset` | Pagination offset |

Requires `audit:read` (or legacy `users.manage`).

## Audited actions

| Category | Actions | Entity types |
|----------|---------|--------------|
| Auth | `login`, `login_failed`, `logout` | `auth` |
| Users | `create`, `update`, `disable`, `enable`, `reset_password` | `user`, `user_roles` |
| Roles | `create`, `update` | `role`, `permission` |
| Content | `create`, `update`, `delete`, `publish` | `page`, `post`, `event`, generic types |
| Media | `create`, `update`, `delete` | `media` |
| Forms | `create`, `update`, `delete` | `form`; submissions as `form_submission` |
| Workflow | `approve`, `reject`, etc. | content entities |
| Revisions | `restore` | content entities |
| Plugins | `update`, `delete` | `plugin` |
| Theme | `update` | `theme_settings` |
| Search | `rebuild` | `search_index` |

## Metadata safety

`writeAuditLog` strips sensitive keys (`password`, `token`, `session`, etc.) before persistence. Do not pass credentials in metadata from new code.

## Storage

Table: `audit_log` (migration `0002_cms_foundation.sql`)

Indexes added in `0013_users_roles_audit_permissions.sql` on `action` and `entity_type`.

## Related docs

- [permissions-matrix.md](./permissions-matrix.md) — who can read the audit API
- [security-hardening.md](./security-hardening.md) — login rate limiting and guards
