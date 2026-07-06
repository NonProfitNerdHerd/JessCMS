# Plugin Cleanup

JessCMS avoids blind plugin deletion through preview and explicit uninstall modes.

## Uninstall preview

`POST /api/plugins/:id/uninstall-preview` returns:

- Tracked `plugin_resources`
- Row counts where available
- Registered content types owned by the plugin
- Warnings (e.g. owned tables)
- Allowed uninstall modes

## Modes

| Mode | Behavior |
|------|----------|
| `disable_only` | Sets plugin to disabled; no data changes |
| `uninstall_retain` | Marks uninstalled; all data kept |
| `uninstall_archive` | Archives entity-level owned rows where supported |
| `uninstall_delete` | Deletes entity-level owned rows only (explicit confirmation in admin) |

Table-level resources are **never dropped** automatically.

## Cleanup policies

Each `plugin_resources` row has a `cleanup_policy`:

- `retain` — keep data after uninstall (default)
- `archive` — soft-archive where implemented
- `delete` — eligible for entity deletion when user selects delete mode

## Admin UI

The Plugins screen shows lifecycle state, enable/disable actions, and an uninstall preview panel with mode buttons.

## Forms Builder example

Pre-registered resources:

- `forms` table — owns, retain
- `form_fields` — owns, delete (with form cascade)
- `form_submissions` — owns, archive

Each created form also registers an entity-level resource for targeted cleanup.
