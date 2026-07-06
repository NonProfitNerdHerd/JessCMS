# Plugin Lifecycle

JessCMS tracks plugin lifecycle in the `plugins` table.

## States

| State | Meaning |
|-------|---------|
| `installed` | Present in database, not necessarily active |
| `enabled` | Active; routes and blocks available |
| `disabled` | Deactivated; data retained |
| `uninstall_pending` | Transient state during uninstall flow |
| `uninstalled` | Removed from active use; data policy applied |

Timestamps: `installed_at`, `enabled_at`, `disabled_at`, `uninstalled_at`.

## API

```
GET  /api/plugins
GET  /api/plugins/:id/resources
POST /api/plugins/:id/enable
POST /api/plugins/:id/disable
POST /api/plugins/:id/uninstall-preview
POST /api/plugins/:id/uninstall
PUT  /api/plugins/:id          # legacy enable/disable via { enabled: boolean }
```

### Uninstall body

```json
{
  "mode": "disable_only | uninstall_retain | uninstall_archive | uninstall_delete"
}
```

## Lifecycle hooks (scaffolded)

TypeScript interfaces in `src/foundation/types.ts`:

- `PluginLifecycle.install`
- `PluginLifecycle.enable`
- `PluginLifecycle.disable`
- `PluginLifecycle.uninstall`
- `PluginLifecycle.migrate`
- `PluginLifecycle.rollback`

Hooks are registered via `registerPluginLifecycle()` but **arbitrary plugin code is not executed yet**. Built-in calls log failures safely and continue.

## Audit

Enable, disable, and uninstall actions write to `audit_log` with lifecycle metadata.
