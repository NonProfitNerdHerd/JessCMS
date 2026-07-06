import { findPluginManifest, syncPluginsToDatabase } from "../plugins/database-sync";
import { listPluginResources } from "../plugins/resources";
import {
  clearAllRegistries,
  getAllManifestSources,
  loadDbPluginState,
  loadDbResourceCounts,
  loadRuntimeFromManifests,
} from "./plugin-loader";
import { validateRuntimeManifests } from "./validation";
import { blockRegistry } from "./block-registry";
import { contentTypeRegistry } from "./content-type-registry";
import { navigationRegistry } from "./navigation-registry";
import { permissionRegistry } from "./permission-registry";
import { pluginRegistry } from "./plugin-registry";
import { routeRegistry } from "./route-registry";
import { settingsRegistry } from "./settings-registry";
import { schedulerRegistry } from "./scheduler-registry";
import { widgetRegistry } from "./widget-registry";
import { CORE_PLUGIN_ID, JESSCMS_VERSION } from "./constants";
import type { RuntimeSnapshot } from "./types";
import { emitRuntimeEvent } from "./events";

let cachedSnapshot: RuntimeSnapshot | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5_000;

function buildSnapshot(errors: string[] = []): RuntimeSnapshot {
  return {
    version: JESSCMS_VERSION,
    loaded_at: new Date().toISOString(),
    plugins: pluginRegistry.getAll(),
    content_types: contentTypeRegistry.getAll(),
    blocks: blockRegistry.getAll(),
    routes: routeRegistry.getAll(),
    permissions: permissionRegistry.getAll(),
    navigation: navigationRegistry.sorted(),
    settings_pages: settingsRegistry.getAll(),
    schedulers: schedulerRegistry.getAll(),
    notifications: [],
    widgets: widgetRegistry.getAll(),
    errors,
  };
}

export async function refreshRuntime(env: Env): Promise<RuntimeSnapshot> {
  cachedSnapshot = null;
  return getRuntime(env, { force: true });
}

