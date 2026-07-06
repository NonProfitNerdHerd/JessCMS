import type { RuntimeHookHandler, RuntimeHookName } from "./types";

const hookHandlers: RuntimeHookHandler[] = [];

export function registerRuntimeHook(
  pluginId: string,
  hook: RuntimeHookName,
  handlerId: string,
): void {
  hookHandlers.push({ pluginId, hook, handlerId });
}

export function unregisterPluginHooks(pluginId: string): void {
  for (let index = hookHandlers.length - 1; index >= 0; index -= 1) {
    if (hookHandlers[index].pluginId === pluginId) {
      hookHandlers.splice(index, 1);
    }
  }
}

export function getRuntimeHooks(hook?: RuntimeHookName): RuntimeHookHandler[] {
  if (!hook) return [...hookHandlers];
  return hookHandlers.filter((entry) => entry.hook === hook);
}

export function clearRuntimeHooks(): void {
  hookHandlers.length = 0;
}

export function listRuntimeHookNames(): RuntimeHookName[] {
  return [
    "beforeCreate",
    "afterCreate",
    "beforeUpdate",
    "afterUpdate",
    "beforeDelete",
    "afterDelete",
    "beforeRender",
    "afterRender",
  ];
}

/**
 * Scaffold only — hooks are registered as metadata and not executed yet.
 */
export async function dispatchRuntimeHook(
  hook: RuntimeHookName,
  _context: Record<string, unknown>,
): Promise<void> {
  void hook;
  void getRuntimeHooks(hook);
}
