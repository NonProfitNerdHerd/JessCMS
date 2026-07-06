import { PLUGIN_MANIFESTS } from "../foundation/registry";
import { CORE_MANIFEST } from "./core-manifest";
import { CORE_PLUGIN_ID, JESSCMS_VERSION, PLUGIN_KIND_ORDER } from "./constants";
import type { PluginManifest, PluginKind, RegisteredPlugin } from "./types";
import { blockRegistry } from "./block-registry";
import { contentTypeRegistry } from "./content-type-registry";
import { navigationRegistry } from "./navigation-registry";
import { permissionRegistry } from "./permission-registry";
import { pluginRegistry } from "./plugin-registry";
import { routeRegistry } from "./route-registry";
import { schedulerRegistry } from "./scheduler-registry";
import { settingsRegistry } from "./settings-registry";
import { widgetRegistry } from "./widget-registry";
import { BLOCK_TYPES } from "../foundation/registry";
import {
  normalizeAdminBase,
  normalizeRouteBase,
} from "../foundation/manifest-validation";
import { compareVersions } from "./version";

export function getAllManifestSources(): PluginManifest[] {
  return [CORE_MANIFEST, ...PLUGIN_MANIFESTS];
}

export function resolvePluginEnabled(
  manifest: PluginManifest,
  dbEnabled: Map<string, boolean>,
): boolean {
  if (manifest.id === CORE_PLUGIN_ID) return true;
  if (dbEnabled.has(manifest.id)) return dbEnabled.get(manifest.id)!;
  return manifest.enabled;
}

function resolveKind(manifest: PluginManifest): PluginKind {
  if (manifest.id === CORE_PLUGIN_ID) return "core";
  return manifest.kind ?? "plugin";
}

function missingDependencies(
  manifest: PluginManifest,
  installedIds: Set<string>,
  enabledIds: Set<string>,
): { required: string[]; optional: string[] } {
  const required: string[] = [];
  const optional: string[] = [];

  for (const dep of manifest.dependencies ?? []) {
    if (!installedIds.has(dep.plugin_id)) {
      required.push(dep.plugin_id);
    } else if (!enabledIds.has(dep.plugin_id)) {
      required.push(`${dep.plugin_id} (disabled)`);
    }
  }

  for (const dep of manifest.optional_dependencies ?? []) {
    if (!installedIds.has(dep.plugin_id)) {
      optional.push(dep.plugin_id);
    }
  }

  return { required, optional };
}

export function sortManifestsForLoad(manifests: PluginManifest[]): PluginManifest[] {
  const byId = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: PluginManifest[] = [];

  function visit(id: string): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) return;
    visiting.add(id);
    const manifest = byId.get(id);
    for (const dep of manifest?.dependencies ?? []) {
      if (byId.has(dep.plugin_id)) visit(dep.plugin_id);
    }
    visiting.delete(id);
    visited.add(id);
    if (manifest) ordered.push(manifest);
  }

  const sorted = [...manifests].sort((a, b) => {
    const kindA = PLUGIN_KIND_ORDER.indexOf(resolveKind(a));
    const kindB = PLUGIN_KIND_ORDER.indexOf(resolveKind(b));
    if (kindA !== kindB) return kindA - kindB;
    return a.name.localeCompare(b.name);
  });

  for (const manifest of sorted) {
    visit(manifest.id);
  }

  return ordered;
}

function routeKey(method: string, path: string, type: string): string {
  return `${method.toUpperCase()} ${type} ${path}`;
}

function registerPluginEntry(
  manifest: PluginManifest,
  enabled: boolean,
  resourceCount: number,
): RegisteredPlugin {
  const kind = resolveKind(manifest);
  const installedIds = new Set(getAllManifestSources().map((m) => m.id));
  const enabledIds = new Set(
    [...pluginRegistry.getAll()]
      .filter((plugin) => plugin.enabled)
      .map((plugin) => plugin.manifest.id),
  );
  if (enabled) enabledIds.add(manifest.id);

  const deps = missingDependencies(manifest, installedIds, enabledIds);

  const entry: RegisteredPlugin = {
    manifest,
    enabled,
    lifecycle_state: enabled ? "enabled" : "disabled",
    kind,
    missing_dependencies: deps.required,
    optional_missing: deps.optional,
    needs_migration: false,
    upgrade_available: false,
    resource_count: resourceCount,
  };

  pluginRegistry.register(entry, manifest.id);
  return entry;
}

