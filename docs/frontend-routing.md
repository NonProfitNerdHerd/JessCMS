# Frontend Routing

The public website is served by `handlePublicRequest()` in `src/public/handler.ts`. Routing resolves entirely from D1 content via `resolvePublicView()` in `src/public/router.ts`.

## Request flow

```
GET request
  → skip /admin, /api, static assets (.css, .js, images)
  → /robots.txt, /sitemap.xml (generated)
  → plugin route hooks (registerPublicRoute)
  → resolvePublicView()
  → renderPublicView() + cache headers
  → ASSETS fallback for static files
```

Admin and API routes are handled before the public layer. Static files with file extensions bypass public routing so `/blocks.css` and `/theme/jess-default.css` are served from `public/`.

## URL map

| Path | View kind | Source |
|------|-----------|--------|
| `/` | `home` or `blog-index` | Page slug `home`, else latest posts |
| `/:slug` | `page` | Published page by slug |
| `/blog` | `blog-index` | Published posts, paginated |
| `/blog/:slug` | `post` | Published post |
| `/events` | `events-index` | Published events, paginated |
| `/events/:slug` | `event` | Published event |
| `/category/:slug` | `category` | Posts in category |
| `/tag/:slug` | `tag` | Posts with tag |
| `/search?q=` | `search` | Full-text search across pages, posts, events |
| unmatched | `not-found` | 404 page |

## Reserved slugs

Top-level page slugs cannot collide with system routes:

`blog`, `events`, `category`, `tag`, `search`, `admin`, `api`

## Pagination

List views accept `?page=N` (1-based). Pagination metadata is attached to the view and rendered in archive templates.

Search preserves `?q=` when paginating.

## Published content filter

Only content matching this condition is routable:

```
status = 'published'
AND (published_at IS NULL OR published_at <= now)
```

See `src/public/published.ts`.

## Plugin routes

Register custom routes that run **before** default resolution:

```typescript
registerPublicRoute({
  pattern: /^\/weather$/,
  handler: async (ctx) => {
    return new Response("<html>...</html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
});
```

Return `null` from the handler to fall through to default routing.

## SEO endpoints

| Path | Handler |
|------|---------|
| `/sitemap.xml` | `getSitemapEntries()` — home, blog, events, all published URLs |
| `/robots.txt` | Allows `/`, references sitemap |

Both responses include public cache headers (`max-age=3600`).

## Caching

HTML responses use:

```
Cache-Control: public, max-age=300, s-maxage=600
```

Error pages use a shorter TTL. Admin routes are never cached by this layer.

## Adding a new archive type

1. Add query functions in `src/public/queries.ts`.
2. Extend `PublicViewKind` and routing in `src/public/router.ts`.
3. Add a render case in `src/theme/render.ts`.
4. Extend `seoForView()` in `src/theme/seo.ts`.
5. Add sitemap entries if the URLs should be indexed.
