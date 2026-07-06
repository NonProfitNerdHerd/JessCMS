# Forms Builder

The **Forms Builder** plugin (`forms-builder`) lets you create contact forms, surveys, and lead capture forms with a submissions inbox—similar to WPForms or Ninja Forms.

## Plugin structure

```
plugins/forms-builder/manifest.json
src/plugins/forms-builder/
  types.ts
  repository.ts
  validation.ts
  security.ts
  render.ts
  routes.ts
  admin-pages.ts
  index.ts
public/forms-embed.js
public/admin/forms-builder.js
```

Enable or disable the plugin from **Admin → Plugins**.

## Database

| Table | Purpose |
|-------|---------|
| `forms` | Form definition (slug, title, status, settings) |
| `form_fields` | Field definitions with order and validation |
| `form_submissions` | Submission records |
| `form_submission_values` | Per-field values |

### Form statuses

`draft`, `active`, `archived`

Only **active** forms are available on the public site.

### Field types

`text`, `textarea`, `email`, `phone`, `number`, `select`, `radio`, `checkbox`, `date`, `hidden`, `consent`

## Admin API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/forms` | `forms:read` |
| POST | `/api/forms` | `forms:create` |
| GET | `/api/forms/:id` | `forms:read` |
| PUT | `/api/forms/:id` | `forms:update` |
| DELETE | `/api/forms/:id` | `forms:delete` |
| POST | `/api/forms/:id/fields` | `forms:update` |
| PUT | `/api/forms/:id/fields/:fieldId` | `forms:update` |
| DELETE | `/api/forms/:id/fields/:fieldId` | `forms:update` |
| POST | `/api/forms/:id/fields/reorder` | `forms:update` |
| GET | `/api/forms/:id/submissions` | `forms:submissions:read` |
| GET | `/api/forms/submissions/:submissionId` | `forms:submissions:read` |
| PUT | `/api/forms/submissions/:submissionId` | `forms:submissions:update` |
| DELETE | `/api/forms/submissions/:submissionId` | `forms:submissions:update` |

## Public API

No authentication required. Only **active** forms.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/forms/:slug` | Form schema for rendering |
| POST | `/api/public/forms/:slug/submit` | Submit values |

Submit body:

```json
{
  "values": {
    "email": "user@example.com",
    "message": "Hello"
  }
}
```

## Admin UI

| Path | Purpose |
|------|---------|
| `/admin/forms` | Form list |
| `/admin/forms/new` | Create form |
| `/admin/forms/:id` | Edit form + field builder |
| `/admin/forms/:id/submissions` | Submission inbox |
| `/admin/forms/submissions/:submissionId` | Submission detail |

Field builder supports add, edit, delete, reorder, and required toggle.

## Block editor

Add a **Form** block with properties:

- `form_id`
- `form_slug`
- `display_style` — `embedded`, `card`, or `minimal`

The public site loads the form via `forms-embed.js`, which fetches the schema and posts submissions to the public API.

## Security

- **Server validation** — all field types validated on submit
- **Honeypot** — hidden `_jess_hp` field; non-empty submissions are silently accepted but discarded as spam
- **IP hashing** — submitter IP stored as SHA-256 hash (optional `FORMS_IP_PEPPER` env var)
- **Turnstile placeholder** — enable in form settings; token verification stub ready for Cloudflare Turnstile

## Permissions

| Slug | Description |
|------|-------------|
| `forms:read` | View forms |
| `forms:create` | Create forms |
| `forms:update` | Edit forms and fields |
| `forms:delete` | Delete forms |
| `forms:submissions:read` | View submissions |
| `forms:submissions:update` | Update/delete submissions |

## Testing

```bash
npm run dev
npm run test:forms
```

Set `BASE_URL` for remote testing.
