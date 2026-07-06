# Theme Development

JessCMS serves the public website through a theme layer under `src/theme/`. The default theme is **Jess Default**, styled with `public/theme/jess-default.css` and CSS variables generated from `theme_settings`.

## Directory layout

```
src/theme/
  settings.ts       # Load theme_settings from D1, emit CSS variables
  hooks.ts          # Plugin extensibility registration
  menus.ts          # Primary/footer menu resolution
  seo.ts            # Title, description, canonical, robots
  content.ts        # Render page/post/event bodies from blocks
  render.ts         # Map PublicView → HTML
  media.ts          # MediaProvider interface (URL-only today)
  layouts/index.ts  # Page templates
  components/       # Header, footer, nav, pagination helpers
public/theme/
  jess-default.css  # Default public stylesheet
```

## Theme settings

Settings are stored in the `theme_settings` table and loaded by `loadThemeSettings()`. Supported keys:

| Key | Purpose |
|-----|---------|
| `theme_name` | Active theme label (default: Jess Default) |
| `site_name` | Site title in header and SEO |
| `logo_url` | Header logo image URL |
| `favicon_url` | Favicon link |
| `primary_color` | Brand / link color |
| `secondary_color` | Secondary accent |
| `background_color` | Page background |
| `text_color` | Body text |
| `heading_font` | Heading font stack |
| `body_font` | Body font stack |
| `button_style` | `{ variant, radius, size }` |
| `layout_width` | Max container width |
| `border_radius` | Global border radius |
| `custom_css` | Raw CSS appended in `<head>` |

`themeCssVariables()` writes these as `:root` custom properties (`--jess-primary`, etc.).

## Page templates

Each page, post, or event can set a `template` field:

| Template | Layout |
|----------|--------|
| `default` | Header, content, footer |
| `landing` | Wide hero-style main area |
| `full-width` | Edge-to-edge content |
| `sidebar-right` | Content + right sidebar |
| `sidebar-left` | Left sidebar + content |
| `blank` | Content only (no header/footer) |

Templates are selected in the admin editor and normalized by `normalizeTemplate()`.

## Menus

Menus live in `menus` and `menu_items`. Locations:

- `primary` — header navigation
- `footer` — footer navigation

Menu items support internal links (via `content_type` + `content_id`) or explicit URLs, nesting via `parent_id`, and `open_in_new_tab`. Active items are highlighted based on the current pathname.

## Block rendering

Blocks from the editor are rendered server-side via `src/blocks/render.ts` and `src/blocks/registry.ts`. Plugins can register additional renderers with `registerPluginBlockRenderer()` in `src/theme/hooks.ts`.

## Plugin hooks

Themes and plugins can extend the public site without editing core files:

```typescript
import {
  registerPublicRoute,
  registerLayout,
  registerPluginBlockRenderer,
  registerHeadInjector,
  registerCssInjector,
  registerJsInjector,
  registerMenuItemInjector,
  registerBodyEndInjector,
} from "./theme/hooks";
```

| Hook | Use |
|------|-----|
| `registerPublicRoute` | Custom URL patterns before default routing |
| `registerLayout` | Named layout renderer |
| `registerPluginBlockRenderer` | New block types |
| `registerHeadInjector` | Extra `<head>` tags |
| `registerCssInjector` | Inline CSS |
| `registerJsInjector` | Inline scripts |
| `registerBodyEndInjector` | HTML before `</body>` |
| `registerMenuItemInjector` | Dynamic menu items |

## Creating a new theme

1. Add a stylesheet under `public/theme/your-theme.css`.
2. Reference it from a custom layout or by extending `renderHead()` (via head injector).
3. Optionally register custom layouts with `registerLayout()`.
4. Store `theme_name` in `theme_settings` for identification.

Jess Default is the reference implementation. Keep rendering logic in `src/theme/` and presentation in CSS under `public/theme/`.
