# Forms Platform

JessCMS forms are implemented as the **forms-builder** plugin and extend the existing CMS architecture (RBAC, admin nav, block editor, D1, audit log, plugin runtime).

This document covers Phases 1–4: foundation, builder shell, foundational fields, and public runtime.

## Architecture

Four related components:

1. **Form definition** — versioned JSON (`draft_definition_json` / `published_definition_json`) plus synced `form_fields` rows for compatibility
2. **Form builder** — admin visual editor (`/admin/forms/:id`)
3. **Form runtime** — public embed + submit API
4. **Form submissions** — separate tables from definitions

Integrations and notification routing are **in-app only** (no Zapier / Power Automate). Future automation should use JessCMS low-code flows.

## Database

Migration: `migrations/0015_forms_platform.sql`

| Entity | Purpose |
|--------|---------|
| `forms` | Meta + draft/published definition JSON + counters |
| `form_versions` | Immutable draft/publish revisions |
| `form_fields` | Normalized field mirror of the draft definition |
| `form_submissions` | Entries (separate from definitions) |
| `form_submission_values` | Dynamic field values (no per-field columns) |
| `form_submission_notes` | Internal admin notes (Phase 8+) |
| `form_submission_events` | Audit trail for submission lifecycle |
| `form_notification_log` | Email delivery attempts |

### Statuses

Forms: `draft`, `active` (published), `disabled`, `archived`

Only **active** forms are publicly available.

## Form definition schema

```json
{
  "schemaVersion": 1,
  "formId": "frm_…",
  "settings": {
    "success_message": "…",
    "submit_label": "Submit",
    "notifications": [],
    "confirmations": []
  },
  "pages": [{ "id": "page_…", "title": "Page 1", "fields": [] }],
  "design": {},
  "security": {}
}
```

Field IDs are stable. Labels can change without changing IDs.

## Field registry

Central registry: `src/plugins/forms-builder/field-registry.ts`

Foundational types: `text`, `textarea`, `email`, `phone`, `number`, `url`, `hidden`, `name`, `address`, `select`, `radio`, `checkbox`, `yes_no`, `date`, `consent`, `heading`, `paragraph_content`, `divider`

Content fields (`heading`, `paragraph_content`, `divider`) do not store submission values.

## Permissions

| Permission | Purpose |
|------------|---------|
| `forms:read` | View forms / builder |
| `forms:create` | Create / duplicate |
| `forms:update` | Edit drafts |
| `forms:publish` | Publish draft → active |
| `forms:delete` | Delete forms |
| `forms:export` | Export definitions / submissions |
| `forms:notifications` | Manage notification settings |
| `forms:submissions:read` | View entries |
| `forms:submissions:update` | Update / delete entries |

## Admin routes

| Path | Page |
|------|------|
| `/admin/forms` | Dashboard |
| `/admin/forms/new` | Create (template picker) |
| `/admin/forms/:id` | Visual builder |
| `/admin/forms/:id/submissions` | Entries list |
| `/admin/forms/submissions/:id` | Entry detail |

## API routes

### Administration

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/forms` | `forms:read` |
| POST | `/api/forms` | `forms:create` |
| GET | `/api/forms/field-types` | `forms:read` |
| GET | `/api/forms/:id` | `forms:read` |
| PUT | `/api/forms/:id` | `forms:update` |
| PUT | `/api/forms/:id/draft` | `forms:update` |
| POST | `/api/forms/:id/publish` | `forms:publish` |
| POST | `/api/forms/:id/duplicate` | `forms:create` |
| GET | `/api/forms/:id/versions` | `forms:read` |
| POST | `/api/forms/:id/versions/:versionId/restore` | `forms:update` |
| GET | `/api/forms/:id/export` | `forms:read` |
| DELETE | `/api/forms/:id` | `forms:delete` |

Legacy field CRUD (`/fields`, reorder) remains and syncs through the definition.

### Public

| Method | Path |
|--------|------|
| GET | `/api/public/forms/:slug` |
| POST | `/api/public/forms/:slug/submit` |

Draft forms are never exposed publicly.

Submit supports `Idempotency-Key` to avoid duplicate entries on retries.

## Builder features (Phases 2–3)

- Top toolbar: save, publish, undo/redo, preview widths, entries, duplicate/export/disable/delete
- Left: field palette + structure list
- Center: canvas with drag-and-drop reorder / insert
- Right: field inspector or form settings (confirmation + admin notification)
- Autosave draft with conflict detection via `expected_draft_version`

## Runtime features (Phase 4)

- Published form loading
- Accessible markup + honeypot
- Client + server validation
- Submission persistence + sequence numbers
- Confirmation message or redirect
- Admin notification via email provider interface (default: console logger)
- Form block in the page editor (`form_id` / `form_slug`, title/description toggles, width, alignment)

## Email notifications

Provider interface: `src/plugins/forms-builder/email.ts`

Default provider logs to the Worker console. A production provider must be registered with `setEmailProvider()`.

Submission **succeeds even if notification delivery fails**. Failures are recorded in `form_notification_log` and `form_submission_events`.

Merge tags: `{form:name}`, `{form:id}`, `{form:slug}`, `{submission:id}`, `{submission:summary}`

## Form block

Register type `form` in the block editor. Stores stable `form_id` + `form_slug`. Public pages always render the form’s current published version.

## Commands

```bash
npm run db:migrate:local
npm run db:migrate:remote
npm run dev
npm run test:forms-platform
npm run test:forms
```

## Known limitations (later phases)

- Multi-page forms, conditional logic, progress indicators
- File upload / signature / repeater / Likert / NPS
- Advanced spam scoring, CAPTCHA providers, rate limits
- CSV export UI, analytics, webhooks
- Save-and-resume, calculations beyond basics

**Recommended next phase:** Advanced Form Layout and Conditional Logic
