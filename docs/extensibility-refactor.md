# Extensibility Refactor (Phase 8)

## Current state

JessCMS currently stores content in dedicated tables (`pages`, `posts`, `events`, `forms`) with hardcoded admin routes, public routing, and API handlers per type. Plugins are registered from static manifests in `src/foundation/registry.ts` with a simple `enabled` flag in D1.

This works for the shipped core types but creates WordPress-style risks as more plugins arrive:

- Orphaned tables after uninstall
- No central index for routing/search
- Duplicate route or content type collisions
- No preview before plugin removal

## Target architecture

```
Plugin manifest ──► validatePluginManifest()
       │
       ├── content_types (registry)
       ├── plugin_resources (ownership)
       └── plugin lifecycle (enable/disable/uninstall)

Content tables (pages/posts/events/forms) ──sync──► content_index
       │
       └── public router resolves via route_path (fallback to legacy logic)
```

### New D1 tables

| Table | Role |
|-------|------|
| `content_types` | Registry of core and plugin content types with capability flags |
| `content_index` | Unified slug/route/search index pointing at source rows |
| `plugin_resources` | Tracks tables and entities owned by each plugin |

### Plugin lifecycle states

`installed` → `enabled` ↔ `disabled` → `uninstall_pending` → `uninstalled`

## Migration plan

1. **Phase 8 (this release):** Add tables, seed core types, backfill `content_index`, add APIs and admin lifecycle UI. Keep all existing tables and routes.
2. **Phase 9+:** Register plugin content types from manifests; dynamic admin screens for new types.
3. **Future:** Optional consolidation of storage — only after sync proves stable.

## Compatibility plan

- Existing URLs unchanged (`/`, `/blog/:slug`, `/events/:slug`, `/:slug`)
- Existing APIs unchanged (`/api/pages`, `/api/posts`, etc.)
- Public router tries `content_index` first, then legacy resolution
- Admin screens for pages/posts/events/forms unchanged; sidebar reads `content_types`
- Workflow/revisions continue using `entity_type` + `entity_id` strings

## Risks

| Risk | Mitigation |
|------|------------|
| Index drift from source tables | Sync on every create/update/delete |
| Accidental data deletion on uninstall | Uninstall preview + explicit mode selection |
| Route collisions | `validatePluginManifest()` + unique `route_path` |
| Remote dev timeouts | Unrelated to schema; use local D1 for development |

## What NOT to change yet

- Do **not** drop or rename `pages`, `posts`, `events`, `forms`
- Do **not** remove legacy content API routes
- Do **not** execute arbitrary plugin hook code from disk (hooks are scaffolded only)
- Do **not** auto-delete table-level plugin data on uninstall
- Do **not** migrate media/workflow/revisions into generic storage

## Intentionally deferred

- Dynamic CRUD admin for arbitrary plugin content types
- Running plugin `install`/`migrate` hooks from uploaded packages
- Full search UI powered solely by `content_index`
- Form workflow/revisions (disabled in `content_types` seed)

See also: [content-types.md](./content-types.md), [plugin-lifecycle.md](./plugin-lifecycle.md), [plugin-cleanup.md](./plugin-cleanup.md), [database-ownership.md](./database-ownership.md).
