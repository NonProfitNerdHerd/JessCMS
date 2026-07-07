# Admin Search

Global admin search queries the `content_index` table across all content types and statuses.

## UI

| Location | Purpose |
|----------|---------|
| Header search box | Quick jump to `/admin/search?q=…` |
| `/admin/search` | Full search page with filters |

## API

**Endpoint:** `GET /api/search/admin`  
**Auth:** Required (session cookie)

| Param | Description |
|-------|-------------|
| `q` | Search query (required) |
| `content_type` | Filter by type (`page`, `post`, `media`, etc.) |
| `status` | Filter by status (`draft`, `published`, …) |
| `plugin_id` | Filter by plugin |
| `include_media` | Set to `1` to include media items |
| `limit` | Max results (default 20, max 100) |
| `offset` | Pagination offset |

### Example

```bash
curl "http://127.0.0.1:8787/api/search/admin?q=storm&content_type=post&include_media=1" \
  -H "Cookie: jesscms_session=..."
```

### Response

```json
{
  "data": {
    "items": [
      {
        "title": "Storm chase log",
        "content_type": "post",
        "status": "draft",
        "snippet": "…supercell over Kansas…",
        "admin_url": "/admin/posts/post_abc123",
        "score": 60
      }
    ],
    "total": 1,
    "q": "storm"
  }
}
```

## Ranking

1. Exact title match
2. Title contains query
3. Slug contains query
4. Excerpt / searchable text contains query
5. Newer content (tie-breaker)

## Rebuild index

```bash
npm run search:rebuild
```

See [search-indexing.md](./search-indexing.md).
