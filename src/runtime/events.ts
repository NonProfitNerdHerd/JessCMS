import type { RuntimeEventName, RuntimeEventPayload } from "./types";

export type RuntimeEventHandler = (
  event: RuntimeEventName,
  payload: RuntimeEventPayload,
) => void | Promise<void>;

const listeners = new Map<RuntimeEventName, Set<RuntimeEventHandler>>();

export function onRuntimeEvent(
  event: RuntimeEventName,
  handler: RuntimeEventHandler,
): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(handler);
  return () => listeners.get(event)?.delete(handler);
}

export async function emitRuntimeEvent(
  event: RuntimeEventName,
  payload: RuntimeEventPayload = {},
): Promise<void> {
  const handlers = listeners.get(event);
  if (!handlers) return;

  for (const handler of handlers) {
    try {
      await handler(event, payload);
    } catch (error) {
      console.error(`Runtime event handler failed (${event})`, error);
    }
  }
}

export function clearRuntimeEventListeners(): void {
  listeners.clear();
}

export function listRuntimeEventNames(): RuntimeEventName[] {
  return [
    "PluginEnabled",
    "PluginDisabled",
    "PluginInstalled",
    "PluginUninstalled",
    "ContentCreated",
    "ContentUpdated",
    "ContentDeleted",
    "MediaUploaded",
    "FormSubmitted",
    "WorkflowChanged",
    "RevisionRestored",
  ];
}