function registerManifestContributions(manifest: PluginManifest, enabled: boolean): void {
  if (!enabled) return;

  for (const block of manifest.blocks ?? []) {
    if (BLOCK_TYPES.some((coreBlock) => coreBlock.type === block.type)) {
      continue;
    }
    blockRegistry.register(
      {
        type: block.type,
        label: block.label,
        category: block.category,
        source: manifest.id,
        plugin_id: manifest.id,
        enabled: true,
        block_type: block.block_type,
      },
      manifest.id,
    );
  }


  for (const ct of manifest.content_types ?? []) {
    contentTypeRegistry.register(
      {
        ...ct,
        key: ct.type_key,
        plugin_id: manifest.id,
        source: ct.source ?? (manifest.id === CORE_PLUGIN_ID ? "core" : "plugin"),
        enabled: ct.enabled ?? true,
      },
      manifest.id,
    );
  }

  for (const permission of manifest.permissions ?? []) {
    permissionRegistry.register(
      {
        slug: permission,
        name: permission.replace(/[:.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        plugin_id: manifest.id,
      },
      manifest.id,
    );
  }

  const adminPages = manifest.admin_pages ?? manifest.admin_routes ?? [];
  for (const page of adminPages) {
    const path = `/admin${page.path.startsWith("/") ? page.path : `/${page.path}`}`;
    routeRegistry.register(
      {
        key: routeKey("GET", path, "admin"),
        method: "GET",
        path,
        type: "admin",
        plugin_id: manifest.id,
        permission: page.permission ?? null,
      },
      manifest.id,
    );

    navigationRegistry.register(
      {
        key: `${manifest.id}:admin:${path}`,
        label: page.label,
        href: path,
        icon: page.icon ?? "📄",
        plugin_id: manifest.id,
        permission: page.permission ?? null,
        sort_order: page.sort_order ?? 100,
      },
      manifest.id,
    );
  }

  for (const route of manifest.routes ?? []) {
    const method = (route.method ?? "GET").toUpperCase();
    const type = route.type ?? "api";
    routeRegistry.register(
      {
        key: routeKey(method, route.path, type),
        method,
        path: route.path,
        type,
        plugin_id: manifest.id,
        handler: route.handler,
        permission: route.permission ?? null,
      },
      manifest.id,
    );
  }

  for (const route of manifest.api_routes ?? []) {
    routeRegistry.register(
      {
        key: routeKey(route.method.toUpperCase(), route.path, "api"),
        method: route.method.toUpperCase(),
        path: route.path,
        type: "api",
        plugin_id: manifest.id,
        handler: route.handler,
        permission: null,
      },
      manifest.id,
    );
  }

  for (const ct of manifest.content_types ?? []) {
    if (ct.route_base) {
      const base = normalizeRouteBase(ct.route_base);
      routeRegistry.register(
        {
          key: routeKey("GET", `${base}/*`, "public"),
          method: "GET",
          path: `${base}/*`,
          type: "public",
          plugin_id: manifest.id,
        },
        manifest.id,
      );
    }
    if (ct.admin_base) {
      navigationRegistry.register(
        {
          key: `${manifest.id}:ct:${ct.type_key}`,
          label: ct.plural_label,
          href: ct.admin_base,
          icon: ct.icon ?? "📄",
          plugin_id: manifest.id,
          sort_order: 100,
        },
        manifest.id,
      );
    }
  }

  for (const item of manifest.navigation?.items ?? []) {
    navigationRegistry.register(
      {
        key: `${manifest.id}:nav:${item.href}`,
        label: item.label,
        href: item.href,
        icon: item.icon ?? "📄",
        plugin_id: manifest.id,
        section_id: item.section_id,
        permission: item.permission ?? null,
        sort_order: item.sort_order ?? 100,
      },
      manifest.id,
    );
  }

  for (const page of manifest.settings_pages ?? []) {
    settingsRegistry.register(
      {
        key: `${manifest.id}:settings:${page.slug}`,
        slug: page.slug,
        label: page.label,
        icon: page.icon,
        plugin_id: manifest.id,
        permission: page.permission ?? null,
        schema: page.schema,
      },
      manifest.id,
    );

    if (!settingsRegistry.exists(`${manifest.id}:settings:${page.slug}`)) {
      // already registered above
    }

    const settingsPath = `/admin/settings/${page.slug}`;
    navigationRegistry.register(
      {
        key: `${manifest.id}:settings-nav:${page.slug}`,
        label: page.label,
        href: settingsPath,
        icon: page.icon ?? "⚙",
        plugin_id: manifest.id,
        permission: page.permission ?? "settings:read",
        sort_order: 200,
      },
      manifest.id,
    );
  }

  if (manifest.settings_schema && !manifest.settings_pages?.length) {
    settingsRegistry.register(
      {
        key: `${manifest.id}:settings:default`,
        slug: manifest.id,
        label: manifest.name,
        plugin_id: manifest.id,
        permission: "settings:read",
        schema: manifest.settings_schema,
      },
      manifest.id,
    );
  }

  for (const job of manifest.scheduled_jobs ?? []) {
    schedulerRegistry.register(job, manifest.id);
  }

  for (const widget of manifest.widgets ?? []) {
    widgetRegistry.register({ ...widget, plugin_id: manifest.id }, manifest.id);
  }
}

export function registerCoreBlockCatalog(): void {
  for (const block of BLOCK_TYPES) {
    const sourcePluginId =
      block.source === "core" ? CORE_PLUGIN_ID : String(block.source);
    const sourcePlugin = pluginRegistry.get(sourcePluginId);
    const sourceEnabled =
      sourcePluginId === CORE_PLUGIN_ID || sourcePlugin?.enabled === true;

    if (!sourceEnabled) continue;
    if (blockRegistry.exists(block.type)) continue;

    blockRegistry.register(
      {
        type: block.type,
        label: block.label,
        category: block.category,
        source: block.source,
        plugin_id: sourcePluginId,
        enabled: true,
        props_schema: block.props_schema as Record<string, unknown>,
      },
      CORE_PLUGIN_ID,
    );
  }
}

export function clearAllRegistries(): void {
  pluginRegistry.clear();
  blockRegistry.clear();
  contentTypeRegistry.clear();
  permissionRegistry.clear();
  routeRegistry.clear();
  settingsRegistry.clear();
  navigationRegistry.clear();
  schedulerRegistry.clear();
  widgetRegistry.clear();
}

export interface LoadRuntimeOptions {
  dbEnabled?: Map<string, boolean>;
  resourceCounts?: Map<string, number>;
}

export function loadRuntimeFromManifests(
  manifests: PluginManifest[],
  options: LoadRuntimeOptions = {},
): RegisteredPlugin[] {
  clearAllRegistries();

  const dbEnabled = options.dbEnabled ?? new Map<string, boolean>();
  const resourceCounts = options.resourceCounts ?? new Map<string, number>();
  const ordered = sortManifestsForLoad(manifests);
  const loaded: RegisteredPlugin[] = [];

  for (const manifest of ordered) {
    const enabled = resolvePluginEnabled(manifest, dbEnabled);
    registerPluginEntry(manifest, enabled, resourceCounts.get(manifest.id) ?? 0);
  }

  for (const manifest of ordered) {
    const enabled = resolvePluginEnabled(manifest, dbEnabled);
    registerManifestContributions(manifest, enabled);
    loaded.push(pluginRegistry.get(manifest.id)!);
  }

  registerCoreBlockCatalog();

  return loaded;
}

export async function loadDbPluginState(env: Env): Promise<Map<string, boolean>> {
  const result = await env.DB.prepare(
    "SELECT id, enabled FROM plugins",
  ).all<{ id: string; enabled: number }>();

  return new Map(
    (result.results ?? []).map((row) => [row.id, row.enabled === 1]),
  );
}

export async function loadDbResourceCounts(env: Env): Promise<Map<string, number>> {
  const result = await env.DB.prepare(
    "SELECT plugin_id, COUNT(*) AS count FROM plugin_resources GROUP BY plugin_id",
  ).all<{ plugin_id: string; count: number }>();

  return new Map(
    (result.results ?? []).map((row) => [row.plugin_id, row.count]),
  );
}

export function getRegisteredBlocksFromRuntime() {
  const pluginBlocks = blockRegistry.getAll();
  const coreBlocks = pluginBlocks.filter((b) => b.plugin_id === CORE_PLUGIN_ID);
  const fromPlugins = pluginBlocks.filter((b) => b.plugin_id !== CORE_PLUGIN_ID);

  return {
    core: coreBlocks,
    from_plugins: fromPlugins,
    all: pluginBlocks,
  };
}

export function validateMinimumVersion(manifest: PluginManifest): string | null {
  if (!manifest.minimum_jesscms_version) return null;
  if (compareVersions(JESSCMS_VERSION, manifest.minimum_jesscms_version) < 0) {
    return `${manifest.id}: requires JessCMS ${manifest.minimum_jesscms_version}, running ${JESSCMS_VERSION}`;
  }
  return null;
}
