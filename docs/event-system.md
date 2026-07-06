# Event System

JessCMS Phase 9 includes a lightweight **in-process event bus** at `src/runtime/events.ts`. It is not distributed — events fire within a single Worker invocation.

## Supported events

| Event | Typical payload |
|-------|-----------------|
| `PluginEnabled` | `{ plugin_id }` |
| `PluginDisabled` | `{ plugin_id }` |
| `PluginInstalled` | `{ snapshot }` |
| `PluginUninstalled` | `{ plugin_id }` |
| `ContentCreated` | `{ content_type, id }` |
| `ContentUpdated` | `{ content_type, id }` |
| `ContentDeleted` | `{ content_type, id }` |
| `MediaUploaded` | `{ media_id }` |
| `FormSubmitted` | `{ form_id, submission_id }` |
| `WorkflowChanged` | `{ entity_type, entity_id, state }` |
| `RevisionRestored` | `{ entity_type, entity_id, revision_id }` |

## Usage

```typescript
import { onRuntimeEvent, emitRuntimeEvent } from "./runtime/events";

onRuntimeEvent("PluginEnabled", (_event, payload) => {
  console.log("Enabled:", payload.plugin_id);
});

await emitRuntimeEvent("ContentCreated", {
  content_type: "page",
  id: "page_123",
});
```

## Design constraints

- Handlers run sequentially; errors are logged, not propagated
- No persistence or cross-request delivery
- Intended for internal core hooks and future plugin integration

## Hooks vs events

**Events** signal that something happened (past tense).

**Hooks** (`beforeCreate`, `afterUpdate`, etc.) are scaffolded interception points for future plugin code. See `src/runtime/hooks.ts`. Hooks are not executed in Phase 9.
