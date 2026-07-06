# R2 Media Uploads (Phase 11)

JessCMS stores uploaded files in **Cloudflare R2** while keeping **URL-based media** for external assets. Metadata lives in D1 (`media_items`); file bytes live in R2.

## Architecture

| Layer | Responsibility |
|-------|----------------|
| `POST /api/media/upload` | Authenticated multipart upload → R2 + D1 record |
| `POST /api/media` | Create URL-only media (unchanged) |
| `GET /media/:storageKey` | Public Worker route serves R2 objects |
| Admin UI | Upload tab + URL tab on `/admin/media/new` |
| Media picker | Shows both R2 and URL items with thumbnails |

### Storage key layout

```
uploads/YYYY/MM/{uuid}-{sanitized-filename}
```

Example: `uploads/2026/07/a1b2c3d4e5f6-storm-photo.jpg`

Public URL stored in D1: `/media/uploads/2026/07/a1b2c3d4e5f6-storm-photo.jpg`

## Cloudflare setup

### 1. Create the R2 bucket

```bash
wrangler r2 bucket create jesscms-media
```

### 2. Bind the bucket in Wrangler

`wrangler.toml` already includes:

```toml
[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "jesscms-media"
```

The binding name **must** be `MEDIA_BUCKET` — the Worker reads `env.MEDIA_BUCKET`.

### 3. Deploy

```bash
npm run db:migrate:remote   # apply migration 0011 if not yet applied
npm run deploy
```

No separate R2 public bucket URL is required. Files are served through the Worker at `/media/...`.

## Local development

`wrangler dev` emulates R2 locally. The `MEDIA_BUCKET` binding works in dev without creating a remote bucket first.

```bash
npm run db:migrate:local
npm run dev
```

Upload via admin or API; files are stored in the local R2 simulation. Public URLs resolve to `http://127.0.0.1:8787/media/uploads/...`.

## Remote deploy behavior

- Uploads write to the production `jesscms-media` bucket in your Cloudflare account.
- `public_url` is a path (`/media/...`); API responses include `resolved_url` with the request origin.
- The Worker serves files with `Cache-Control: public, max-age=31536000, immutable` and supports `ETag` / `304` responses.

## Public access strategy

**Preferred (implemented):** Worker proxy route `GET /media/{storage_key}`.

- No R2 public bucket required
- Consistent URLs across environments (path-based)
- Headers controlled by JessCMS (Content-Type, Cache-Control, inline disposition)

**Alternative (not implemented):** Configure an R2 custom domain or public bucket URL and store the full HTTPS URL in `public_url`. The storage provider resolves absolute URLs as-is.

## Upload API

**Endpoint:** `POST /api/media/upload`  
**Auth:** Session cookie + `media:create` permission  
**Content-Type:** `multipart/form-data`

| Field | Required | Description |
|-------|----------|-------------|
| `file` | Yes | File bytes |
| `title` | No | Defaults to sanitized filename |
| `folder` | No | Logical folder label in D1 |
| `alt_text` | No | Accessibility text |
| `caption` | No | Caption |
| `description` | No | Longer description |

### Example (curl)

```bash
curl -X POST "https://your-site.example/api/media/upload" \
  -H "Cookie: jesscms_session=..." \
  -F "file=@photo.jpg" \
  -F "title=Storm photo" \
  -F "folder=storms" \
  -F "alt_text=Supercell"
```

### Response (201)

```json
{
  "data": {
    "id": "med_...",
    "storage_provider": "r2",
    "storage_key": "uploads/2026/07/abc123-photo.jpg",
    "public_url": "/media/uploads/2026/07/abc123-photo.jpg",
    "resolved_url": "https://your-site.example/media/uploads/2026/07/abc123-photo.jpg",
    "mime_type": "image/jpeg",
    "file_size": 245760,
    "reference_count": 0
  }
}
```

## Supported file types

| MIME type | Extensions |
|-----------|------------|
| `image/jpeg` | jpg, jpeg |
| `image/png` | png |
| `image/webp` | webp |
| `image/gif` | gif |
| `image/svg+xml` | svg |
| `application/pdf` | pdf |

**Size limit:** 10 MB (configurable in `src/media/constants.ts`).

## Security

- Server-side MIME allowlist
- Extension must match declared type
- Basic byte sniffing (magic numbers + SVG prefix check)
- Filenames sanitized; path traversal blocked
- Storage keys must start with `uploads/` and pass segment validation
- Client `Content-Type` is not trusted alone

## Delete behavior

- `storage_provider = url` → D1 row only
- `storage_provider = r2` → R2 object deleted, then D1 row
- If media is referenced by content, delete returns `400` unless `?force=1`
- Admin delete confirms when `reference_count > 0`

## Database

Migration `0011_media_r2_fields.sql` adds:

- `checksum` — SHA-256 hex of file bytes
- `metadata_json` — optional JSON metadata

Other columns were added in `0005_media_library.sql`. Existing URL media records are unchanged.

## Testing

```bash
npm run dev
npm run test:media        # URL media (Phase 7A)
npm run test:r2-media     # R2 upload, serve, delete
```

## Known limitations (Phase 11)

- No image resizing or thumbnails generated server-side
- No CDN image transformations
- No folder-level permissions
- No image editing in admin
- SVG uploads allowed but should be trusted sources only
- `width` / `height` not extracted on upload

## Related files

```
wrangler.toml
migrations/0011_media_r2_fields.sql
src/media/upload.ts
src/media/storage.ts
src/media/filename.ts
src/routes/media.ts
src/routes/media-serve.ts
public/admin/app.js
public/admin/media-library.js
scripts/r2-media-smoke-test.mjs
```
