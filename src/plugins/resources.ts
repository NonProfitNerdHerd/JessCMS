import { generateId } from "../lib/crypto";
import type {
  CleanupPolicy,
  OwnershipType,
  PluginResourceDefinition,
  PluginResourceRecord,
} from "../foundation/types";

export async function registerPluginResource(
  db: D1Database,
  pluginId: string,
  resource: PluginResourceDefinition,
): Promise<PluginResourceRecord> {
  const existing = await db
    .prepare(
      `
        SELECT id FROM plugin_resources
        WHERE plugin_id = ? AND resource_type = ? AND resource_name = ?
          AND COALESCE(entity_id, '') = COALESCE(?, '')
      `,
    )
    .bind(
      pluginId,
      resource.resource_type,
      resource.resource_name,
      resource.entity_id ?? null,
    )
    .first<{ id: string }>();

  const id = existing?.id ?? generateId("pr");

  await db
    .prepare(
      `
        INSERT INTO plugin_resources (
          id, plugin_id, resource_type, resource_name, table_name, entity_id,
          ownership_type, cleanup_policy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          table_name = excluded.table_name,
          ownership_type = excluded.ownership_type,
          cleanup_policy = excluded.cleanup_policy,
          updated_at = datetime('now')
      `,
    )
    .bind(
      id,
      pluginId,
      resource.resource_type,
      resource.resource_name,
      resource.table_name ?? null,
      resource.entity_id ?? null,
      resource.ownership_type ?? "owns",
      resource.cleanup_policy ?? "retain",
    )
    .run();

  return (await getPluginResourceById(db, id))!;
}

export async function getPluginResourceById(
  db: D1Database,
  id: string,
): Promise<PluginResourceRecord | null> {
  return db
    .prepare(
      `
        SELECT id, plugin_id, resource_type, resource_name, table_name, entity_id,
               ownership_type, cleanup_policy, created_at, updated_at
        FROM plugin_resources WHERE id = ?
      `,
    )
    .bind(id)
    .first<PluginResourceRecord>();
}

export async function listPluginResources(
  db: D1Database,
  pluginId: string,
): Promise<PluginResourceRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT id, plugin_id, resource_type, resource_name, table_name, entity_id,
               ownership_type, cleanup_policy, created_at, updated_at
        FROM plugin_resources
        WHERE plugin_id = ?
        ORDER BY resource_type, resource_name
      `,
    )
    .bind(pluginId)
    .all<PluginResourceRecord>();

  return result.results ?? [];
}

export async function countAffectedResourceRows(
  db: D1Database,
  resource: PluginResourceRecord,
): Promise<number | null> {
  if (!resource.table_name) return null;

  if (resource.entity_id) {
    const row = await db
      .prepare(`SELECT COUNT(*) AS count FROM ${resource.table_name} WHERE id = ?`)
      .bind(resource.entity_id)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  const row = await db
    .prepare(`SELECT COUNT(*) AS count FROM ${resource.table_name}`)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

export async function deleteOwnedEntityResource(
  db: D1Database,
  resource: PluginResourceRecord,
): Promise<number> {
  if (!resource.table_name || !resource.entity_id) {
    return 0;
  }

  const result = await db
    .prepare(`DELETE FROM ${resource.table_name} WHERE id = ?`)
    .bind(resource.entity_id)
    .run();

  await db.prepare("DELETE FROM plugin_resources WHERE id = ?").bind(resource.id).run();
  return result.meta.changes ?? 0;
}

export async function archiveOwnedEntityResource(
  db: D1Database,
  resource: PluginResourceRecord,
): Promise<void> {
  if (!resource.table_name || !resource.entity_id) return;

  if (resource.table_name === "forms") {
    await db
      .prepare(
        "UPDATE forms SET status = 'archived', updated_at = datetime('now') WHERE id = ?",
      )
      .bind(resource.entity_id)
      .run();
  }
}

export function ownershipLabel(type: OwnershipType): string {
  switch (type) {
    case "owns":
      return "Owns";
    case "extends":
      return "Extends";
    case "references":
      return "References";
  }
}

export function cleanupPolicyLabel(policy: CleanupPolicy): string {
  switch (policy) {
    case "retain":
      return "Retain";
    case "archive":
      return "Archive";
    case "delete":
      return "Delete";
  }
}
