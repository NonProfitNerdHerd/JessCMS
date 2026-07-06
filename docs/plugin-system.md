# Plugin System

JessCMS plugins extend the core CMS without modifying core code. Each plugin is a folder under `/plugins` with a `manifest.json` and optional assets.

## Design Goals

- Enable vertical features per deployment (storm chaser vs nonprofit)
- Register admin pages, blocks, API routes, and settings declaratively
- Store enabled state and settings in D1
- Keep Phase 2 as structure-only; runtime loader comes in Phase 3

## Plugin Folder Layout

```
plugins/
  core-events/
    manifest.json
    README.md
  core-media/
    manifest.json
    README.md
  core-seo/
    manifest.json
    README.md
  storm-chaser-example/
    manifest.json
    README.md
```

Future additions per plugin:

```
plugins/my-plugin/
  manifest.json
  README.md
  routes.ts          # API handlers
  blocks.ts          # Block renderers
  admin.tsx          # Admin UI pages
  migrations/        # Plugin-specific D1 migrations
```

## Manifest Schema

```json
{
  "id": "core-events",
  "name": "Core Events",
  "version": "0.1.0",
  "description": "Event content type and event_list block",
  "enabled": true,
  "admin_routes": [
    { "path": "/events", "label": "Events", "icon": "calendar" }
  ],
  "api_routes": [
    { "method": "GET", "path": "/events", "handler": "listEvents" }
  ],
  "blocks": [
    { "type": "event_list", "label": "Event List", "category": "content" }
  ],
  "settings_schema": {
    "type": "object",
    "properties": {
      "default_timezone": { "type": "string", "default": "America/Chicago" }
    }
  },
  "permissions": [
    "events.read",
    "events.write"
  ]
}
```

### Manifest Fields

| Field | Required | Description |
|-------|----------|-------------|
| id | yes | Unique slug (matches folder name) |
| name | yes | Human-readable name |
| version | yes | Semver |
| description | yes | Short summary |
| enabled | yes | Default enabled state on fresh install |
| admin_routes | no | Admin UI navigation entries |
| api_routes | no | API endpoints relative to `/api/plugins/:id` |
| blocks | no | Block types this plugin provides |
| settings_schema | no | JSON Schema for plugin_settings |
| permissions | no | Permission strings for RBAC |

## What Plugins Can Register

| Capability | Phase | Mechanism |
|------------|-------|-----------|
| Admin pages | 3+ | `admin_routes` → Admin UI router |
| Settings panels | 3+ | `settings_schema` → settings form |
| Block types | 3+ | `blocks` → editor block registry |
| Frontend components | 4+ | Block renderers + public templates |
| API routes | 3+ | `api_routes` → Worker route mount |
| Database migrations | 4+ | `migrations/` folder, applied per plugin |
| Scheduled jobs | 5+ | Cron triggers (future) |

## Database Tables

### plugins

Registry of installed plugins and their enabled state.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | Matches manifest `id` |
| name | TEXT | Display name |
| version | TEXT | Installed version |
| enabled | INTEGER | 0 or 1 |
| manifest_json | TEXT | Full manifest snapshot |
| installed_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |

### plugin_settings

Key-value settings per plugin.

| Column | Type | Notes |
|--------|------|-------|
| plugin_id | TEXT FK | References plugins.id |
| key | TEXT | Setting key |
| value | TEXT | JSON-encoded value |
| updated_at | TEXT | ISO datetime |

Primary key: `(plugin_id, key)`.

## Runtime Loading (Phase 3+)

```
1. SELECT * FROM plugins WHERE enabled = 1
2. Parse manifest_json for each
3. Merge blocks into editor registry
4. Mount api_routes on Worker fetch handler
5. Expose admin_routes to Admin UI bootstrap endpoint
```

## Core vs Site Plugins

| Plugin | Scope |
|--------|-------|
| core-events | Events content type, event_list block |
| core-media | Media library helpers (R2 later) |
| core-seo | SEO fields, s to block |
| storm-chaser-example | Demo vertical plugin (radar, alerts) |

Site-specific plugins are not enabled by default on other deployments.

## API Conventions

Plugin routes mount at:

```
/api/plugins/{plugin_id}/{path}
```

Example:

```
GET /api/plugins/core-events/events
POST /api/plugins/storm-chaser-example/alerts
```

Core content routes remain at `/api/pages`, `/api/posts`, etc.

## Permissions

Plugins declare permission strings. Roles grant permissions via `role_permissions`. The auth layer (Phase 3) checks permissions before route handlers run.

Example:

- `events.read` — list/view events
- `events.write` — create/edit/delete events
- `plugins.manage` — enable/disable plugins

## Installation Flow (future)

1. Copy plugin folder into `/plugins` or install from registry
2. Insert row into `plugins` table with manifest snapshot
3. Run plugin migrations if present
4. Seed default `plugin_settings` from `settings_schema` defaults
5. Restart not required — Worker reads DB on each request (or cache with TTL)

## Starter Plugins (Phase 2)

Phase 2 ships manifest + README only. See `/plugins/*/manifest.json`.
