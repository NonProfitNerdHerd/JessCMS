# Plugin Search Settings

Plugin content types can control search behavior via manifest fields and D1 `content_types` columns.

## Manifest fields

```json
{
  "content_types": [
    {
      "type_key": "chase",
      "label": "Chase",
      "plural_label": "Chases",
      "supports_search": true,
      "search_weight": 1.1,
      "search_fields_json": {
        "metadata": ["target_area", "summary"]
      },
      "route_base": "/chases",
      "admin_base": "/admin/content/chase"
    }
  ]
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `supports_search` | `true` | When `false`, content is not indexed |
| `search_weight` | `1.0` | Ranking multiplier |
| `search_fields_json` | `null` | Reserved for future field-specific weighting |

## Runtime sync

When plugins sync to D1 (`POST /api/runtime/sync`), search settings are stored on `content_types`:

- `supports_search`
- `search_weight`
- `search_fields_json`

Disabling a plugin disables its content types; existing index rows remain until content is deleted or rebuild runs.

## Public vs admin

| Setting | Effect |
|---------|--------|
| `supports_search: false` | Removed from index on next sync/update |
| `supports_public_routes: false` | Indexed for admin only (no public URL) |
| `search_weight: 1.5` | Boosts ranking vs default 1.0 |

## Generic content entries

Entries in `content_entries` are indexed when:

1. Content type has `supports_search !== false`
2. Content type is enabled
3. Plugin is enabled

Searchable text includes title, excerpt, block text, HTML, and metadata JSON.

## Example: storm-chaser `chase` type

See `plugins/storm-chaser-example/manifest.json` — `supports_search: true` with `search_weight: 1.1`.

After enabling the plugin and syncing runtime, chase entries appear in public search when published.

## Rebuild after plugin changes

```bash
npm run plugins:sync
npm run search:rebuild
```
