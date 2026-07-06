import { isAuthUser, requirePermission } from "../auth";
import { getClientIp, writeAuditLog } from "../db/audit";
import {
  PLUGIN_MANIFESTS,
  type PluginManifest,
} from "../foundation/registry";
import {
  badRequest,
  notFound,
  ok,
} from "../lib/response";

export interface DbPlugin {
  id: string;
  name: string;
  version: string;
  enabled: number;
  manifest_json: string;
}

export async function syncPluginsToDatabase(env: Env): Promise<void> {
  const statements = PLUGIN_MANIFESTS.map((manifest) =>
    env.DB.prepare(
      `
        INSERT INTO plugins (id, name, version, enabled, manifest_json, installed_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          version = excluded.version,
          manifest_json = excluded.manifest_json,
          updated_at = datetime('now')
      `,
    ).bind(
      manifest.id,
      manifest.name,
      manifest.version,
      manifest.enabled ? 1 : 0,
      JSON.stringify(manifest),
    ),
  );

  await env.DB.batch(statements);
}

function mergePlugin(manifest: PluginManifest, row?: DbPlugin) {
  const enabled = row ? row.enabled === 1 : manifest.enabled;

  return {
    ...manifest,
    enabled,
    source: row ? "database" : "manifest",
  };
}

export async function listPluginsFromDatabase(env: Env) {
  await syncPluginsToDatabase(env);

  const rows = await env.DB.prepare(
    "SELECT id, name, version, enabled, manifest_json FROM plugins ORDER BY name",
  ).all<DbPlugin>();

  const byId = new Map((rows.results ?? []).map((row) => [row.id, row]));

  return PLUGIN_MANIFESTS.map((manifest) =>
    mergePlugin(manifest, byId.get(manifest.id)),
  );
}

export async function handlePlugins(env: Env): Promise<Response> {
  const items = await listPluginsFromDatabase(env);

  return ok({
    items,
    enabled: items.filter((plugin) => plugin.enabled),
    count: items.length,
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

  const manifest = PLUGIN_MANIFESTS.find((plugin) => plugin.id === params.id);
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

  await env.DB.prepare(
    `
      UPDATE plugins
      SET enabled = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
  )
    .bind(body.enabled ? 1 : 0, params.id)
    .run();

  await writeAuditLog(env.DB, {
    actorId: authResult.id,
    action: "update",
    entityType: "plugin",
    entityId: params.id,
    metadata: { enabled: body.enabled },
    ipAddress: getClientIp(request),
  });

  const items = await listPluginsFromDatabase(env);
  const plugin = items.find((item) => item.id === params.id);

  return ok({ plugin });
}
