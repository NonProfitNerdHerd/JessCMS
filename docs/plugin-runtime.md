# Plugin Runtime

JessCMS Phase 9 introduces a **registry-driven plugin runtime** — the operating system layer that loads enabled plugins and exposes their metadata to the admin UI, block editor, and API.

## Architecture

```
manifest.json → Plugin Loader → Registries → Runtime Snapshot → API / Admin / Editor
                     ↑
                 D1 plugin state (enabled/disabled)
```

## Registries

| Registry | Purpose |
|----------|---------|
| Plugin Registry | Loaded plugins and lifecycle metadata |
| Block Registry | Editor block definitions |
| Content Type Registry | Declared content types (metadata only in Phase 9) |
| Permission Registry | Plugin-declared permission slugs |
| Route Registry | Public, admin, and API route metadata |
| Settings Registry | Admin settings page definitions |
| Navigation Registry | Sidebar items and sections |
| Scheduler Registry | Placeholder for cron jobs |
| Notification Registry | Placeholder for notifications |
| Widget Registry | Placeholder for dashboard widgets |

Each registry implements: `register()`, `unregister()`, `get()`, `getAll()`, `exists()`, `validate()`.

## Loading order

1. **Core** (`jesscms-core`) — always enabled
2. **Required** plugins (`kind: "required"`)
3. **Standard** plugins (`kind: "plugin"`)
4. **Optional** plugins (`kind: "optional"`)

Dependencies are resolved via topological sort. **Disabled plugins register nothing.**

## Validation

The runtime validates:

- Duplicate plugin IDs, content types, blocks, routes, admin routes, permissions
- Circular dependencies
- Missing required dependencies
- Disabled required dependencies (for enabled plugins)
- Unsupported JessCMS version (`minimum_jesscms_version`)

Validation errors are returned in the runtime snapshot (`errors` array) and block sync when critical.

## CLI

```bash
npm run plugins:validate   # Validate all manifests locally
npm run plugins:list       # List installed manifests
npm run plugins:sync       # Sync runtime → D1 (requires running server)
npm run plugins:refresh    # Refresh in-memory runtime cache
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/runtime/plugins` | Loaded plugins |
| `GET /api/runtime/content-types` | Registered content types |
| `GET /api/runtime/blocks` | Registered blocks |
| `GET /api/runtime/routes` | Route metadata |
| `GET /api/runtime/navigation` | Admin navigation items |
| `GET /api/runtime/settings` | Settings pages |
| `GET /api/runtime/permissions` | Permission slugs |
| `POST /api/runtime/sync` | Sync to D1 (auth required) |
| `POST /api/runtime/refresh` | Refresh cache (auth required) |

## Events & Hooks

See [event-system.md](./event-system.md). Events are in-process only. Hooks are scaffolded metadata — no arbitrary plugin code execution yet.

## Example vertical plugins

- **storm-platform** — Chase, Vehicle, Camera, Warning, Scanner Feed content types
- **nonprofit-platform** — Volunteer, Board Member, Program, Campaign, Donation content types

Both ship disabled by default. Enable via Admin → Plugins after dependencies are satisfied.
