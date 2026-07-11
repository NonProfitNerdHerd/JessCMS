# Block Editor Model

JessCMS stores editor content as a JSON block tree, similar in concept to WordPress Gutenberg. The public site reads a pre-rendered HTML cache; the admin editor reads and writes JSON.

## Document Structure

```json
{
  "version": 1,
  "blocks": [
    {
      "id": "blk_a1b2c3",
      "type": "paragraph",
      "props": { "text": "Hello world." },
      "children": [],
      "style": {},
      "plugin_source": null
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| version | number | Schema version for forward-compatible migrations |
| blocks | Block[] | Top-level block array (root is not a block itself) |

## Block Shape

Every block shares the same interface:

```typescript
interface Block {
  id: string;           // Unique within the document (e.g. blk_<nanoid>)
  type: string;         // Registered block type id
  props: Record<string, unknown>;  // Type-specific content
  children: Block[];    // Nested blocks (columns, groups, etc.)
  style: BlockStyle;    // Inline layout/visual overrides
  plugin_source: string | null;  // Plugin id if type is plugin_block
}
```

```typescript
interface BlockStyle {
  margin?: string;
  padding?: string;
  backgroundColor?: string;
  textAlign?: "left" | "center" | "right";
  className?: string;
  [key: string]: unknown;
}
```

## Storage

| Column | Purpose |
|--------|---------|
| content_json | Canonical **published** (or working draft) editor document |
| content_html | Rendered HTML cache for public pages |
| draft_content_json | Optional in-progress edits for already-published content |

On save: validate JSON → render HTML (server) → store both.
On draft-save of published content: write `draft_content_json` only.
On publish: promote draft → `content_json` + regenerate `content_html`.

On read (public): serve `content_html` (or re-render from `content_json`).
On read (admin): prefer `draft_content_json` when present, else `content_json`.

**Divider vs Spacer:** Divider is a visible horizontal rule. Spacer is empty vertical space. There is no separate Separator block.


## Core Block Types

### paragraph

```json
{
  "type": "paragraph",
  "props": { "text": "Body copy here." }
}
```

### heading

```json
{
  "type": "heading",
  "props": { "level": 2, "text": "Section Title" }
}
```

Levels 1–6. `level` defaults to 2.

### image

```json
{
  "type": "image",
  "props": {
    "media_id": "med_123",
    "url": "https://example.com/image.jpg",
    "alt": "Description",
    "caption": ""
  }
}
```

Uses `media_id` when available; `url` as fallback until R2 is wired.

### button

```json
{
  "type": "button",
  "props": {
    "text": "Learn more",
    "url": "/about",
    "variant": "primary"
  }
}
```

### columns

```json
{
  "type": "columns",
  "props": { "columnCount": 2 },
  "children": [
    { "type": "column", "props": {}, "children": [/* blocks */] },
    { "type": "column", "props": {}, "children": [/* blocks */] }
  ]
}
```

### spacer

```json
{
  "type": "spacer",
  "props": { "height": "2rem" }
}
```

### quote

```json
{
  "type": "quote",
  "props": { "text": "Quote text.", "citation": "Author Name" }
}
```

### embed

```json
{
  "type": "embed",
  "props": {
    "provider": "youtube",
    "url": "https://www.youtube.com/watch?v=...",
    "aspectRatio": "16/9"
  }
}
```

### list

```json
{
  "type": "list",
  "props": { "ordered": false, "items": ["Item one", "Item two"] }
}
```

### html

```json
{
  "type": "html",
  "props": { "raw": "<div class=\"custom\">...</div>" }
}
```

Escape and sanitize on render. Restrict to trusted roles (future).

### event_list

```json
{
  "type": "event_list",
  "props": {
    "limit": 5,
    "filter": "upcoming",
    "showLocation": true
  }
}
```

Server-side render queries `events` table (future).

### post_list

```json
{
  "type": "post_list",
  "props": {
    "limit": 10,
    "category_slug": null,
    "layout": "card"
  }
}
```

### alert_banner

```json
{
  "type": "alert_banner",
  "props": {
    "severity": "warning",
    "title": "Severe weather alert",
    "message": "Take shelter immediately.",
    "dismissible": true
  }
}
```

Common on storm chaser deployments.

### plugin_block

Generic wrapper for plugin-registered blocks.

```json
{
  "type": "plugin_block",
  "plugin_source": "storm-chaser-example",
  "props": {
    "block_type": "radar_embed",
    "settings": { "region": "midwest" }
  }
}
```

## Block Registry

Core blocks are registered in code. Plugins add entries via manifest `blocks` array.

`GET /api/editor/blocks` returns the merged registry (static placeholder in Phase 2).

## Validation Rules (future)

1. Every block must have a unique `id` within the document
2. `type` must exist in the registry
3. `props` must match the block type schema
4. `plugin_block` requires `plugin_source` and the plugin must be enabled
5. Max nesting depth: 10 levels
6. Max document size: 512 KB JSON

## Rendering Pipeline (future)

```
content_json
  → parse & validate
  → walk block tree
  → call block renderer per type (core or plugin)
  → concatenate HTML
  → sanitize
  → store content_html
```

## Migration from Legacy Content

Phase 2 migration copies existing `content` column values into `content_html`. Empty `content_json` documents are created on first edit.

## Versioning

Increment `version` when the block schema changes. A migration function will upgrade older documents on load.
