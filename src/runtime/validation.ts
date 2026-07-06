import { compareVersions } from "./version";
import type { PluginManifest } from "./types";
import { JESSCMS_VERSION } from "./constants";
import {
  normalizeAdminBase,
  normalizeRouteBase,
} from "../foundation/manifest-validation";

export class RuntimeValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message);
  }
}

function routeKey(method: string, path: string, type: string): string {
  return `${method.toUpperCase()} ${type} ${path}`;
}

export function validateRuntimeManifests(
  manifests: PluginManifest[],
  enabledIds: Set<string>,
): string[] {
  const errors: string[] = [];
  const pluginIds = new Set<string>();
  const contentTypes = new Set<string>();
  const blockTypes = new Set<string>();
  const permissions = new Set<string>();
  const routeKeys = new Set<string>();
  const adminPaths = new Set<string>();

  for (const manifest of manifests) {
    if (pluginIds.has(manifest.id)) {
      errors.push(`Duplicate plugin ID: ${manifest.id}`);
    }
    pluginIds.add(manifest.id);

    if (!manifest.name?.trim()) errors.push(`${manifest.id}: name is required`);
    if (!manifest.version?.trim()) errors.push(`${manifest.id}: version is required`);

    if (manifest.minimum_jesscms_version) {
      if (compareVersions(JESSCMS_VERSION, manifest.minimum_jesscms_version) < 0) {
        errors.push(
          `${manifest.id}: requires JessCMS ${manifest.minimum_jesscms_version}, running ${JESSCMS_VERSION}`,
        );
      }
    }

    for (const dep of manifest.dependencies ?? []) {
      if (!pluginIds.has(dep.plugin_id) && !manifests.some((m) => m.id === dep.plugin_id)) {
        // checked later after all ids collected
      }
    }
  }

  for (const manifest of manifests) {
    for (const dep of manifest.dependencies ?? []) {
      const depManifest = manifests.find((m) => m.id === dep.plugin_id);
      if (!depManifest) {
        errors.push(`${manifest.id}: missing required dependency ${dep.plugin_id}`);
        continue;
      }
      if (!enabledIds.has(dep.plugin_id) && enabledIds.has(manifest.id)) {
        errors.push(`${manifest.id}: required dependency ${dep.plugin_id} is disabled`);
      }
      if (dep.version && depManifest.version !== dep.version) {
        errors.push(
          `${manifest.id}: dependency ${dep.plugin_id} version mismatch (need ${dep.version}, have ${depManifest.version})`,
        );
      }
    }

    for (const dep of manifest.optional_dependencies ?? []) {
      if (!manifests.some((m) => m.id === dep.plugin_id)) {
        errors.push(`${manifest.id}: optional dependency ${dep.plugin_id} not installed`);
      }
    }

    if (detectCircularDependencies(manifest.id, manifests)) {
      errors.push(`${manifest.id}: circular dependency detected`);
    }

    for (const ct of manifest.content_types ?? []) {
      if (contentTypes.has(ct.type_key)) {
        errors.push(`Duplicate content type: ${ct.type_key}`);
      }
      contentTypes.add(ct.type_key);
      if (ct.route_base) {
        const base = normalizeRouteBase(ct.route_base);
        const route = routeKey("GET", `${base}/*`, "public");
        if (routeKeys.has(route)) errors.push(`Duplicate route base: ${base}`);
      }
      if (ct.admin_base) {
        const base = normalizeAdminBase(ct.admin_base);
        if (adminPaths.has(base)) errors.push(`Duplicate admin route: ${base}`);
        adminPaths.add(base);
      }
    }

    for (const block of manifest.blocks ?? []) {
      if (blockTypes.has(block.type)) {
        errors.push(`Duplicate block type: ${block.type}`);
      }
      blockTypes.add(block.type);
    }

    for (const permission of manifest.permissions ?? []) {
      if (permissions.has(permission)) {
        errors.push(`Duplicate permission: ${permission}`);
      }
      permissions.add(permission);
    }

    const adminPages = manifest.admin_pages ?? manifest.admin_routes ?? [];
    for (const page of adminPages) {
      const base = normalizeAdminBase(
        `/admin${page.path.startsWith("/") ? page.path : `/${page.path}`}`,
      );
      if (adminPaths.has(base)) {
        errors.push(`Duplicate admin route: ${base}`);
      }
      adminPaths.add(base);
    }

    for (const route of manifest.routes ?? []) {
      const method = (route.method ?? "GET").toUpperCase();
      const type = route.type ?? "api";
      const key = routeKey(method, route.path, type);
      if (routeKeys.has(key)) errors.push(`Duplicate route: ${key}`);
      routeKeys.add(key);
    }

    for (const route of manifest.api_routes ?? []) {
      const key = routeKey(route.method.toUpperCase(), route.path, "api");
      if (routeKeys.has(key)) errors.push(`Duplicate API route: ${key}`);
      routeKeys.add(key);
    }
  }

  return errors;
}

function detectCircularDependencies(
  startId: string,
  manifests: PluginManifest[],
): boolean {
  const byId = new Map(manifests.map((m) => [m.id, m]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const manifest = byId.get(id);
    for (const dep of manifest?.dependencies ?? []) {
      if (dfs(dep.plugin_id)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  return dfs(startId);
}

export function assertRuntimeManifestsValid(
  manifests: PluginManifest[],
  enabledIds: Set<string>,
): void {
  const errors = validateRuntimeManifests(manifests, enabledIds);
  if (errors.length > 0) {
    throw new RuntimeValidationError("Runtime manifest validation failed", errors);
  }
}
