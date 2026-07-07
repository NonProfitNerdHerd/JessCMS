# Users and roles

Phase 13 adds first-class user and role management APIs and admin UI without replacing the existing session-based auth system.

## Data model

- **`users`** — accounts (`email`, `password_hash`, `name`, legacy `role` column, `is_active`)
- **`user_roles`** — many-to-many user ↔ role assignments (canonical RBAC)
- **`roles`** — `admin`, `editor`, `viewer`, plus custom roles
- **`role_permissions`** — role ↔ permission grants
- **`permissions`** — granular slugs (`content:create`, `users:read`, …)

The legacy `users.role` column is still updated for compatibility but authorization uses `user_roles` + `role_permissions`.

## Admin UI

| URL | Purpose |
|-----|---------|
| `/admin/users` | List users |
| `/admin/users/new` | Create user |
| `/admin/users/:id` | Edit user, roles, disable/enable, reset password |
| `/admin/roles` | List roles; create custom role |
| `/admin/roles/:id` | Edit role name/description and permissions |

Navigation appears under **System** when the signed-in user has `users:read`, `roles:read`, or `audit:read`.

## API

See [permissions-matrix.md](./permissions-matrix.md) for the full route table.

### Create user

```http
POST /api/users
Content-Type: application/json

{
  "email": "editor@example.com",
  "name": "Site Editor",
  "password": "minimum-12-chars",
  "role_ids": ["role_editor"]
}
```

### Assign roles

```http
PUT /api/users/:id
Content-Type: application/json

{
  "role_ids": ["role_editor", "role_viewer"]
}
```

### Update role permissions

```http
PUT /api/roles/:id
Content-Type: application/json

{
  "name": "Custom reviewer",
  "permission_ids": ["perm_content_read", "perm_revisions_read"]
}
```

Permission IDs come from `GET /api/permissions`.

## Default roles

| Role | Typical use |
|------|-------------|
| `admin` | Full access including user/role/audit management |
| `editor` | Create and edit content, media, forms |
| `viewer` | Read-only content and settings |

Administrators receive Phase 13 permissions via migration `0013_users_roles_audit_permissions.sql`. Existing `users.manage` legacy permission continues to work through aliases.

## CLI bootstrap

For initial setup, `npm run user:create-admin` still works. After Phase 13, prefer the admin UI or `POST /api/users` for additional accounts.

## Security notes

- Cannot disable the last active administrator
- Cannot remove the admin role from the last active administrator
- Cannot disable your own account if you are the only active admin
- Password reset clears all sessions for the target user
- Passwords and session tokens are never stored in audit metadata

See [security-hardening.md](./security-hardening.md) for the full guard list.
