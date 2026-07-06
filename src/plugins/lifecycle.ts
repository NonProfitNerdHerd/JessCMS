import { writeAuditLog, getClientIp } from "../db/audit";
import type {
  DbPluginRecord,
  PluginLifecycleState,
  PluginManifest,
  UninstallMode,
  UninstallPreview,
} from "../foundation/types";
import { validatePluginManifest } from "../foundation/manifest-validation";
import {
  archiveOwnedEntityResource,
  countAffectedResourceRows,
  deleteOwnedEntityResource,
  listPluginResources,
} from "./resources";
import {
  runDisableHook,
  runEnableHook,
  runUninstallHook,
} from "./lifecycle-hooks";
import { listContentTypes } from "../content-types/registry";

export class PluginLifecycleError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "invalid_state" | "validation",
  ) {
    super(message);
  }
}

export async function getDbPlugin(
  db: D1Database,
  pluginId: string,
): Promise<DbPluginRecord | null> {
  return db
    .prepare(
      `
        SELECT id, name, version, enabled, manifest_json, lifecycle_state,
               installed_at, enabled_at, disabled_at, uninstalled_at, updated_at
        FROM plugins WHERE id = ?
      `,
    )
    .bind(pluginId)
    .first<DbPluginRecord>();
}

export async function buildUninstallPreview(
  db: D1Database,
  manifest: PluginManifest,
): Promise<UninstallPreview> {
  const plugin = await getDbPlugin(db, manifest.id);
  const resources = await listPluginResources(db, manifest.id);
  const contentTypes = (await listContentTypes(db))
    .filter((type) => type.plugin_id === manifest.id)
    .map((type) => type.type_key);

  const resourcePreview = [];
  for (const resource of resources) {
    resourcePreview.push({
      id: resource.id,
      resource_type: resource.resource_type,
      resource_name: resource.resource_name,
      table_name: resource.table_name,
      entity_id: resource.entity_id,
      ownership_type: resource.ownership_type,
      cleanup_policy: resource.cleanup_policy,
      affected_count: await countAffectedResourceRows(db, resource),
    });
  }

  const warnings: string[] = [];
  if (resources.some((r) => r.ownership_type === "owns" && !r.entity_id)) {
    warnings.push("This plugin owns database tables that may contain data.");
  }
  if (contentTypes.length > 0) {
    warnings.push(`Registered content types: ${contentTypes.join(", ")}`);
  }

  return {
    plugin_id: manifest.id,
    plugin_name: manifest.name,
    lifecycle_state: plugin?.lifecycle_state ?? "installed",
    resources: resourcePreview,
    content_types: contentTypes,
    warnings,
    options: [
      "disable_only",
      "uninstall_retain",
      "uninstall_archive",
      "uninstall_delete",
    ],
  };
}

export async function enablePlugin(
  request: Request,
  db: D1Database,
  manifest: PluginManifest,
  actorId: string,
): Promise<DbPluginRecord> {
  validatePluginManifest(manifest);

  await db
    .prepare(
      `
        UPDATE plugins
        SET enabled = 1,
            lifecycle_state = 'enabled',
            enabled_at = datetime('now'),
            disabled_at = NULL,
            uninstalled_at = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `,
    )
    .bind(manifest.id)
    .run();

  await runEnableHook(db, manifest);

  await writeAuditLog(db, {
    actorId,
    action: "update",
    entityType: "plugin",
    entityId: manifest.id,
    metadata: { lifecycle_action: "enable" },
    ipAddress: getClientIp(request),
  });

  return (await getDbPlugin(db, manifest.id))!;
}

export async function disablePlugin(
  request: Request,
  db: D1Database,
  manifest: PluginManifest,
  actorId: string,
): Promise<DbPluginRecord> {
  await db
    .prepare(
      `
        UPDATE plugins
        SET enabled = 0,
            lifecycle_state = 'disabled',
            disabled_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `,
    )
    .bind(manifest.id)
    .run();

  await runDisableHook(db, manifest);

  await writeAuditLog(db, {
    actorId,
    action: "update",
    entityType: "plugin",
    entityId: manifest.id,
    metadata: { lifecycle_action: "disable" },
    ipAddress: getClientIp(request),
  });

  return (await getDbPlugin(db, manifest.id))!;
}

export async function uninstallPlugin(
  request: Request,
  db: D1Database,
  manifest: PluginManifest,
  actorId: string,
  mode: UninstallMode,
): Promise<{ plugin: DbPluginRecord; deleted_rows: number; archived_rows: number }> {
  if (mode === "disable_only") {
    return {
      plugin: await disablePlugin(request, db, manifest, actorId),
      deleted_rows: 0,
      archived_rows: 0,
    };
  }

  await db
    .prepare(
      `
        UPDATE plugins
        SET lifecycle_state = 'uninstall_pending', updated_at = datetime('now')
        WHERE id = ?
      `,
    )
    .bind(manifest.id)
    .run();

  const resources = await listPluginResources(db, manifest.id);
  let deletedRows = 0;
  let archivedRows = 0;

  if (mode === "uninstall_delete") {
    for (const resource of resources.filter((r) => r.entity_id)) {
      deletedRows += await deleteOwnedEntityResource(db, resource);
    }
  } else if (mode === "uninstall_archive") {
    for (const resource of resources.filter((r) => r.entity_id)) {
      await archiveOwnedEntityResource(db, resource);
      archivedRows += 1;
    }
  }

  await db
    .prepare(
      `
        UPDATE plugins
        SET enabled = 0,
            lifecycle_state = 'uninstalled',
            disabled_at = datetime('now'),
            uninstalled_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `,
    )
    .bind(manifest.id)
    .run();

  await runUninstallHook(db, manifest);

  await writeAuditLog(db, {
    actorId,
    action: "delete",
    entityType: "plugin",
    entityId: manifest.id,
    metadata: {
      lifecycle_action: "uninstall",
      mode,
      deleted_rows: deletedRows,
      archived_rows: archivedRows,
    },
    ipAddress: getClientIp(request),
  });

  return {
    plugin: (await getDbPlugin(db, manifest.id))!,
    deleted_rows: deletedRows,
    archived_rows: archivedRows,
  };
}

export function lifecycleStateLabel(state: PluginLifecycleState): string {
  switch (state) {
    case "installed":
      return "Installed";
    case "enabled":
      return "Enabled";
    case "disabled":
      return "Disabled";
    case "uninstall_pending":
      return "Uninstall pending";
    case "uninstalled":
      return "Uninstalled";
  }
}
