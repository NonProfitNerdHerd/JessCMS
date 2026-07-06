# Theme System

JessCMS separates operational site config from visual design. Theme settings control how content looks; site settings control how the site behaves.

## Two Settings Layers

| Store | Table | Examples |
|-------|-------|----------|
| Site settings | `site_settings` | Site name, URL, timezone, locale |
| Theme settings | `theme_settings` | Colors, fonts, layout, custom CSS |

Both use key-value storage with JSON-encoded values for complex types.

## Design Tokens

Theme settings map to reusable CSS custom properties on the public site:

```css
:root {
  --jess-site-name: "Storm Chaser HQ";
  --jess-color-primary: #2563eb;
  --jess-color-secondary: #64748b;
  --jess-color-background: #0f172a;
  --jess-color-text: #f8fafc;
  --jess-font-heading: "Inter", sans-serif;
  --jess-font-body: "Inter", sans-serif;
  --jess-layout-width: 1200px;
  --jess-button-radius: 0.375rem;
}
```

## Supported Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| site_name | string | "JessCMS Site" | Display name (also in site_settings) |
| logo_url | string | null | Header logo URL |
| favicon_url | string | null | Favicon URL |
| primary_color | string | "#2563eb" | Brand primary |
| secondary_color | string | "#64748b" | Brand secondary |
| background_color | string | "#ffffff" | Page background |
| text_color | string | "#1e293b" | Body text |
| heading_font | string | "system-ui, sans-serif" | Heading font stack |
| body_font | string | "system-ui, sans-serif" | Body font stack |
| button_style | object | `{ "variant": "solid", "radius": "0.375rem" }` | Button defaults |
| layout_width | string | "1200px" | Max content width |
| custom_css | string | "" | Raw CSS appended to public pages |

### button_style shape

```json
{
  "variant": "solid",
  "radius": "0.375rem",
  "size": "md"
}
```

Variants: `solid`, `outline`, `ghost`.

## Database Schema

```sql
CREATE TABLE theme_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Values are JSON strings. Simple strings are stored as `"\"My Site\""` or use plain string encoding — the API layer normalizes on read/write.

## API

### Phase 2 (placeholder)

```
GET /api/theme/settings
```

Returns default token object (static JSON).

### Phase 4+ (planned)

```
GET   /api/theme/settings
PATCH /api/theme/settings
GET   /api/theme/preview   # Render sample page with current tokens
```

## Admin UI (future)

```
/admin/appearance/theme
  - Colors panel
  - Typography panel
  - Layout panel
  - Custom CSS editor
  - Live preview
```

## Per-Site Theming

Each deployment has its own D1 database, so theme settings are naturally isolated:

- Storm chaser: dark background, high-contrast alert colors
- Nonprofit: warm brand palette, accessible contrast ratios

No code changes required — only theme_settings rows differ.

## Relationship to Blocks

Blocks can reference theme tokens in `style` overrides, but should prefer inherited tokens:

```json
{
  "type": "button",
  "props": { "text": "Donate", "url": "/donate", "variant": "primary" },
  "style": {}
}
```

The renderer applies `--jess-color-primary` for `variant: "primary"`.

## Custom CSS

`custom_css` is appended to the public layout stylesheet. Sanitize and scope in Phase 4 to prevent layout breakage. Restrict editing to admin role.

## Font Loading

Phase 4+ will inject Google Fonts or self-hosted `@font-face` based on `heading_font` and `body_font` selections. Phase 2 stores font stack strings only.

## Migration from site_settings

If legacy keys like `primary_color` exist in `site_settings`, a future migration can copy them to `theme_settings`. Phase 2 starts fresh with separate tables.
