# Security hardening (Phase 13)

Phase 13 adds operational controls and visibility without replacing JessCMS session auth.

## Permission enforcement

- API routes use `requirePermission()` with colon slugs
- Legacy `users.manage` maps to all Phase 13 user/role/audit permissions
- Admin pages for users, roles, and audit check permissions server-side (not only nav hiding)

## Account guards

| Guard | Behavior |
|-------|----------|
| Last admin | Cannot disable the only active user with `role_admin` |
| Self-disable | Active admin cannot disable themselves if they are the only admin |
| Admin role removal | Cannot remove `role_admin` from the last active admin |
| Admin role permissions | Cannot remove all user-management permissions from `role_admin` |
| Disabled users | `is_active = 0` blocks login and invalidates existing sessions on read |
| Password reset | Clears all sessions for the target user |

## Validation

- Email format validated on user create/update
- Role slug: `^[a-z][a-z0-9_-]{0,47}$`
- Role and user assignments reject unknown role/permission IDs
- Password minimum length: 12 characters

## Login protection

- Failed logins write `login_failed` audit entries with IP and email (not password)
- More than 10 failures from the same IP in 15 minutes returns 401 with a generic message
- Successful login purges expired session rows (`purgeExpiredSessions`)

## Session hygiene

- Sessions expire after 7 days (`SESSION_TTL_MS`)
- Expired sessions deleted on access and during login cleanup
- Profile password change revokes other sessions for that user (existing behavior)

## Audit metadata

Sensitive fields are stripped in `sanitizeAuditMetadata()` before insert. Never log passwords, hashes, or session tokens.

## Intentionally deferred

- Multi-factor authentication (MFA)
- Email-based password reset flows
- Per-route admin page permission matrix for all legacy pages (content/media still login-only at page level; APIs remain permission-gated)
- Cloudflare WAF / Turnstile on admin login (Workers-native IP audit throttle only)
- Role deletion API (custom roles can be created; built-in roles are protected)

## Testing

```bash
npm run db:migrate:local
npm run test:permissions
```

Set `BASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` if your dev server or credentials differ.
