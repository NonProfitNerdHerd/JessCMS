# JessCMS — Next Steps

Phase 2 establishes the CMS foundation. Use this checklist to continue.

## Immediate (after Phase 2)

1. Apply migration locally:
   ```powershell
   npm run db:migrate:local
   ```

2. Apply migration to production D1:
   ```powershell
   npm run db:migrate:remote
   ```

3. Deploy updated Worker:
   ```powershell
   npm run deploy
   ```

4. Verify new endpoints:
   - `GET /api/content/types`
   - `GET /api/plugins`
   - `GET /api/theme/settings`
   - `GET /api/editor/blocks`

## Phase 3 — Auth and CRUD

- [ ] Password hashing and login/logout API
- [ ] Session middleware
- [ ] Wire `roles`, `permissions`, `user_roles` tables
- [ ] CRUD for pages, posts, events
- [ ] Plugin loader: read `plugins` table, mount API routes
- [ ] Seed `plugins` table from manifest files on first deploy
- [ ] Audit log writes on mutations

## Phase 4 — Admin UI Shell

- [ ] Static or lightweight SPA admin at `/admin`
- [ ] Content list/create/edit forms (no block editor yet — textarea fallback)
- [ ] Plugin management page
- [ ] Theme settings editor
- [ ] Menu builder

## Phase 5 — Block Editor

- [ ] React block editor (or lightweight alternative)
- [ ] Block renderer pipeline (JSON → HTML)
- [ ] Save `content_json` + regenerate `content_html`
- [ ] Plugin block renderers

## Phase 6 — Media and Advanced Plugins

- [ ] R2 bucket binding for media storage
- [ ] Upload API and media library UI
- [ ] Plugin-specific migrations runner
- [ ] Cron triggers for scheduled jobs
- [ ] Site-specific plugins (donation, weather, etc.)

## Multi-Site Deployment

When spinning up a new site:

1. Create a new D1 database (`wrangler d1 create jesscms-{site}-db`)
2. Add a Wrangler environment in `wrangler.toml`
3. Run migrations against the new database
4. Enable the plugins that site needs in the `plugins` table
5. Configure `theme_settings` for the site's brand
6. Deploy with `wrangler deploy --env {site}`

## Documentation Index

| Doc | Topic |
|-----|-------|
| `jesscms-architecture.md` | System overview |
| `block-editor-model.md` | Block JSON schema |
| `plugin-system.md` | Plugin manifests and loading |
| `theme-system.md` | Design tokens |
