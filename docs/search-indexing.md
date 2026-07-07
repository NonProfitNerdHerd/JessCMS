# Search Indexing

JessCMS uses a unified `content_index` table in D1 for global search and public route resolution.

## Index model

| Column | Purpose |
|--------|---------|
| `content_type` | `page`, `post`, `event`, `form`, plugin type, or `media` |
| `source_table` | Origin table |
| `source_id` | Primary key in source table |
| `title`, `slug`, `status` | Core metadata |
| `excerpt` | Short summary for snippets |
| `featured_image_id` | Optional featured image |
| `searchable_text` | Normalized full-text payload (max 8000 chars) |
| `route_path` | Public URL (`/blog/slug`, `/chases/slug`, etc.) |
| `search_weight` | Ranking multiplier |
| `indexed_at` | Last index update timestamp |
| `metadata_json` | Extra plugin metadata |

Migration: `migrations/0012_search_index.sql`

## Indexing service

Location: `src/search/indexer.ts`

| Function | Purpose |
|----------|---------|
| `indexContent()` | Upsert one index row |
| `removeFromIndex()` | Delete index row |
| `rebuildIndex()` | Clear and rebuild entire index |
| `normalizeSearchText()` | Lowercase/normalize query text |
| `extractTextFromBlocks()` | Pull text from block JSON |
| `extractTextFromHtml()` | Strip HTML to plain text |
| `buildRoutePath()` | Compute public URL from type + slug |

### Automatic sync

Create/update/delete for pages, posts, events, forms, generic `content_entries`, and media updates the index automatically.

Workflow transitions and revision restores also re-sync legacy content types.

## Rebuild

```bash
npm run search:rebuild
BASE_URL=https://your-worker.example npm run search:rebuild
```

Calls `POST /api/search/rebuild` (authenticated).

## What is indexed

| Source | Public search | Admin search |
|--------|---------------|--------------|
| Pages, posts, events | Published only | All statuses |
| Generic content entries | Published + `supports_search` + public route | All if searchable |
| Forms | No (no public route) | Yes |
| Media | No | Yes (optional `include_media=1`) |

Binary file contents are never indexed.

## Related files

```
migrations/0012_search_index.sql
src/search/indexer.ts
src/search/query.ts
src/search/text.ts
src/content-index/repository.ts
scripts/search-rebuild.mjs
```
