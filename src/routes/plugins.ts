import { isAuthUser, requirePermission } from "../auth";
import { getClientIp, writeAuditLog } from "../db/audit";
import { ManifestValidationError } from "../foundation/manifest-validation";
import { PLUGIN_MANIFESTS } from "../foundation/registry";
import { findPluginManifest, syncPluginsToDatabase } from "../plugins/database-sync";
import type { DbPluginRecord, PluginManifest, UninstallMode } from "../foundation/types";
import {
  buildUninstallPreview,
  disablePlugin,
  enablePlugin,
  getDbPlugin,
  lifecycleStateLabel,
  PluginLifecycleError,
  uninstallPlugin,
} from "../plugins/lifecycle";
import { listPluginResources } from "../plugins/resources";
import {
  badRequest,
  notFound,
  ok,
} from "../lib/response";
import { emitRuntimeEvent } from "../runtime/events";
import { getRuntime, invalidateRuntimeCache } from "../runtime/sync";

export { syncPluginsToDatabase, findPluginManifest } from "../plugins/database-sync";

export interface DbPlugin {
  id: string;
  name: string;
  version: string;
  enabled: number;
  manifest_json: string;
  lifecycle_state?: string;
}

function mergePlugin(manifest: PluginManifest, row?: DbPluginRecord) {
  const enabled = row ? row.enabled === 1 : manifest.enabled;

  return {
    ...manifest,
    enabled,
    lifecycle_state: row?.lifecycle_state ?? (enabled ? "enabled" : "disabled"),
    lifecycle_state_label: lifecycleStateLabel(
      row?.lifecycle_state ?? (enabled ? "enabled" : "disabled"),
    ),
    installed_at: row?.installed_at ?? null,
    enabled_at: row?.enabled_at ?? null,
    disabled_at: row?.disabled_at ?? null,
    uninstalled_at: row?.uninstalled_at ?? null,
    source: row ? "database" : "manifest",
  };
}

export async function listPluginsFromDatabase(env: Env) {
  await syncPluginsToDatabase(env);

  const rows = await env.DB.prepare(
    `
      SELECT id, name, version, enabled, manifest_json, lifecycle_state,
             installed_at, enabled_at, disabled_at, uninstalled_at, updated_at
      FROM plugins ORDER BY name
    `,
  ).all<DbPluginRecord>();

  const byId = new Map((rows.results ?? []).map((row) => [row.id, row]));

  return PLUGIN_MANIFESTS.map((manifest) =>
    mergePlugin(manifest, byId.get(manifest.id)),
  );
}

function findManifest(id: string): PluginManifest | undefined {
  return findPluginManifest(id);
}

function handlePluginError(error: unknown): Response {
  if (error instanceof ManifestValidationError) {
    return badRequest(error.message, error.errors);
  }
  if (error instanceof PluginLifecycleError) {
    if (error.code === "not_found") return notFound(error.message);
    return badRequest(error.message);
  }
  console.error(error);
  return badRequest("Plugin operation failed");
}

export async function handlePlugins(env: Env): Promise<Response> {
  const items = await listPluginsFromDatabase(env);
  const snapshot = await getRuntime(env);

  const enriched = items.map((plugin) => {
    const runtime = snapshot.plugins.find((entry) => entry.manifest.id === plugin.id);
    return {
      ...plugin,
      installed: true,
      kind: runtime?.kind ?? "plugin",
      missing_dependencies: runtime?.missing_dependencies ?? [],
      optional_missing: runtime?.optional_missing ?? [],
      needs_migration: runtime?.needs_migration ?? false,
      upgrade_available: runtime?.upgrade_available ?? false,
      resource_count: runtime?.resource_count ?? 0,
      registered_routes: snapshot.routes.filter((route) => route.plugin_id === plugin.id).length,
      registered_blocks: snapshot.blocks.filter((block) => block.plugin_id === plugin.id).length,
      registered_content_types: snapshot.content_types.filter(
        (type) => type.plugin_id === plugin.id,
      ).length,
      registered_permissions: snapshot.permissions.filter(
        (permission) => permission.plugin_id === plugin.id,
      ).length,
    };
  });

  return ok({
    items: enriched,
    enabled: enriched.filter((plugin) => plugin.enabled),
    count: enriched.length,
    runtime_errors: snapshot.errors,
  });
}

