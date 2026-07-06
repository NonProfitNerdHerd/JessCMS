# JessCMS Architecture

JessCMS is a lightweight, WordPress-inspired content management system built on Cloudflare Workers and D1. It is designed to be redeployed across multiple websites with different plugin sets while sharing a common core.

## Goals

- WordPress-like content model (pages, posts, events, menus, media)
- Gutenberg-style block editor (JSON blocks, rendered HTML cache)
- Theme and design token settings
- Plugin-oriented extensibility
- Cloudflare-native backend (Workers + D1)
- Multi-site deployment from one codebase

## System Layers

```
┌─────────────────────────────────────────────────────────┐
│  Admin UI (future)                                      │
│  Dashboard · Content · Media · Plugins · Theme · Users  │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────┐
│  Cloudflare Worker (jesscms)                              │
│  Core API · Plugin routes · Block registry · Auth (TBD) │
└──────────────────────────┬──────────────────────────────┘
                           │ D1 binding (DB)
┌──────────────────────────▼──────────────────────────────┐
│  D1 Database                                            │
│  Content · Users · Plugins · Theme · Audit              │
└─────────────────────────────────────────────────────────┘
```

## Core CMS Features

| Feature | Status | Notes |
|---------|--------|-------|
| Pages | Phase 1 | Read API; block fields in Phase 2 schema |
| Posts | Phase 1 | Read API; categories/tags retained |
| Events | Phase 2 schema | Table + content type defined |
| Menus | Phase 2 schema | Navigation structure |
| Media | Phase 1 table | R2 storage deferred |
| Users / Sessions | Phase 1 schema | Auth deferred |
| Roles / Permissions | Phase 2 schema | Auth deferred |
| Site settings | Phase 1 | Key-value store |
| Theme settings | Phase 2 schema | Design tokens |
| Plugins | Phase 2 schema | Manifest-driven |
| Block editor | Phase 2 model | UI deferred |
| Audit log | Phase 2 schema | Write on mutations (future) |

## Content Model

All primary content types (pages, posts, events) share a common field pattern:

- Identity: `id`, `slug`, `title`
- Workflow: `status` (`draft`, `scheduled`, `published`, `archived`)
- Body: `excerpt`, `content_json`, `content_html`
- Ownership: `author_id`, `featured_image_id`
- Structure: `parent_id`, `template`
- SEO: `seo_title`, `seo_description`
- Timestamps: `published_at`, `created_at`, `updated_at`

Events add scheduling and location fields. See `0002_cms_foundation.sql` and `/docs/block-editor-model.md`.

## Plugin Architecture

Plugins live in `/plugins` and declare capabilities via `manifest.json`. See `/docs/plugin-system.md`.

Core plugins ship with the repo (`core-events`, `core-media`, `core-seo`). Site-specific plugins (e.g. `storm-chaser-example`) demonstrate how vertical features attach to the core.

At runtime (future phases), the Worker will:

1. Load enabled plugins from the `plugins` table
2. Merge manifest declarations (routes, blocks, settings)
3. Mount plugin API routes under `/api/plugins/:pluginId/...`
4. Expose admin navigation entries to the Admin UI

## Block Editor Architecture

Content is stored as JSON blocks in `content_json`. A rendered cache lives in `content_html` for fast public delivery. See `/docs/block-editor-model.md`.

## Theme / Settings Architecture

- **site_settings** — operational config (site name, URL, timezone, feature flags)
- **theme_settings** — design tokens (colors, fonts, layout, custom CSS)

See `/docs/theme-system.md`.

## Database Model

| Table | Purpose |
|-------|---------|
| users, sessions | Authentication (future) |
| roles, permissions, role_permissions, user_roles | RBAC (future) |
| pages, posts, events | Primary content |
| categories, tags, post_tags | Taxonomy (posts) |
| menus, menu_items | Navigation |
| media_items | Media metadata (R2 URLs later) |
| site_settings | Site config |
| theme_settings | Design tokens |
| plugins, plugin_settings | Plugin registry and config |
| audit_log | Change history |

Migrations live in `/migrations`. Never edit applied migrations; add new numbered files.

## API Route Structure

### Core (implemented or planned)

```
GET  /api/health
GET  /api/pages
GET  /api/posts
GET  /api/content/types      ← Phase 2 placeholder
GET  /api/plugins            ← Phase 2 placeholder
GET  /api/theme/settings     ← Phase 2 placeholder
GET  /api/editor/blocks      ← Phase 2 placeholder
```

### Future content CRUD

```
GET/POST/PATCH/DELETE  /api/pages/:id
GET/POST/PATCH/DELETE  /api/posts/:id
GET/POST/PATCH/DELETE  /api/events/:id
```

### Future plugin routes

```
GET/POST  /api/plugins/:pluginId/...
```

## Admin UI Structure (future)

```
/admin
  /dashboard
  /content
    /pages
    /posts
    /events
  /media
  /appearance
    /theme
    /menus
  /plugins
  /users
  /settings
```

Plugin admin pages register under `/admin/plugins/:pluginId/...`.

## Multi-Site Deployment Model

Each website is an independent deployment sharing the same codebase:

| Per site | Shared |
|----------|--------|
| D1 database | Worker source code |
| Enabled plugins (DB + config) | Core CMS logic |
| Theme settings | Block editor model |
| Content | Plugin framework |
| Custom domain / workers.dev URL | Migration files |

### Example deployments

**Storm chaser site**

- Plugins: `core-events`, `core-media`, `storm-chaser-example`, weather/radar plugins (future)
- Theme: dark, high-contrast, wide layout
- Content: events, livestream pages, alert banners

**Nonprofit site**

- Plugins: `core-events`, `core-seo`, donation/volunteer plugins (future)
- Theme: brand colors, accessible fonts
- Content: pages, posts, resource library

### Wrangler environments (recommended)

```toml
[env.storm-chaser]
name = "jesscms-storm-chaser"
[[env.storm-chaser.d1_databases]]
binding = "DB"
database_name = "jesscms-storm-chaser-db"
database_id = "..."

[env.nonprofit]
name = "jesscms-nonprofit"
...
```

Deploy with `wrangler deploy --env storm-chaser`.

## Phase Roadmap

| Phase | Focus |
|-------|-------|
| 1 | Worker + D1 + basic read API ✅ |
| 2 | Architecture docs, schema expansion, placeholders ✅ |
| 3 | Auth, CRUD APIs, plugin loader |
| 4 | Admin UI shell |
| 5 | Block editor UI |
| 6 | R2 media, plugin migrations, scheduled jobs |

## Design Principles

- **Boring and working** — prefer simple SQL and flat JSON over premature abstractions
- **Schema first** — define data model before UI
- **Manifest-driven plugins** — declare capabilities, load lazily
- **Separate JSON and HTML** — editor works on JSON; public site reads HTML cache
- **Migration discipline** — additive migrations only after deploy
