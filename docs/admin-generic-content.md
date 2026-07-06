# Admin Generic Content

The generic admin UI manages plugin content types at `/admin/content/:typeKey`.

## Routes

| Path | Screen |
|------|--------|
| `/admin/content/:typeKey` | List entries |
| `/admin/content/:typeKey/new` | Create entry |
| `/admin/content/:typeKey/:id` | Edit entry |

Only **non-legacy** types use these routes. Pages, posts, events, and forms keep their existing admin paths.

## List screen

- Columns: title, slug, status, published_at, updated_at
- Search by title/slug (`?q=`)
- Status filter (`?status=draft|published|...`)
- Create button → new editor
- Edit links per row

Data source: `GET /api/content/:typeKey`

## Editor screen

Rendered from `src/admin/generic-content-pages.ts` based on content type capabilities:

| Feature | When shown |
|---------|------------|
| Title, slug, excerpt | Always |
| Block editor | Default for JSON/HTML types |
| Featured image | `supports_featured_image` |
| Parent ID | `supports_parent` |
| Template | Always |
| SEO fields | `supports_seo` |
| Custom metadata fields | From `schema_json.fields` |
| Workflow panel | `supports_workflow` |
| Revisions panel | `supports_revisions` |

Actions:

- **Save draft** — saves without forcing published status
- **Publish** — sets `status: published` and `published_at`
- **Archive** — sets `status: archived`
- **Delete** — removes entry and index row

## Sidebar navigation

Navigation is built from the runtime content type registry (`getAdminNavigation()`):

- Legacy types link to existing screens
- Generic types link to `/admin/content/:typeKey`
- Disabled types and disabled plugins are hidden
- Items with `permission` are filtered by the signed-in user's roles

## Client implementation

The generic screens reuse `public/admin/app.js` content list/edit logic:

- `data-type="content/chase"` → API base `/api/content/chase`
- Metadata fields use `data-metadata-key` and are sent as `metadata` in JSON bodies
- Workflow/revisions use `/api/content/:typeKey/:id/workflow` and `/revisions`

Page markers:

- `data-page="generic-content-list"`
- `data-page="generic-content-edit"`

## Auth

All admin routes require authentication. API mutations require appropriate `content:*` permissions.

## Testing

```bash
npm run test:generic-content
```

Verifies list/new pages, CRUD, validation, public render, revisions, workflow, and plugin disable/retain behavior.
