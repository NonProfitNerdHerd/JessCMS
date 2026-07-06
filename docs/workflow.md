# Publishing Workflow

JessCMS Phase 7C adds an enterprise-style editorial workflow for pages, posts, and events.

## Workflow states

| State | Description |
|-------|-------------|
| **Draft** | Work in progress, not visible on the public site |
| **In Review** | Submitted for editorial review |
| **Approved** | Reviewed and ready to publish or schedule |
| **Scheduled** | Approved with a future publish date |
| **Published** | Live on the public site |
| **Archived** | Removed from public view, retained in admin |

Content `status` is kept in sync with workflow state for the public frontend:

- Draft, In Review, Approved → `draft`
- Scheduled → `scheduled` (+ `published_at`)
- Published → `published`
- Archived → `archived`

## Permissions

| Permission | Capability |
|------------|------------|
| `workflow:submit` | Submit draft content for review |
| `workflow:approve` | Approve or reject content in review |
| `workflow:publish` | Publish, schedule, or archive content |

Admins have all workflow permissions. Editors can submit for review. Viewers have read-only access.

## API

Replace `{type}` with `pages`, `posts`, or `events` and `{id}` with the content ID.

### Get workflow

```
GET /api/{type}/{id}/workflow
```

Returns current state, label, and recent history.

### Update workflow

```
PUT /api/{type}/{id}/workflow
Content-Type: application/json

{
  "action": "submit|approve|reject|publish|schedule|archive",
  "comment": "Optional note",
  "scheduled_at": "2026-07-15T14:00:00.000Z"  // required for schedule
}
```

### Allowed transitions

| Action | From | To | Permission |
|--------|------|-----|------------|
| `submit` | Draft | In Review | `workflow:submit` |
| `approve` | In Review | Approved | `workflow:approve` |
| `reject` | In Review | Draft | `workflow:approve` |
| `publish` | Draft, Approved | Published | `workflow:publish` |
| `schedule` | Draft, Approved | Scheduled | `workflow:publish` |
| `archive` | Any except Archived | Archived | `workflow:publish` |

## Audit logging

Every workflow transition is written to `workflow_history` and `audit_log` with:

- Actor
- From / to state
- Action and optional comment
- Client IP

Publish, approve, reject, and restore actions use dedicated audit action types.

## Admin UI

On page, post, and event edit screens:

- **Workflow panel** — current state, actions, comment field, schedule picker, history
- **Save** — saves content without changing workflow state (creates a revision)
- **Submit / Approve / Reject / Publish / Schedule / Archive** — workflow actions

## Database

- `workflow_states` — current state per content item
- `workflow_history` — transition log

See migration `migrations/0007_workflow_revisions.sql`.
