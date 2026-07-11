# Visual Block Editor Architecture

## Repository findings (audit)

| Area | Current state | Decision |
|------|---------------|----------|
| Frontend | Cloudflare Workers + vanilla JS admin (`public/admin/*`) | **Extend** — do not introduce React/Gutenberg packages |
| Storage | `content_json` + `content_html` on pages/posts/events/`content_entries` | Keep; add optional `draft_content_json` |
| Block shape | `{ id, type, props, children, style, plugin_source }` | Keep `props` (not WordPress `attributes`) for compatibility |
| Registry | `BLOCK_TYPES` in `src/foundation/registry.ts` + runtime | Extend metadata; keep sync |
| Editor UI | Card-list `BlockEditor` in `block-editor.js` | Replace with visual workspace shell |
| Public render | `src/blocks/render.ts` + mirrored `block-render.js` | Make recursive; share semantics |
| Workflow | Status + workflow + revisions | Keep; editor toolbar wires Save draft / Publish |
| DnD / rich text libs | None in `package.json` | Native HTML5 DnD; lightweight contenteditable + sanitize (no new npm dep yet) |
| Auth | `content:create/update/publish` | Unchanged |

## Naming

- Document field: **`props`** (existing). Spec “attributes” maps to `props`.
- **Divider** = visible horizontal rule. **Spacer** = empty vertical space. No separate “Separator” block.

## Proposed file structure

```
docs/visual-block-editor.md          # this file
docs/block-editor-model.md           # updated model notes
migrations/0014_draft_content_json.sql
src/blocks/types.ts                  # shared types
src/blocks/definitions.ts            # editor metadata (supports, categories)
src/blocks/registry.ts               # public renderer registry (existing)
src/blocks/validate.ts               # server-side document validation
src/blocks/render.ts                 # recursive public/admin HTML
src/blocks/persist.ts                # draft/publish body preparation
src/routes/editor.ts                 # validate + enriched block catalog
public/admin/block-editor.js         # visual editor workspace
public/admin/block-render.js         # client render (mirrors server)
public/admin/styles.css              # editor chrome
scripts/visual-editor-smoke-test.mjs
```

## Database

```sql
ALTER TABLE pages ADD COLUMN draft_content_json TEXT;
ALTER TABLE posts ADD COLUMN draft_content_json TEXT;
ALTER TABLE events ADD COLUMN draft_content_json TEXT;
ALTER TABLE content_entries ADD COLUMN draft_content_json TEXT;
```

- **Published body:** `content_json` + `content_html`
- **In-progress edits on published items:** `draft_content_json` (nullable)
- Editor loads `draft_content_json ?? content_json`
- Save draft on published: write `draft_content_json` only
- Publish: promote draft → `content_json`, regenerate `content_html`, clear draft

## API

| Route | Change |
|-------|--------|
| Existing content CRUD | Accept `draft_content_json`; server regenerates `content_html` from JSON |
| `POST /api/editor/validate` | Validate block document (auth + `content:update`) |
| `GET /api/editor/blocks` | Enriched catalog (categories, supports, nesting) |

## Libraries reused

- Existing session auth / permissions
- Existing media library picker
- Existing workflow + revisions UI
- Existing theme CSS (`blocks.css`)

## New dependencies

**None for this phase.** Native drag-and-drop and sanitized contenteditable. TipTap/ProseMirror may be added later if richer inline formatting is required.

## Risks

1. **Dual renderers** (TS + JS) can drift — keep prop/type parity and smoke tests.
2. **`getDocument()` previously wiped `children`** — fixed; nested columns now persist.
3. **Published vs draft** — older clients that only send `content_json` still work.
4. **Large pages** — no virtualization yet; target ≥100 blocks with local state + undo batches.

## Phase map

| Phase | Status in this delivery |
|-------|-------------------------|
| 1 Architecture + data model | Done |
| 2 Editor shell | Done |
| 3 Core editing behavior | Partial (insert/select/delete/duplicate/reorder/DnD/undo/redo; no copy-paste yet) |
| 4 Foundational blocks | Heading, Paragraph, Button, Divider, Image, Columns (+ keep existing quote/list/spacer/html/form) |
| 5 Marketing / layout blocks | Hero, Call to Action, Card, Image Box, Feature Grid — see `docs/marketing-layout-blocks.md` |
| 6–9 | Remaining (Gallery, Accordion, Map, Timeline next) |
