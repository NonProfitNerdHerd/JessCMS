# Cloudflare Deployment

JessCMS runs as a **Cloudflare Worker** with **D1** (database), **R2** (media files), and static **Assets** (admin UI, theme).

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install` in this repo)
- `wrangler login`

## One-time setup

### 1. D1 database

```bash
npm run db:create
```

Copy the returned `database_id` into `wrangler.toml` under `[[d1_databases]]`.

Apply migrations locally first, then remotely:

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

### 2. R2 media bucket

```bash
wrangler r2 bucket create jesscms-media
```

The bucket binding is already configured:

```toml
[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "jesscms-media"
```

See [r2-media-uploads.md](./r2-media-uploads.md) for upload behavior and public serving.

### 3. Admin user

After first deploy or local dev with D1:

```bash
npm run user:create-admin
```

## Local development

```bash
npm run db:migrate:local
npm run dev
```

Open `http://127.0.0.1:8787`.

| Resource | Local behavior |
|----------|----------------|
| D1 | SQLite in `.wrangler/state` |
| R2 | Emulated locally via Wrangler |
| Assets | Served from `./public` |

## Production deploy

```bash
npm run db:migrate:remote   # when migrations changed
npm run deploy
```

Wrangler publishes the Worker and binds D1, R2, and Assets to your Cloudflare account.

### Post-deploy checks

```bash
curl https://YOUR_WORKER_URL/api/health
npm run test:admin          # set BASE_URL to production URL
npm run test:r2-media
```

## Bindings reference

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 | All CMS data |
| `MEDIA_BUCKET` | R2 | Uploaded media files |
| `ASSETS` | Assets | Static files (`public/`) |

## Environment-specific notes

### D1

- Migrations live in `migrations/`
- Never drop columns in production without a migration plan
- Use `wrangler d1 execute jesscms-db --remote --command "..."` for ad-hoc queries

### R2

- Bucket name: `jesscms-media`
- Files are **not** exposed via R2 public URL by default
- Public access is through `GET /media/{storage_key}` on the Worker
- Deleting media removes the R2 object when `storage_provider = r2`

### Assets

Admin UI, block editor, and theme static files are served from `./public` via the Assets binding.

## Custom domain

1. In Cloudflare dashboard → Workers & Pages → your worker → Settings → Domains
2. Add a custom domain or route
3. Media URLs in API responses use the request origin for `resolved_url`

## Troubleshooting

| Issue | Check |
|-------|-------|
| Upload returns "MEDIA_BUCKET missing" | R2 binding in `wrangler.toml`; redeploy |
| 404 on `/media/...` | Storage key exists in R2; path starts with `/media/uploads/` |
| D1 errors after deploy | Run `npm run db:migrate:remote` |
| Auth failures in smoke tests | Create admin user; set `ADMIN_EMAIL` / `ADMIN_PASSWORD` |

## Related docs

- [r2-media-uploads.md](./r2-media-uploads.md)
- [media-library.md](./media-library.md)
- [jesscms-architecture.md](./jesscms-architecture.md)
