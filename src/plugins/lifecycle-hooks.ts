import type {
  PluginLifecycle,
  PluginLifecycleHookContext,
  PluginManifest,
} from "../foundation/types";

const lifecycleRegistry = new Map<string, PluginLifecycle>();

export function registerPluginLifecycle(
  pluginId: string,
  hooks: PluginLifecycle,
): void {
  lifecycleRegistry.set(pluginId, hooks);
}

export function getPluginLifecycle(pluginId: string): PluginLifecycle | undefined {
  return lifecycleRegistry.get(pluginId);
}

async function runHook(
  pluginId: string,
  hookName: keyof PluginLifecycle,
  ctx: PluginLifecycleHookContext,
  extra?: Record<string, unknown>,
): Promise<void> {
  const hooks = lifecycleRegistry.get(pluginId);
  const hook = hooks?.[hookName];
  if (!hook) return;

  try {
    await (hook as (context: PluginLifecycleHookContext & Record<string, unknown>) => Promise<void>)({
      ...ctx,
      ...extra,
    });
  } catch (error) {
    console.error(`Plugin lifecycle hook failed (${pluginId}.${String(hookName)})`, error);
  }
}

export async function runInstallHook(
  db: D1Database,
  manifest: PluginManifest,
): Promise<void> {
  await runHook(manifest.id, "install", { pluginId: manifest.id, db, manifest });
}

export async function runEnableHook(
  db: D1Database,
  manifest: PluginManifest,
): Promise<void> {
  await runHook(manifest.id, "enable", { pluginId: manifest.id, db, manifest });
}

export async function runDisableHook(
  db: D1Database,
  manifest: PluginManifest,
): Promise<void> {
  await runHook(manifest.id, "disable", { pluginId: manifest.id, db, manifest });
}

export async function runUninstallHook(
  db: D1Database,
  manifest: PluginManifest,
): Promise<void> {
  await runHook(manifest.id, "uninstall", { pluginId: manifest.id, db, manifest });
}

export async function runMigrateHook(
  db: D1Database,
  manifest: PluginManifest,
  fromVersion: string,
  toVersion: string,
): Promise<void> {
  await runHook(
    manifest.id,
    "migrate",
    { pluginId: manifest.id, db, manifest },
    { fromVersion, toVersion },
  );
}

export async function runRollbackHook(
  db: D1Database,
  manifest: PluginManifest,
  fromVersion: string,
  toVersion: string,
): Promise<void> {
  await runHook(
    manifest.id,
    "rollback",
    { pluginId: manifest.id, db, manifest },
    { fromVersion, toVersion },
  );
}
