# Forms Builder

> Full platform documentation: [forms-platform.md](./forms-platform.md)

The **Forms Builder** plugin (`forms-builder`) lets you create contact forms, surveys, and lead capture forms with a submissions inbox—similar to WPForms or Ninja Forms.

## Plugin structure

```
plugins/forms-builder/manifest.json
src/plugins/forms-builder/
  types.ts
  definition.ts
  field-registry.ts
  repository.ts
  validation.ts
  security.ts
  email.ts
  notifications.ts
  render.ts
  routes.ts
  admin-pages.ts
  index.ts
public/forms-embed.js
public/admin/forms-builder.js
docs/forms-platform.md
```

Enable or disable the plugin from **Admin → Plugins**.

## Quick start

```bash
npm run db:migrate:local
npm run dev
npm run test:forms-platform
npm run test:forms
```

Open `/admin/forms` to create and publish a form, then embed it with the **Form** block in the page editor.

## Admin UI

| Path | Purpose |
|------|---------|
| `/admin/forms` | Form dashboard |
| `/admin/forms/new` | Create form (templates) |
| `/admin/forms/:id` | Visual builder (draft / publish) |
| `/admin/forms/:id/submissions` | Submission inbox |
| `/admin/forms/submissions/:submissionId` | Submission detail |

## Block editor

Add a **Form** block with properties:

- `form_id` / `form_slug` (stable references)
- `show_title` / `show_description`
- `display_style`, `alignment`, `width`

Public pages load the published form via `forms-embed.js`.

## Security

- Server-side validation (authoritative)
- Honeypot (`_jess_hp`)
- Idempotency keys on submit
- IP hashing (optional `FORMS_IP_PEPPER`)
- Draft forms never exposed publicly
- Notification header sanitization

## Permissions

See [forms-platform.md](./forms-platform.md) for the full capability list including `forms:publish`, `forms:export`, and `forms:notifications`.

## Testing

```bash
npm run db:migrate:local
npm run dev
npm run test:forms-platform
npm run test:forms
```

Set `BASE_URL` for a non-default local port.
