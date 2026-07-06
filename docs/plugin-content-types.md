# Plugin Content Types

Plugins register content types in their manifest. On runtime sync, types are upserted into `content_types` with `source = plugin` and the owning `plugin_id`.

## Manifest example

```json
{
  "content_types": [
    {
      "type_key": "chase",
      "label": "Chase",
      "plural_label": "Chases",
      "route_base": "/chases",
      "admin_base": "/admin/content/chase",
      "icon": "🌪",
      "supports_revisions": true,
      "supports_workflow": true,
      "supports_seo": true,
      "supports_featured_image": true,
      "supports_public_routes": true,
      "schema_json": {
        "fields": [
          {
            "key": "target_area",
            "label": "Target Area",
            "type": "text",
            "required": true
          }
        ]
      }
    }
  ],
  "resources": [
    {
      "resource_type": "content_type",
      "resource_name": "chase",
      "table_name": "content_entries",
      "ownership_type": "references",
      "cleanup_policy": "retain"
    }
  ]
}
```

## Sync behavior

When `POST /api/runtime/sync` runs (or on startup refresh):

1. Plugin manifest is loaded if the plugin is **enabled**
2. Content type is upserted into `content_types` including `schema_json`
3. Admin navigation entry is registered from `admin_base`
4. Public route pattern is registered from `route_base`

Disabled plugins do not contribute types to the runtime snapshot; synced `content_types.enabled` is set to `0`. **Data in `content_entries` is retained.**

## Storage model

Generic plugin types use the shared `content_entries` table. You do **not** need a plugin-specific migration for standard CMS fields + schema metadata.

Register a `plugin_resources` row with `table_name: content_entries` for cleanup/uninstall previews.

## Admin routes

| Type | Admin URL |
|------|-----------|
| Legacy `page` | `/admin/pages` |
| Legacy `post` | `/admin/posts` |
| Legacy `event` | `/admin/events` |
| Legacy `form` | `/admin/forms` |
| Plugin/generic | `/admin/content/:typeKey` |

Set `admin_base` explicitly in the manifest (recommended: `/admin/content/{type_key}`).

## Public routes

If `supports_public_routes` is true and `route_base` is set, published entries are indexed at:

```
{route_base}/{slug}
```

Example: `/chases/may-15-oklahoma`

## Reference implementation

See `plugins/storm-chaser-example/manifest.json` for the `chase` test type.

## Deferred

- Per-type plugin permissions (`chase:create`) — use core `content:*` for now
- Plugin-specific database tables for high-volume custom data — still supported via `plugin_resources`, but not required for CMS-style content
- Full `storm-platform` types (`vehicle`, `camera`, etc.) — metadata only today; enable when platform plugin ships
