import type { PluginManifest } from "./types";
import { PLUGIN_MANIFESTS } from "./registry";

export class ManifestValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message);
  }
}

export interface ManifestValidationContext {
  existingPluginIds?: string[];
  existingContentTypeKeys?: string[];
  existingRouteBases?: string[];
  existingAdminBases?: string[];
  existingBlockTypes?: string[];
}

function collectFromManifests(manifests: PluginManifest[]) {
  const pluginIds = new Set<string>();
  const contentTypeKeys = new Set<string>();
  const routeBases = new Set<string>();
  const adminBases = new Set<string>();
  const blockTypes = new Set<string>();

  for (const manifest of manifests) {
    if (pluginIds.has(manifest.id)) {
      throw new ManifestValidationError("Duplicate plugin manifest", [
        `Duplicate plugin ID: ${manifest.id}`,
      ]);
    }
    pluginIds.add(manifest.id);

    for (const ct of manifest.content_types ?? []) {
      if (contentTypeKeys.has(ct.type_key)) {
        throw new ManifestValidationError("Duplicate content type key", [
          `Duplicate content type key: ${ct.type_key}`,
        ]);
      }
      contentTypeKeys.add(ct.type_key);

      if (ct.route_base) {
        const base = normalizeRouteBase(ct.route_base);
        if (routeBases.has(base)) {
          throw new ManifestValidationError("Duplicate route base", [
            `Duplicate route base: ${base}`,
          ]);
        }
        routeBases.add(base);
      }

      if (ct.admin_base) {
        const base = normalizeAdminBase(ct.admin_base);
        if (adminBases.has(base)) {
          throw new ManifestValidationError("Duplicate admin base", [
            `Duplicate admin route base: ${base}`,
          ]);
        }
        adminBases.add(base);
      }
    }

    for (const route of manifest.admin_routes ?? []) {
      const base = normalizeAdminBase(`/admin${route.path.startsWith("/") ? route.path : `/${route.path}`}`);
      if (adminBases.has(base)) {
        throw new ManifestValidationError("Duplicate admin route base", [
          `Duplicate admin route base: ${base}`,
        ]);
      }
      adminBases.add(base);
    }

    for (const block of manifest.blocks ?? []) {
      if (blockTypes.has(block.type)) {
        throw new ManifestValidationError("Duplicate block type", [
          `Duplicate block type key: ${block.type}`,
        ]);
      }
      blockTypes.add(block.type);
    }
  }

  return { pluginIds, contentTypeKeys, routeBases, adminBases, blockTypes };
}

export function normalizeRouteBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function normalizeAdminBase(value: string): string {
  return value.trim().replace(/\/+$/, "") || "/admin";
}

export function validatePluginManifest(
  manifest: PluginManifest,
  context: ManifestValidationContext = {},
): void {
  const errors: string[] = [];

  if (!manifest.id?.trim()) errors.push("Plugin id is required");
  if (!manifest.name?.trim()) errors.push("Plugin name is required");
  if (!manifest.version?.trim()) errors.push("Plugin version is required");

  const reservedPluginIds = new Set([
    ...(context.existingPluginIds ?? []),
    ...PLUGIN_MANIFESTS.filter((p) => p.id !== manifest.id).map((p) => p.id),
  ]);
  if (reservedPluginIds.has(manifest.id)) {
    errors.push(`Duplicate plugin ID: ${manifest.id}`);
  }

  const reservedContentTypes = new Set(context.existingContentTypeKeys ?? []);
  for (const ct of manifest.content_types ?? []) {
    if (!ct.type_key?.trim()) errors.push("Content type key is required");
    if (reservedContentTypes.has(ct.type_key)) {
      errors.push(`Duplicate content type key: ${ct.type_key}`);
    }
    reservedContentTypes.add(ct.type_key);
  }

  const reservedRouteBases = new Set(
    (context.existingRouteBases ?? []).map(normalizeRouteBase),
  );
  for (const ct of manifest.content_types ?? []) {
    if (ct.route_base) {
      const base = normalizeRouteBase(ct.route_base);
      if (reservedRouteBases.has(base)) {
        errors.push(`Duplicate route base: ${base}`);
      }
      reservedRouteBases.add(base);
    }
  }

  const reservedAdminBases = new Set(
    (context.existingAdminBases ?? []).map(normalizeAdminBase),
  );
  for (const ct of manifest.content_types ?? []) {
    if (ct.admin_base) {
      const base = normalizeAdminBase(ct.admin_base);
      if (reservedAdminBases.has(base)) {
        errors.push(`Duplicate admin route base: ${base}`);
      }
      reservedAdminBases.add(base);
    }
  }
  for (const route of manifest.admin_routes ?? []) {
    const base = normalizeAdminBase(
      `/admin${route.path.startsWith("/") ? route.path : `/${route.path}`}`,
    );
    if (reservedAdminBases.has(base)) {
      errors.push(`Duplicate admin route base: ${base}`);
    }
    reservedAdminBases.add(base);
  }

  const reservedBlockTypes = new Set(context.existingBlockTypes ?? []);
  for (const block of manifest.blocks ?? []) {
    if (!block.type?.trim()) errors.push("Block type is required");
    if (reservedBlockTypes.has(block.type)) {
      errors.push(`Duplicate block type key: ${block.type}`);
    }
    reservedBlockTypes.add(block.type);
  }

  if (errors.length > 0) {
    throw new ManifestValidationError("Plugin manifest validation failed", errors);
  }
}

export function validateAllPluginManifests(): void {
  collectFromManifests(PLUGIN_MANIFESTS);
}
