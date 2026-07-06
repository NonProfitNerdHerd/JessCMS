# Plugin SDK (Phase 9)

This document describes how to author JessCMS plugins against the Phase 9 runtime. CRUD for generic content types is **not** included yet — plugins register metadata only.

## Quick start

1. Create `plugins/my-plugin/manifest.json`
2. Add the import to `src/foundation/registry.ts`
3. Run `npm run plugins:validate`
4. Deploy and run `npm run plugins:sync`

## Manifest

See [plugin-manifest.md](./plugin-manifest.md) for the full schema.

Minimal example:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "Does something useful",
  "author": "You",
  "enabled": false,
  "kind": "plugin",
  "dependencies": [{ "plugin_id": "core-media" }],
  "permissions": ["my-plugin:read"],
  "blocks": [{ "type": "my_block", "label": "My Block", "category": "custom" }],
  "admin_pages": [{ "path": "/my-plugin", "label": "My Plugin", "icon": "🧩" }]
}
```

## Registries (read-only for plugin authors)

Plugins do not call registries directly in Phase 9. Declarations in `manifest.json` are loaded by the runtime:

| Manifest key | Registry |
|--------------|----------|
| `blocks` | Block Registry |
| `content_types` | Content Type Registry |
| `permissions` | Permission Registry |
| `routes`, `api_routes`, `admin_pages` | Route Registry |
| `settings_pages` | Settings Registry |
| `navigation` | Navigation Registry |
| `scheduled_jobs` | Scheduler Registry (placeholder) |
| `widgets` | Widget Registry (placeholder) |

## Dependencies

```json
{
  "dependencies": [{ "plugin_id": "forms-builder", "version": "0.1.0" }],
  "optional_dependencies": [{ "plugin_id": "storm-chaser-example" }]
}
```

- **dependencies** — required; plugin cannot enable if missing or disabled
- **optional_dependencies** — reported in admin but not blocking

## Lifecycle

Existing lifecycle APIs remain unchanged:

- `POST /api/plugins/:id/enable`
- `POST /api/plugins/:id/disable`
- `POST /api/plugins/:id/uninstall`

Runtime cache is invalidated on enable/disable. Events `PluginEnabled` / `PluginDisabled` are emitted.

## Hooks (scaffold)

Hook names: `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`, `beforeRender`, `afterRender`.

Registration API exists in `src/runtime/hooks.ts` but handlers are **not executed** in Phase 9.

## Testing your plugin

```bash
npm run plugins:validate
npm run test:runtime
```

Enable your plugin in admin and verify:

- Blocks appear in `/api/editor/blocks`
- Navigation appears in admin sidebar
- Content types appear in `/api/runtime/content-types`
