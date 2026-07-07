# Public Search

Visitors can search published content at `/search`.

## UI

- Search field with submit button
- Result cards with title, excerpt/snippet, content type, and published date
- Pagination via `?page=2`
- Empty state when no results

## API

**Endpoint:** `GET /api/search`  
**Auth:** None (public)

| Param | Description |
|-------|-------------|
| `q` | Search query |
| `content_type` | Optional type filter |
| `limit` | Page size (default 20) |
| `offset` | Pagination offset |

### Example

```bash
curl "http://127.0.0.1:8787/api/search?q=storm"
```

Only **published** content with a public `route_path` is returned. Drafts, forms, and media are excluded.

## Supported content

- Pages
- Posts
- Events
- Plugin/generic content types with public routes and `supports_search = true`

Results link to `route_path` (`/blog/slug`, `/chases/slug`, etc.).

## SEO

Search result pages use `noindex` robots meta (reserved slug).

## Testing

```bash
npm run test:search
```
