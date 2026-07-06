# Database Ownership

JessCMS tracks which plugins own or extend database resources in `plugin_resources`.

## Fields

| Field | Purpose |
|-------|---------|
| `plugin_id` | Owning plugin |
| `resource_type` | `table`, `entity`, `content_type`, etc. |
| `resource_name` | Logical name (`forms`, `form`, `event`) |
| `table_name` | Physical D1 table |
| `entity_id` | Specific row when tracked |
| `ownership_type` | `owns`, `extends`, `references` |
| `cleanup_policy` | `retain`, `archive`, `delete` |

## Ownership types

- **owns** — Plugin created and is responsible for lifecycle/cleanup
- **extends** — Plugin adds behavior to core data (e.g. events)
- **references** — Plugin points at core rows without owning them

## Registration

- Migration seeds table-level resources for Forms Builder and core plugins
- Runtime: `registerPluginResource()` when plugins create entities (forms on create)

## Collision prevention

`validatePluginManifest()` rejects:

- Duplicate plugin IDs
- Duplicate content type keys
- Duplicate public route bases
- Duplicate admin route bases
- Duplicate block type keys

## Why this matters

WordPress often leaves orphaned tables and options. JessCMS uses explicit ownership so uninstall preview can answer: *what will be affected?* before any destructive action.

## What we do not do yet

- Automatic `DROP TABLE` on uninstall
- Scanning D1 for untracked tables
- Cross-plugin shared ownership resolution