export async function handleUpdatePlugin(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "plugins:update");
  if (!isAuthUser(authResult)) {
    return authResult;
  }

  const manifest = findManifest(params.id);
  if (!manifest) {
    return notFound("Plugin not found");
  }

  let body: { enabled?: boolean };
  try {
    body = (await request.json()) as { enabled?: boolean };
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (typeof body.enabled !== "boolean") {
    return badRequest("enabled must be a boolean");
  }

  await syncPluginsToDatabase(env);

  if (body.enabled) {
    await enablePlugin(request, env.DB, manifest, authResult.id);
  } else {
    await disablePlugin(request, env.DB, manifest, authResult.id);
  }

  const items = await listPluginsFromDatabase(env);
  const plugin = items.find((item) => item.id === params.id);

  return ok({ plugin });
}

export async function handleGetPluginResources(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "plugins:read");
  if (!isAuthUser(authResult)) return authResult;

  const manifest = findManifest(params.id);
  if (!manifest) return notFound("Plugin not found");

  const resources = await listPluginResources(env.DB, params.id);
  return ok({ plugin_id: params.id, resources, count: resources.length });
}

export async function handleEnablePlugin(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const authResult = await requirePermission(request, env, "plugins:update");
    if (!isAuthUser(authResult)) return authResult;

    const manifest = findManifest(params.id);
    if (!manifest) return notFound("Plugin not found");

    await syncPluginsToDatabase(env);
    const plugin = await enablePlugin(request, env.DB, manifest, authResult.id);
    invalidateRuntimeCache();
    await emitRuntimeEvent("PluginEnabled", { plugin_id: manifest.id });
    return ok({ plugin });
  } catch (error) {
    return handlePluginError(error);
  }
}

export async function handleDisablePlugin(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const authResult = await requirePermission(request, env, "plugins:update");
    if (!isAuthUser(authResult)) return authResult;

    const manifest = findManifest(params.id);
    if (!manifest) return notFound("Plugin not found");

    const plugin = await disablePlugin(request, env.DB, manifest, authResult.id);
    invalidateRuntimeCache();
    await emitRuntimeEvent("PluginDisabled", { plugin_id: manifest.id });
    return ok({ plugin });
  } catch (error) {
    return handlePluginError(error);
  }
}

export async function handleUninstallPreview(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "plugins:update");
  if (!isAuthUser(authResult)) return authResult;

  const manifest = findManifest(params.id);
  if (!manifest) return notFound("Plugin not found");

  await syncPluginsToDatabase(env);
  const preview = await buildUninstallPreview(env.DB, manifest);
  return ok(preview);
}

export async function handleUninstallPlugin(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const authResult = await requirePermission(request, env, "plugins:update");
    if (!isAuthUser(authResult)) return authResult;

    const manifest = findManifest(params.id);
    if (!manifest) return notFound("Plugin not found");

    let body: { mode?: UninstallMode };
    try {
      body = (await request.json()) as { mode?: UninstallMode };
    } catch {
      return badRequest("Invalid JSON body");
    }

    const allowed: UninstallMode[] = [
      "disable_only",
      "uninstall_retain",
      "uninstall_archive",
      "uninstall_delete",
    ];
    if (!body.mode || !allowed.includes(body.mode)) {
      return badRequest("mode must be one of: " + allowed.join(", "));
    }

    await syncPluginsToDatabase(env);
    const result = await uninstallPlugin(
      request,
      env.DB,
      manifest,
      authResult.id,
      body.mode,
    );

    return ok(result);
  } catch (error) {
    return handlePluginError(error);
  }
}
