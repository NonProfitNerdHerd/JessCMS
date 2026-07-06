# Revision History

Every content save creates an immutable revision snapshot. Revisions support audit trails, comparison, and restore.

## What's captured

Each revision stores a JSON snapshot of the content record including:

- Title, slug, excerpt
- Block content (`content_json`, `content_html`)
- SEO fields, template, featured image
- Event-specific fields (for events)
- Timestamps from the saved record

Metadata per revision:

- **Revision number** — sequential per content item (1, 2, 3…)
- **Change summary** — optional note from the editor
- **Author** — user who saved
- **Timestamp** — when the revision was created

## Permissions

| Permission | Capability |
|------------|------------|
| `revisions:read` | List, view, and compare revisions |
| `revisions:restore` | Restore content from a revision |

## API

Replace `{type}` with `pages`, `posts`, or `events`.

### List revisions

```
GET /api/{type}/{id}/revisions?limit=50&offset=0
```

### Get revision

```
GET /api/{type}/{id}/revisions/{revisionId}
```

Returns revision metadata and parsed `snapshot` object.

### Compare revisions

```
GET /api/{type}/{id}/revisions/compare?from=2&to=5
```

Returns changed fields with `from` and `to` values.

### Restore revision

```
POST /api/{type}/{id}/revisions/{revisionId}/restore
```

Applies the snapshot to the live content record, creates a new revision noting the restore, and writes an audit log entry.

## Save behavior

- **Create** — revision #1 with summary "Initial version" (or custom `change_summary`)
- **Update** — new revision after each successful save

Pass an optional change summary when saving content:

```json
PUT /api/pages/{id}
{
  "title": "Updated title",
  "change_summary": "Fixed hero copy and CTA"
}
```

## Admin UI

The **Revision history** panel on content edit screens shows:

- Revision list with number, summary, author, timestamp
- **Compare** — diff against the latest revision
- **Restore** — apply a previous version

## Audit

Restores are logged in `audit_log` with action `restore`, including source revision number and new revision number.

## Database

Table: `content_revisions` — see `migrations/0007_workflow_revisions.sql`.
