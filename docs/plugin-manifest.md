# Plugin Manifest Reference

Every JessCMS plugin is described by `plugins/<id>/manifest.json`.

## Required fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique plugin identifier |
| `name` | string | Human-readable name |
| `version` | string | Semver |
| `description` | string | Short summary |
| `enabled` | boolean | Default enabled state |

## Recommended fields

| Field | Type | Description |
|-------|------|-------------|
| `author` | string | Author or org |
| `homepage` | string | URL |
| `minimum_jesscms_version` | string | e.g. `"0.9.0"` |
| `kind` | `"core"` \| `"required"` \| `"plugin"` \| `"optional"` | Load priority |
| `cleanup_policy` | `"retain"` \| `"archive"` \| `"delete"` | Default uninstall behavior |

## Dependencies

```json
{
  "dependencies": [
    { "plugin_id": "core-media", "version": "0.1.0" }
  ],
  "optional_dependencies": [
    { "plugin_id": "storm-chaser-example" }
  ]
}
```

## Extensibility declarations

### `permissions`

Array of colon- or dot-separated slugs. Duplicates fail validation.

### `content_types`

```json
{
  "type_key": "chase",
  "label": "Chase",
  "plural_label": "Chases",
  "route_base": "/chases",
  "admin_base": "/admin/chases",
  "icon": "🌪",
  "supports_json": true,
  "supports_revisions": true
}
```

### `blocks`

```json
{ "type": "alert_banner", "label": "Alert Banner", "category": "storm" }
```

Block `type` must be unique across all enabled plugins and core blocks.

### `routes`

```json
{ "method": "GET", "path": "/public/feed", "type": "public", "handler": "feed" }
```

Types: `public`, `admin`, `api`. Metadata only — handlers are not dynamically executed in Phase 9.

### `admin_pages` (alias: `admin_routes`)

```json
{ "path": "/forms", "label": "Forms", "icon": "📋", "permission": "forms:read", "sort_order": 35 }
```

### `settings_pages`

```json
{ "slug": "storm", "label": "Storm", "icon": "🌪", "permission": "settings:read" }
```

### `navigation`

```json
{
  "sections": [{ "id": "storm", "label": "Storm", "sort_order": 15 }],
  "items": [
    { "section_id": "storm", "label": "Chases", "href": "/admin/chases", "icon": "🌪", "sort_order": 10 }
  ]
}
```

### Placeholders (Phase 9)

- `scheduled_jobs` — cron metadata
- `widgets` — dashboard widget metadata

### `database`

```json
{ "tables": ["my_table"], "migrations_dir": "plugins/my-plugin/migrations" }
```

### `resources`

Plugin ownership for uninstall preview:

```json
{
  "resource_type": "table",
  "resource_name": "forms",
  "table_name": "forms",
  "ownership_type": "owns",
  "cleanup_policy": "retain"
}
```

### `assets`

```json
{ "public": ["dist/public.js"], "admin": ["dist/admin.js"] }
```

## Core virtual manifest

`jesscms-core` is defined in `src/runtime/core-manifest.ts` and is always loaded first.

## Validation

Run `npm run plugins:validate` before deploy. The worker also validates at runtime and exposes errors via `/api/runtime/plugins`.
