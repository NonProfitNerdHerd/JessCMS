# JessCMS Admin UI

Phase 4 adds a minimal browser-based admin interface served by the same Cloudflare Worker as the API.

## Admin routes

| URL | Purpose |
|-----|---------|
| `/admin` | Redirects to dashboard or login |
| `/admin/login` | Email/password sign-in |
| `/admin/dashboard` | Overview and quick links |
| `/admin/pages` | Page list |
| `/admin/pages/new` | Create page |
| `/admin/pages/:id` | Edit page |
| `/admin/posts` | Post list |
| `/admin/posts/new` | Create post |
| `/admin/posts/:id` | Edit post |
| `/admin/events` | Event list |
| `/admin/events/new` | Create event |
| `/admin/events/:id` | Edit event |
| `/admin/settings/theme` | Theme/design tokens |
| `/admin/plugins` | Enable/disable plugins |

Static assets:

| URL | File |
|-----|------|
| `/admin/styles.css` | Admin stylesheet |
| `/admin/app.js` | Admin client script |

## How login works

1. User submits email/password on `/admin/login`.
2. Browser calls `POST /api/auth/login`.
3. Worker validates credentials and sets an **HttpOnly** session cookie.
4. Browser redirects to `/admin/dashboard`.
5. All admin HTML routes check the session server-side and redirect to login if missing.

The client never sees or stores the session token in JavaScript. API calls use `credentials: "include"` so the cookie is sent automatically.

## Available features

- Sign in / sign out
- Dashboard with content counts
- List/filter/search pages, posts, events
- Create, edit, publish, archive, delete content
- Textarea editing for `content_json` and `content_html`
- Theme settings editor
- Plugin enable/disable (stored in D1)

## API additions in Phase 4

| Method | Route | Permission |
|--------|-------|------------|
| PUT | `/api/theme/settings` | `settings:update` |
| PUT | `/api/plugins/:id` | `plugins:update` |

List endpoints also accept `?q=` for title/slug search.

## Intentionally not built yet

- Gutenberg-style block editor UI
- Media library uploads (R2)
- Menu builder UI
- User management UI
- Role assignment UI
- Plugin runtime execution
- WYSIWYG HTML editor
- Public-facing site theme rendering

Content is edited via plain forms and JSON/HTML textareas. This is deliberate — usability first, fancy editor later.

## Architecture

```
Browser
  ├─ GET /admin/*        → Worker HTML templates (auth required)
  ├─ GET /admin/*.css/js → public/ static assets
  └─ /api/*              → existing JSON API (cookie auth)
```

Files:

- `src/admin/layout.ts` — HTML shell and layout
- `src/admin/handlers.ts` — Admin route handlers
- `public/admin/styles.css` — Admin styles
- `public/admin/app.js` — Client-side API calls and DOM updates

## Local usage

```powershell
npm run dev
```

Open `http://127.0.0.1:8787/admin` (port shown by wrangler).

Create an admin user if needed:

```powershell
npm run user:create-admin -- --email admin@example.com --password "YourSecurePassword123!"
```

## Next phase: block editor

Phase 5 will replace the raw JSON textarea with a visual block editor that:

- Reads block registry from `GET /api/editor/blocks`
- Edits `content_json` visually
- Regenerates `content_html` on save
- Keeps the same CRUD APIs underneath

The admin shell, auth, and list/edit routes from Phase 4 should remain mostly unchanged.