export async function getRuntime(
  env: Env,
  options: { force?: boolean; validate?: boolean } = {},
): Promise<RuntimeSnapshot> {
  const now = Date.now();
  if (!options.force && cachedSnapshot && now - cachedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  const [dbEnabled, resourceCounts] = await Promise.all([
    loadDbPluginState(env),
    loadDbResourceCounts(env),
  ]);

  await syncPluginsToDatabase(env);

  const manifests = getAllManifestSources();
  const enabledIds = new Set(
    manifests
      .filter((manifest) => {
        if (manifest.id === "jesscms-core") return true;
        return dbEnabled.has(manifest.id) ? dbEnabled.get(manifest.id)! : manifest.enabled;
      })
      .map((manifest) => manifest.id),
  );

  const errors = options.validate === false
    ? []
    : validateRuntimeManifests(manifests, enabledIds);

  loadRuntimeFromManifests(manifests, { dbEnabled, resourceCounts });

  cachedSnapshot = buildSnapshot(errors);
  cachedAt = now;
  return cachedSnapshot;
}

export async function syncRuntimeToDatabase(env: Env): Promise<RuntimeSnapshot> {
  const snapshot = await refreshRuntime(env);

  for (const plugin of getAllManifestSources()) {
    if (plugin.id === "jesscms-core") continue;

    await env.DB.prepare(
      `
        INSERT INTO plugins (id, name, version, enabled, manifest_json, lifecycle_state, installed_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          version = excluded.version,
          manifest_json = excluded.manifest_json,
          updated_at = datetime('now')
      `,
    )
      .bind(
        plugin.id,
        plugin.name,
        plugin.version,
        snapshot.plugins.find((p) => p.manifest.id === plugin.id)?.enabled ? 1 : 0,
        JSON.stringify(plugin),
        snapshot.plugins.find((p) => p.manifest.id === plugin.id)?.enabled
          ? "enabled"
          : "disabled",
      )
      .run();
  }

  for (const type of snapshot.content_types) {
    const id = `ct_${type.type_key}`;
    const pluginId =
      !type.plugin_id || type.plugin_id === CORE_PLUGIN_ID ? null : type.plugin_id;
    await env.DB.prepare(
      `
        INSERT INTO content_types (
          id, type_key, label, plural_label, description, source, plugin_id, enabled,
          supports_json, supports_html, supports_revisions, supports_workflow,
          supports_seo, supports_featured_image, supports_author, supports_parent,
          supports_archive, supports_public_routes, route_base, admin_base, icon,
          schema_json, settings_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(type_key) DO UPDATE SET
          label = excluded.label,
          plural_label = excluded.plural_label,
          description = excluded.description,
          source = excluded.source,
          plugin_id = excluded.plugin_id,
          enabled = excluded.enabled,
          supports_json = excluded.supports_json,
          supports_html = excluded.supports_html,
          supports_revisions = excluded.supports_revisions,
          supports_workflow = excluded.supports_workflow,
          supports_seo = excluded.supports_seo,
          supports_featured_image = excluded.supports_featured_image,
          supports_author = excluded.supports_author,
          supports_parent = excluded.supports_parent,
          supports_archive = excluded.supports_archive,
          supports_public_routes = excluded.supports_public_routes,
          route_base = excluded.route_base,
          admin_base = excluded.admin_base,
          icon = excluded.icon,
          schema_json = excluded.schema_json,
          settings_json = excluded.settings_json,
          updated_at = datetime('now')
      `,
    )
      .bind(
        id,
        type.type_key,
        type.label,
        type.plural_label,
        type.description ?? null,
        type.source ?? "plugin",
        pluginId,
        type.enabled === false ? 0 : 1,
        type.supports_json === false ? 0 : 1,
        type.supports_html === false ? 0 : 1,
        type.supports_revisions === false ? 0 : 1,
        type.supports_workflow === false ? 0 : 1,
        type.supports_seo === false ? 0 : 1,
        type.supports_featured_image ? 1 : 0,
        type.supports_author === false ? 0 : 1,
        type.supports_parent ? 1 : 0,
        type.supports_archive === false ? 0 : 1,
        type.supports_public_routes === false ? 0 : 1,
        type.route_base ?? null,
        type.admin_base ?? null,
        type.icon ?? null,
        type.schema_json ? JSON.stringify(type.schema_json) : null,
        type.settings_json ? JSON.stringify(type.settings_json) : null,
      )
      .run();
  }

  for (const plugin of snapshot.plugins) {
    if (plugin.enabled || plugin.manifest.id === CORE_PLUGIN_ID) continue;
    await env.DB.prepare(
      `
        UPDATE content_types
        SET enabled = 0, updated_at = datetime('now')
        WHERE plugin_id = ?
      `,
    )
      .bind(plugin.manifest.id)
      .run();
  }

  for (const permission of snapshot.permissions) {
    const id = `perm_${permission.slug.replace(/[^a-z0-9]+/gi, "_")}`;
    await env.DB.prepare(
      `
        INSERT OR IGNORE INTO permissions (id, slug, name, description)
        VALUES (?, ?, ?, ?)
      `,
    )
      .bind(id, permission.slug, permission.name, permission.description ?? null)
      .run();
  }

  for (const manifest of getAllManifestSources()) {
    if (manifest.id === "jesscms-core") continue;
    for (const resource of manifest.resources ?? []) {
      const resourceId = `pr_${manifest.id}_${resource.resource_name}`.replace(/[^a-z0-9_]+/gi, "_");
      await env.DB.prepare(
        `
          INSERT OR IGNORE INTO plugin_resources (
            id, plugin_id, resource_type, resource_name, table_name,
            entity_id, ownership_type, cleanup_policy, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `,
      )
        .bind(
          resourceId,
          manifest.id,
          resource.resource_type,
          resource.resource_name,
          resource.table_name ?? null,
          resource.entity_id ?? null,
          resource.ownership_type ?? "owns",
          resource.cleanup_policy ?? "retain",
        )
        .run();
    }
  }

  await emitRuntimeEvent("PluginInstalled", { snapshot: snapshot.plugins.length });
  return snapshot;
}

export function invalidateRuntimeCache(): void {
  cachedSnapshot = null;
  cachedAt = 0;
  clearAllRegistries();
}

export async function getPluginRuntimeDetails(env: Env, pluginId: string) {
  const snapshot = await getRuntime(env);
  const plugin = snapshot.plugins.find((entry) => entry.manifest.id === pluginId);
  if (!plugin) return null;

  const resources = await listPluginResources(env.DB, pluginId);

  return {
    ...plugin,
    resources,
    registered_routes: snapshot.routes.filter((route) => route.plugin_id === pluginId),
    registered_blocks: snapshot.blocks.filter((block) => block.plugin_id === pluginId),
    registered_content_types: snapshot.content_types.filter(
      (type) => type.plugin_id === pluginId,
    ),
    registered_permissions: snapshot.permissions.filter(
      (permission) => permission.plugin_id === pluginId,
    ),
    registered_navigation: snapshot.navigation.filter(
      (item) => item.plugin_id === pluginId,
    ),
  };
}

