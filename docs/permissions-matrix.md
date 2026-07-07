# Permissions matrix

JessCMS uses colon-separated permission slugs (for example `content:read`). Legacy dot slugs from Phase 2 remain in the database; `src/auth/index.ts` maps colon slugs to legacy equivalents via `PERMISSION_ALIASES`.

Access levels:

- **Public** — no session required
- **Authenticated** — valid session; may still filter results by permission
- **Permission** — session plus specific permission slug

## Auth

| Route | Method | Permission | Access | Notes |
|-------|--------|------------|--------|-------|
| `/api/auth/login` | POST | — | Public | Rate-limited by failed attempts per IP (audit-backed) |
| `/api/auth/logout` | POST | — | Authenticated | Audited |
| `/api/auth/me` | GET | — | Authenticated | Returns permission slugs |
| `/api/auth/profile` | PUT | — | Authenticated | Self-service profile update; audited |

## Users & roles (Phase 13)

| Route | Method | Permission | Access | Notes |
|-------|--------|------------|--------|-------|
| `/api/users` | GET | `users:read` | Permission | List users |
| `/api/users/:id` | GET | `users:read` | Permission | User detail |
| `/api/users` | POST | `users:create` | Permission | Create user |
| `/api/users/:id` | PUT | `users:update` | Permission | Update name, email, roles |
| `/api/users/:id/disable` | POST | `users:disable` | Permission | Cannot disable last admin |
| `/api/users/:id/enable` | POST | `users:disable` | Permission | Re-enable account |
| `/api/users/:id/reset-password` | POST | `users:reset_password` | Permission | Admin temporary password |
| `/api/roles` | GET | `roles:read` | Permission | List roles + permissions |
| `/api/roles/:id` | GET | `roles:read` | Permission | Role detail |
| `/api/roles` | POST | `roles:create` | Permission | Custom roles |
| `/api/roles/:id` | PUT | `roles:update` | Permission | Cannot strip admin-critical perms |
| `/api/permissions` | GET | `permissions:read` | Permission | All permission definitions |
| `/api/audit` | GET | `audit:read` | Permission | Filterable audit log |

Legacy alias: `users.manage` grants all `users:*`, `roles:*`, `permissions:read`, and `audit:read` checks.

## Content

| Route | Method | Permission | Access | Notes |
|-------|--------|------------|--------|-------|
| `/api/pages`, `/api/posts`, `/api/events` | GET | `content:read` (implicit) | Public / filtered | Drafts hidden without read permission |
| `/api/pages`, `/api/posts`, `/api/events` | POST | `content:create` | Permission | Audited |
| `/api/pages/:id`, etc. | PUT | `content:update` | Permission | Publish uses `content:publish` when status changes |
| `/api/pages/:id`, etc. | DELETE | `content:delete` | Permission | Audited |
| `/api/content/:type` | * | same as above | Permission | Generic content types |
| `/api/content/types` | GET | — | Public | Type registry |

## Workflow & revisions

| Route | Method | Permission | Access | Notes |
|-------|--------|------------|--------|-------|
| `*/workflow` | GET | `content:read` | Permission | |
| `*/workflow` | PUT | `workflow:submit` / `approve` / `publish` | Permission | Audited |
| `*/revisions` | GET | `revisions:read` | Permission | |
| `*/revisions/:id/restore` | POST | `revisions:restore` | Permission | Audited |

## Media

| Route | Method | Permission | Access | Notes |
|-------|--------|------------|--------|-------|
| `/api/media` | GET | `media:read` | Permission | |
| `/api/media/upload`, `/api/media` | POST | `media:create` | Permission | Audited |
| `/api/media/:id` | PUT | `media:update` | Permission | Audited |
| `/api/media/:id` | DELETE | `media:delete` | Permission | Audited |
| `/media/*` | GET/HEAD | — | Public | R2/public serve |

## Forms

| Route | Method | Permission | Access | Notes |
|-------|--------|------------|--------|-------|
| `/api/forms` | GET/POST | `forms:read` / `forms:create` | Permission | Audited |
| `/api/forms/:id` | GET/PUT/DELETE | `forms:read` / `forms:update` / `forms:delete` | Permission | Audited |
| `/api/forms/:id/submissions` | GET | `forms:submissions:read` | Permission | |
| `/api/public/forms/:slug/submit` | POST | — | Public | Submission audited (`form_submission`) |

## Plugins & runtime

| Route | Method | Permission | Access | Notes |
|-------|--------|------------|--------|-------|
| `/api/plugins` | GET | — | Public | Lists plugins (read-only metadata) |
| `/api/plugins/:id/enable|disable|uninstall` | POST | `plugins:update` | Permission | Audited |
| `/api/runtime/refresh`, `/api/runtime/sync` | POST | `plugins:update` | Permission | |
| `/api/runtime/*` (GET) | GET | — | Public | Registry snapshot |

## Theme & search

| Route | Method | Permission | Access | Notes |
|-------|--------|------------|--------|-------|
| `/api/theme/settings` | GET | — | Public | Theme tokens |
| `/api/theme/settings` | PUT | `settings:update` | Permission | Audited |
| `/api/search` | GET | — | Public | Published content only |
| `/api/search/admin` | GET | — | Authenticated | All statuses |
| `/api/search/rebuild` | POST | — | Authenticated | Audited (`rebuild`) |

## Admin pages

Admin HTML routes under `/admin/*` require login. Phase 13 adds permission checks for:

| Page | Permission |
|------|------------|
| `/admin/users`, `/admin/users/:id` | `users:read` (create: `users:create`) |
| `/admin/roles`, `/admin/roles/:id` | `roles:read` |
| `/admin/audit` | `audit:read` |

Other admin pages remain login-gated; sidebar links are filtered by permission in `src/runtime/navigation.ts`.

## Health

| Route | Method | Permission | Access |
|-------|--------|------------|--------|
| `/api/health` | GET | — | Public |
