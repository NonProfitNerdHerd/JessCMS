# Runtime Overview

JessCMS is evolving from a CMS into a **Cloudflare-native platform**. Phase 9 adds the runtime layer that all future features plug into.

## Layers

```
┌─────────────────────────────────────────────┐
│  Admin UI · Block Editor · Public Site      │
├─────────────────────────────────────────────┤
│  Runtime API (/api/runtime/*)               │
├─────────────────────────────────────────────┤
│  Plugin Runtime (src/runtime/)              │
│  · Loader · Validation · Sync · Events      │
├─────────────────────────────────────────────┤
│  Registries (blocks, types, routes, …)     │
├─────────────────────────────────────────────┤
│  Plugin Manifests (plugins/*/manifest.json) │
├─────────────────────────────────────────────┤
│  Cloudflare Worker · D1 · Assets            │
└─────────────────────────────────────────────┘
```

## Core plugin

`jesscms-core` is a virtual plugin (not stored in `plugins/`) that registers:

- Core content types: page, post, event
- Core blocks from `BLOCK_TYPES`
- Core permissions
- Theme and Plugins navigation entries

## Data flow

1. Worker receives request
2. `getRuntime(env)` loads DB enabled state + manifests
3. Registries populated for enabled plugins only
4. Snapshot served via runtime API or consumed by admin/editor

## Sync

`syncRuntimeToDatabase()` upserts:

- `plugins` table (manifest JSON)
- `content_types` from registered types
- `permissions` (INSERT OR IGNORE)
- `plugin_resources` from manifest declarations

## Backward compatibility

Phase 9 does **not** remove existing APIs:

- `/api/plugins`, `/api/content/types`, `/api/editor/blocks` still work
- Admin pages unchanged; sidebar becomes registry-driven
- Legacy `src/foundation/registry.ts` unchanged for static block/type definitions

## What's next (not Phase 9)

- Generic content type CRUD
- Hook execution and plugin code sandbox
- Marketplace
- AI features

Everything above should register through the runtime instead of hardcoding into the CMS core.
