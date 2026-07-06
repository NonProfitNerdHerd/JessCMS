# Block Editor UI (Phase 5)

JessCMS admin content forms use a lightweight visual block editor instead of raw JSON/HTML textareas. Raw fields remain available under **Advanced / Raw JSON**.

## Where it appears

- `/admin/pages/new` and `/admin/pages/:id`
- `/admin/posts/new` and `/admin/posts/:id`
- `/admin/events/new` and `/admin/events/:id`

## Supported block types (v1)

| Type | Props | Notes |
|------|-------|-------|
| `paragraph` | `text`, alignment | Body copy |
| `heading` | `text`, `level` (1–4), alignment | Semantic heading tag |
| `image` | `url`, `alt`, `caption` | URL-only until media library |
| `button` | `text`, `url`, `style`, alignment | `style`: primary, secondary, outline |
| `quote` | `text`, `citation` | Blockquote + cite |
| `list` | `items[]`, `ordered` | Items edited one per line |
| `spacer` | `height` | Empty div with height |
| `html` | `raw_html` | **Only block that allows raw HTML** |

Not in v1: `columns`, `plugin_block`, `event_list`, `post_list`, embeds.

## JSON document format

```json
{
  "version": 1,
  "blocks": [
    {
      "id": "blk_abc123",
      "type": "paragraph",
      "props": { "text": "Hello" },
      "children": [],
      "style": { "textAlign": "left" },
      "plugin_source": null
    }
  ]
}
```

- Stored in `content_json` (canonical)
- Alignment is stored in `style.textAlign` (`left`, `center`, `right`)

## HTML rendering

On save, the editor generates `content_html` from blocks using the same rules as `public/admin/block-render.js` and `src/blocks/render.ts`.

- User text is escaped by default
- Only the `html` block outputs unescaped `raw_html`
- Blocks receive classes: `jess-block jess-{type} align-{left|center|right}`
- Buttons wrap in `<p class="jess-button-wrap">` with `<a class="jess-button primary|secondary|outline">`

Public-facing styles live in `/blocks.css`.

## Loading behavior

1. If `content_json` parses and has blocks → load into editor
2. Else if `content_html` exists → single `html` block fallback
3. Else → start with one empty `paragraph` block

## Editor features

- Add block (menu)
- Delete, move up/down, duplicate
- Edit fields with live preview per block
- Collapse/expand block card
- Advanced panel: raw JSON, generated HTML (read-only), **Apply raw JSON to editor**

## Files

| File | Role |
|------|------|
| `public/admin/block-render.js` | Client render + parse |
| `public/admin/block-editor.js` | Editor UI |
| `src/blocks/render.ts` | Server-side mirror (future validation) |
| `public/blocks.css` | Rendered block styles |

## Known limitations

- No drag-and-drop reorder (use up/down)
- No nested blocks / columns
- No media picker (image URL manual entry)
- No plugin blocks in editor
- No server-side HTML regeneration on API save (client sends both JSON + HTML)
- No collaborative editing or autosave

## Future block types

- `columns` / nested layouts
- `event_list`, `post_list` (server-rendered queries)
- `plugin_block` from enabled plugins
- `embed` (YouTube, etc.)
- Media library integration for `image`

## Testing

```powershell
npm run test:editor
```

Requires a running instance (`npm run dev`) and valid admin credentials (`ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars optional).
