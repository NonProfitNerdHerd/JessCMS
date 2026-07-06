# Content Types

The `content_types` table is JessCMS's registry for core and plugin-defined content.

## Seeded core types

| type_key | Source | Admin base | Public routes |
|----------|--------|------------|---------------|
| `page` | core | `/admin/pages` | Yes (`/{slug}`) |
| `post` | core | `/admin/posts` | Yes (`/blog/{slug}`) |
| `event` | core | `/admin/events` | Yes (`/events/{slug}`) |
| `form` | plugin (`forms-builder`) | `/admin/forms` | No (embed only) |

## Capability flags

Each type declares support for:

- JSON/HTML content, revisions, workflow, SEO
- Featured image, author, parent, archive
- Public routes (`route_base`, `route_path` via index)

Forms disable revisions, workflow, SEO, and public routes in the seed configuration.

## API

```
GET /api/content/types
```

Returns registered types from D1 (falls back to legacy in-memory list if migration not applied).

## Admin navigation

The admin sidebar loads enabled content types from D1 and renders links using `admin_base` and `icon`.

Existing screens remain at their current URLs — the registry drives navigation, not routing rewrites.

## Plugin content types (future)

Plugins may declare `content_types` in their manifest. Before registration, JessCMS runs `validatePluginManifest()` to prevent duplicate keys and route bases.

## Sync with content_index

Every page/post/event/form create/update/delete syncs a row in `content_index` with:

- `source_table` / `source_id` pointer to the canonical row
- `route_path` for public lookup
- `searchable_text` for future global search
