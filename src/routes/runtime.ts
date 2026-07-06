import { isAuthUser, requirePermission } from "../auth";
import { ok } from "../lib/response";
import {
  getRuntime,
  refreshRuntime,
  syncRuntimeToDatabase,
} from "../runtime/sync";

export async function handleRuntimePlugins(env: Env): Promise<Response> {
  const snapshot = await getRuntime(env);
  return ok({
    items: snapshot.plugins,
    count: snapshot.plugins.length,
    errors: snapshot.errors,
    loaded_at: snapshot.loaded_at,
  });
}

export async function handleRuntimeContentTypes(env: Env): Promise<Response> {
  const snapshot = await getRuntime(env);
  return ok({ items: snapshot.content_types, count: snapshot.content_types.length });
}

export async function handleRuntimeBlocks(env: Env): Promise<Response> {
  const snapshot = await getRuntime(env);
  return ok({
    items: snapshot.blocks,
    count: snapshot.blocks.length,
    core: snapshot.blocks.filter((block) => block.plugin_id === "jesscms-core"),
    from_plugins: snapshot.blocks.filter((block) => block.plugin_id !== "jesscms-core"),
  });
}

export async function handleRuntimeRoutes(env: Env): Promise<Response> {
  const snapshot = await getRuntime(env);
  return ok({ items: snapshot.routes, count: snapshot.routes.length });
}

export async function handleRuntimeNavigation(env: Env): Promise<Response> {
  const snapshot = await getRuntime(env);
  return ok({ items: snapshot.navigation, count: snapshot.navigation.length });
}

export async function handleRuntimeSettings(env: Env): Promise<Response> {
  const snapshot = await getRuntime(env);
  return ok({ items: snapshot.settings_pages, count: snapshot.settings_pages.length });
}

export async function handleRuntimePermissions(env: Env): Promise<Response> {
  const snapshot = await getRuntime(env);
  return ok({ items: snapshot.permissions, count: snapshot.permissions.length });
}

export async function handleRuntimeRefresh(
  request: Request,
  env: Env,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "plugins:update");
  if (!isAuthUser(authResult)) return authResult;

  const snapshot = await refreshRuntime(env);
  return ok({ refreshed: true, loaded_at: snapshot.loaded_at, errors: snapshot.errors });
}

export async function handleRuntimeSync(
  request: Request,
  env: Env,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "plugins:update");
  if (!isAuthUser(authResult)) return authResult;

  const snapshot = await syncRuntimeToDatabase(env);
  return ok({
    synced: true,
    plugins: snapshot.plugins.length,
    content_types: snapshot.content_types.length,
    permissions: snapshot.permissions.length,
    errors: snapshot.errors,
  });
}
