# Media Library

JessCMS includes a WordPress-style media library for managing images and files. Phase 7A supports **URL-based media** with interfaces prepared for **Cloudflare R2** uploads later.

## Database

Media metadata is stored in `media_items`:

| Column | Description |
|--------|-------------|
| `id` | Primary key (`med_…`) |
| `filename` | Display filename |
| `original_filename` | Original upload name |
| `title` | Human-readable title |
| `alt_text` | Accessibility text |
| `caption` | Short caption |
| `description` | Longer description |
| `mime_type` | MIME type (e.g. `image/jpeg`) |
| `file_size` | Size in bytes |
| `width` / `height` | Dimensions when known |
| `storage_provider` | `url` or `r2` |
| `storage_key` | R2 object key (future) |
| `public_url` | Public URL for rendering |
| `folder` | Optional folder label |
| `uploaded_by` | User ID |
| `created_at` / `updated_at` | Timestamps |

Legacy columns `url` and `size_bytes` remain for backward compatibility.

## Storage providers

### URL (`storage_provider = 'url'`)

Add media by providing a public URL. No file upload is performed. This is the default in Phase 7A.

### R2 (`storage_provider = 'r2'`)

`src/media/storage.ts` defines `R2MediaStorage` as a placeholder. When R2 is configured:

1. Bind an R2 bucket in `wrangler.toml`
2. Implement upload in `POST /api/media`
3. Set `storage_key` and optional `public_url`
4. Use `deleteObject()` on delete

## API

All routes require authentication and media permissions.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/media` | `media:read` | List with search, pagination, filters |
| GET | `/api/media/:id` | `media:read` | Single item + `resolved_url` |
| POST | `/api/media` | `media:create` | Create URL media |
| PUT | `/api/media/:id` | `media:update` | Update metadata |
| DELETE | `/api/media/:id` | `media:delete` | Delete item |

### List query parameters

| Param | Description |
|-------|-------------|
| `q` | Search title, filename, alt, caption, description, URL |
| `mime_type` | Exact MIME or prefix (`image/*`) |
| `folder` | Folder name (empty string = uncategorized) |
| `limit` | Page size (default 24, max 100) |
| `offset` | Pagination offset |
| `include_folders` | Set to `1` to return distinct folder list |

### Create body (URL media)

```json
{
  "public_url": "https://example.com/photo.jpg",
  "title": "Storm photo",
  "alt_text": "Supercell over Kansas",
  "caption": "May 2026 chase",
  "folder": "storms",
  "mime_type": "image/jpeg",
  "width": 1920,
  "height": 1080
}
```

## Permissions

| Slug | Description |
|------|-------------|
| `media:read` | View library |
| `media:create` | Add items |
| `media:update` | Edit metadata |
| `media:delete` | Remove items |

Admin role has all four. Editor role has read, create, and update.

## Admin UI

| Path | Purpose |
|------|---------|
| `/admin/media` | Thumbnail grid, search, folder/MIME filters, copy URL |
| `/admin/media/new` | Add URL media |
| `/admin/media/:id` | Edit metadata, preview, copy URL, delete |

The reusable picker lives in `public/admin/media-library.js`:

```javascript
JessMediaLibrary.open({
  mimeType: "image/*",
  onSelect(item) {
    console.log(item.public_url, item.alt_text);
  },
});
```

## Block editor integration

- **Image blocks** — “Choose from library” opens the picker and fills URL, alt, and caption.
- **Featured image** — Content edit forms use the library instead of raw ID input.

## Public theme integration

`src/theme/media.ts` resolves media by ID for featured images and future block enhancements using `public_url`.

## Testing

```bash
npm run dev
npm run test:media
```

Set `BASE_URL` for production smoke tests.

## Related files

```
migrations/0005_media_library.sql
src/media/repository.ts
src/media/storage.ts
src/routes/media.ts
public/admin/media-library.js
scripts/media-smoke-test.mjs
```
