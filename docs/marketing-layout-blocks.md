# Marketing & Layout Blocks

## Blocks

| Type | Category | Layout variants |
|------|----------|-----------------|
| `hero` | layout | `centered`, `split-left`, `split-right`, `overlay` |
| `call_to_action` | marketing | `centered`, `horizontal`, `split`, `banner`, `boxed` |
| `card` | marketing | orientations: `vertical`, `horizontal-left`, `horizontal-right`, `overlay`, `text-only` |
| `image_box` | layout | `image-left`, `image-right`, `image-above`, `content-above`, `overlay` |
| `feature_grid` | marketing | display styles: `plain`, `cards`, `bordered`, `icons`, `images` |

Props live under `block.props` (not WordPress `attributes`). Nested objects are used for actions, media, background, overlay, border, spacing, and feature items.

## Shared helpers

- `src/blocks/shared-props.ts` — color tokens, responsive inheritance, actions, media, background, overlay, border, spacing
- `src/blocks/marketing.ts` — defaults, normalize, public HTML render
- `src/blocks/migrate.ts` — per-block migration (v0 → v1 fills defaults)

## Theme tokens

Prefer `{ "type": "token", "value": "color.primary" }` or `{ "type": "custom", "value": "#123456" }`. Resolved via CSS variables (`--jess-primary`, etc.).

## Responsive values

```json
{ "desktop": "3rem", "tablet": "2rem", "mobile": "1.5rem" }
```

Inheritance: mobile ← tablet ← desktop.

## Feature Grid items

Repeater in the Block inspector. Duplication remints item IDs. Structure panel label: `Feature Grid: {heading}, N items`.

## Validation

Server `validateContentDocument` enforces headings, action completeness, card link modes, feature item IDs/headings, column ranges, overlay opacity, and multiple-H1 warnings (including Hero H1).

## Example Hero JSON

```json
{
  "id": "blk_hero_1",
  "type": "hero",
  "props": {
    "version": 1,
    "heading": "Welcome",
    "headingLevel": 1,
    "layout": "centered",
    "primaryAction": { "label": "Join", "url": "/join", "style": "primary", "target": "_self" }
  },
  "children": [],
  "style": { "width": "full" },
  "plugin_source": null
}
```

## Registering future layout blocks

1. Add to `BLOCK_TYPES` in `src/foundation/registry.ts`
2. Add `CATEGORY_META` + `VISUAL_EDITOR_BLOCK_TYPES` in `definitions.ts`
3. Add defaults/render in `marketing.ts` (or a new module) and wire `renderBlock`
4. Mirror catalogs/defaults/preview in `public/admin/block-render.js`
5. Add inspector via shared controls in `block-editor.js`
6. Extend `validate.ts` + `migrate.ts`
7. Add CSS in `public/blocks.css`
8. Extend `scripts/marketing-blocks-unit-test.mjs`

## Tests

```bash
npm run test:marketing-blocks
npm run test:visual-editor
```
