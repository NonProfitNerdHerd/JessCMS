# Media Library

JessCMS includes a WordPress-style media library for managing images and files. Phase 11 adds **Cloudflare R2 uploads** while **URL-based media** remains fully supported.

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
| `storage_key` | R2 object key (`uploads/YYYY/MM/...`) |
| `public_url` | External URL or Worker path (`/media/...`) |
| `folder` | Optional folder label |
| `uploaded_by` | User ID |
| `checksum` | SHA-256 hex (R2 uploads) |
| `metadata_json` | Optional JSON metadata |
| `created_at` / `updated_at` | Timestamps |

Legacy columns `url` and `size_bytes` remain for backward compatibility.

## Storage providers

### URL (`storage_provider = 'url'`)

Add media by providing a public URL. No file upload is performed. Created via `POST /api/media`.

### R2 (`storage_provider = 'r2'`)

Files uploaded via `POST /api/media/upload` are stored in the `MEDIA_BUCKET` R2 binding. Public URLs use the Worker route `/media/{storage_key}`.

See [r2-media-uploads.md](./r2-media-uploads.md) for setup and security details.

## API

All routes require authentication and media permissions except the public file route.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/media` | `media:read` | List with search, pagination, filters |
| GET | `/api/media/:id` | `media:read` | Single item + `resolved_url`, `reference_count` |
| POST | `/api/media` | `media:create` | Create URL media |
| POST | `/api/media/upload` | `media:create` | Upload file to R2 |
| PUT | `/api/media/:id` | `media:update` | Update metadata |
| DELETE | `/api/media/:id` | `media:delete` | Delete item (+ R2 object when applicable) |
| GET | `/media/*` | Public | Serve R2 file (no auth) |

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

### Upload (multipart)

```
POST /api/media/upload
Content-Type: multipart/form-data

file=<binary>
title=Storm photo
folder=storms
alt_text=Supercell
```

## Permissions

| Slug | Description |
|------|-------------|
| `media:read` | View library |
| `media:create` | Add / upload items |
| `media:update` | Edit metadata |
| `media:delete` | Remove items |

Admin role has all four. Editor role has read, create, and update.

## Admin UI

| Path | Purpose |
|------|---------|
| `/admin/media` | Thumbnail grid, search, folder/MIME filters, copy URL |
| `/admin/media/new` | Upload file (drag-and-drop) or add external URL |
| `/admin/media/:id` | Edit metadata, preview, copy URL, delete |

The reusable picker lives in `public/admin/media-library.js`:

```javascript
JessMediaLibrary.open({
  mimeType: "image/*",
  onSelect(item) {
    const url = item.resolved_url || item.public_url;
    console.log(url, item.alt_text);
  },
});
```

Delete warns when `reference_count > 0` and supports forced delete.

## Block editor integration

- **Image blocks** — “Choose from library” opens the picker; sets `url`, `alt`, `caption`, and `media_id`.
- **Featured image** — Content edit forms use the library instead of raw ID input.

Both R2 and URL media appear in the picker with thumbnails.

## Public theme integration

`src/theme/media.ts` resolves media by ID for featured images. R2 items use path-based `/media/...` URLs.

## Testing

```bash
npm run dev
npm run test:media
npm run test:r2-media
```

Set `BASE_URL` for production smoke tests.

## Related files

```
migrations/0005_media_library.sql
migrations/0011_media_r2_fields.sql
src/media/repository.ts
src/media/storage.ts
src/media/upload.ts
src/routes/media.ts
src/routes/media-serve.ts
public/admin/media-library.js
scripts/media-smoke-test.mjs
scripts/r2-media-smoke-test.mjs
docs/r2-media-uploads.md
```
