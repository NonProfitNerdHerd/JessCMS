# Generic Content Types

Phase 10 introduces a **generic content engine** for plugin-registered content types. Instead of creating a new database table and custom admin screen for every type, plugins declare a content type in their manifest and store rows in `content_entries`.

## Architecture

| Layer | Responsibility |
|-------|----------------|
| `content_types` | Registry metadata: labels, capabilities, `schema_json`, routes |
| `content_entries` | Shared storage for all generic/plugin types |
| `content_index` | Unified lookup for admin search and public URLs |
| `/api/content/:typeKey` | Generic CRUD API |
| `/admin/content/:typeKey` | Generic admin list + editor |

Legacy core types (`page`, `post`, `event`, `form`) keep their dedicated tables and admin screens.

## content_entries table

Created in `migrations/0010_generic_content.sql`:

- Standard CMS fields: title, slug, status, excerpt, block content, SEO, author, featured image, parent, template
- `metadata_json` — custom fields defined in `content_types.schema_json`
- `content_type` — type key (e.g. `chase`, `vehicle`)
- `plugin_id` — owning plugin when applicable

Unique constraint: `(content_type, slug)`.

## Capabilities

Content types declare what the generic engine should enable:

| Flag | Effect |
|------|--------|
| `supports_revisions` | Creates `content_revisions` on save |
| `supports_workflow` | Workflow panel + state transitions |
| `supports_seo` | SEO fields in editor |
| `supports_featured_image` | Featured image picker |
| `supports_public_routes` | Indexed public URL via `route_base` |
| `supports_parent` | Parent selector |
| `supports_author` | Sets `author_id` on create |

## API

```
GET    /api/content/:typeKey
GET    /api/content/:typeKey/:id
GET    /api/content/:typeKey/slug/:slug
POST   /api/content/:typeKey
PUT    /api/content/:typeKey/:id
DELETE /api/content/:typeKey/:id
```

Query params on list: `status`, `q`, `limit`, `offset`.

Authenticated users with `content:read` see all statuses. Public callers only see published entries.

Legacy types (`page`, `post`, `event`, `form`) must continue using `/api/pages`, `/api/posts`, etc.

## Workflow and revisions

When enabled for a type:

```
GET/PUT /api/content/:typeKey/:id/workflow
GET     /api/content/:typeKey/:id/revisions
POST    /api/content/:typeKey/:id/revisions/:revisionId/restore
```

Entity type for workflow/revisions is the **type key** (e.g. `chase`), not `content_entries`.

## Permissions

Generic content uses core permissions:

- `content:read`, `content:create`, `content:update`, `content:delete`, `content:publish`
- Workflow: `workflow:submit`, `workflow:approve`, `workflow:publish`
- Revisions: `revisions:read`, `revisions:restore`

Plugin-specific permissions (e.g. `chase:create`) are reserved for future use.

## Test plugin

`storm-chaser-example` registers a `chase` content type to validate the engine without building the full storm platform.

Run tests:

```bash
npm run db:migrate:local
npm run test:generic-content
```

## Related docs

- [Content type schema](content-type-schema.md)
- [Plugin content types](plugin-content-types.md)
- [Admin generic content](admin-generic-content.md)
- [Frontend routing](frontend-routing.md)
