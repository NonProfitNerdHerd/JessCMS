# Frontend Rendering

JessCMS renders the public website server-side in the Cloudflare Worker. HTML is built from D1 data, theme settings, menus, and block documents.

## Core modules

| Module | Role |
|--------|------|
| `src/public/handler.ts` | HTTP entry, caching, sitemap/robots |
| `src/public/router.ts` | URL → `PublicView` |
| `src/public/queries.ts` | D1 reads for published content |
| `src/theme/render.ts` | `PublicView` → HTML string |
| `src/theme/layouts/` | Template wrappers |
| `src/theme/components/` | Header, footer, nav, SEO head |
| `src/blocks/registry.ts` | Block renderer dispatch |

## PublicView

Every request resolves to a `PublicView` (`src/public/types.ts`):

- `kind` — home, page, post, blog-index, events-index, event, category, tag, search, not-found, error
- `template` — layout template from content record
- `seo` — filled by `seoForView()` before render
- Content fields — `page`, `post`, `posts`, `event`, `events`, etc.

## Document structure

```html
<!DOCTYPE html>
<html>
  <head><!-- SEO, CSS variables, blocks.css, theme CSS --></head>
  <body>
    <header><!-- logo, primary nav --></header>
    <main><!-- view content --></main>
    <footer><!-- footer nav, copyright --></footer>
  </body>
</html>
```

Blank template omits header and footer.

## Block rendering

Content is stored as `content_json` (block document) or fallback `content_html`.

Supported block types:

- `paragraph`, `heading`, `button`, `image`, `quote`, `list`, `spacer`, `html`

Rendering path:

1. `parseContentDocument()` parses JSON
2. Each block passes through plugin renderers (`hooks.ts`) then `renderPublicBlock()` (`registry.ts`)
3. Core HTML from `renderBlock()` in `src/blocks/render.ts`

Output uses semantic elements (`<article>`, `<figure>`, `<blockquote>`, heading levels, etc.).

## SEO output

`renderHead()` emits:

- `<title>`, meta description, robots
- `<link rel="canonical">`
- Open Graph tags (`og:title`, `og:description`, `og:type`, `og:url`, `og:image`)
- Twitter Card tags
- JSON-LD placeholder (`WebSite` schema by default; extend via `seo.jsonLd`)
- Favicon, theme CSS, custom CSS

Search, 404, and error views use `noindex` robots directives.

## Media

`UrlMediaProvider` in `src/theme/media.ts` implements `MediaProvider`:

- Resolves `media_items.url` from D1 by ID
- Accepts direct image URLs in block props
- R2 upload support can plug in by swapping the provider

## Error pages

| Status | View kind | Content |
|--------|-----------|---------|
| 404 | `not-found` | Friendly message + home link |
| 500 | `error` | Generic error + home link |

Uncaught exceptions in `handlePublicRequest()` render the 500 page.

## Archive pages

Blog index, events index, category, tag, and search views share card + pagination patterns from `src/theme/components/html.ts`.

Posts and events are ordered newest first (`published_at DESC` / `start_datetime DESC`).

## Extending rendering

### Custom blocks

```typescript
registerPluginBlockRenderer("weather-alert", (block) => {
  return `<div class="weather-alert">${block.props.message}</div>`;
});
```

### Head metadata

```typescript
registerHeadInjector((ctx) =>
  `<meta name="generator" content="JessCMS">`,
);
```

### Layouts

```typescript
registerLayout("magazine", (ctx, content) => {
  return wrapDocument(ctx, `<div class="magazine">${content}</div>`);
});
```

Use template name `magazine` on content records (after registering the layout).

## Testing

Run the frontend smoke test against a running dev server or deployed URL:

```bash
npm run dev          # terminal 1
npm run test:frontend  # terminal 2
```

Set `BASE_URL` to test production:

```bash
BASE_URL=https://jesscms.example.workers.dev npm run test:frontend
```
