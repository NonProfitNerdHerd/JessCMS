import type { ContentTypeRecord } from "../foundation/types";

const CONTENT_TYPE_COLUMNS = `
  id, type_key, label, plural_label, description, source, plugin_id, enabled,
  supports_json, supports_html, supports_revisions, supports_workflow,
  supports_seo, supports_featured_image, supports_author, supports_parent,
  supports_archive, supports_public_routes, route_base, admin_base, icon,
  schema_json, settings_json, created_at, updated_at
`;

function mapRow(row: Record<string, unknown>): ContentTypeRecord {
  return {
    id: String(row.id),
    type_key: String(row.type_key),
    label: String(row.label),
    plural_label: String(row.plural_label),
    description: (row.description as string | null) ?? null,
    source: row.source as ContentTypeRecord["source"],
    plugin_id: (row.plugin_id as string | null) ?? null,
    enabled: row.enabled === 1 || row.enabled === true,
    supports_json: row.supports_json === 1 || row.supports_json === true,
    supports_html: row.supports_html === 1 || row.supports_html === true,
    supports_revisions: row.supports_revisions === 1 || row.supports_revisions === true,
    supports_workflow: row.supports_workflow === 1 || row.supports_workflow === true,
    supports_seo: row.supports_seo === 1 || row.supports_seo === true,
    supports_featured_image:
      row.supports_featured_image === 1 || row.supports_featured_image === true,
    supports_author: row.supports_author === 1 || row.supports_author === true,
    supports_parent: row.supports_parent === 1 || row.supports_parent === true,
    supports_archive: row.supports_archive === 1 || row.supports_archive === true,
    supports_public_routes:
      row.supports_public_routes === 1 || row.supports_public_routes === true,
    route_base: (row.route_base as string | null) ?? null,
    admin_base: (row.admin_base as string | null) ?? null,
    icon: (row.icon as string | null) ?? null,
    schema_json: row.schema_json
      ? (JSON.parse(String(row.schema_json)) as Record<string, unknown>)
      : null,
    settings_json: row.settings_json
      ? (JSON.parse(String(row.settings_json)) as Record<string, unknown>)
      : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listContentTypes(
  db: D1Database,
  options: { enabledOnly?: boolean } = {},
): Promise<ContentTypeRecord[]> {
  const clause = options.enabledOnly ? "WHERE enabled = 1" : "";
  const result = await db
    .prepare(`SELECT ${CONTENT_TYPE_COLUMNS} FROM content_types ${clause} ORDER BY label`)
    .all<Record<string, unknown>>();

  return (result.results ?? []).map(mapRow);
}

export async function getContentTypeByKey(
  db: D1Database,
  typeKey: string,
): Promise<ContentTypeRecord | null> {
  const row = await db
    .prepare(`SELECT ${CONTENT_TYPE_COLUMNS} FROM content_types WHERE type_key = ?`)
    .bind(typeKey)
    .first<Record<string, unknown>>();

  return row ? mapRow(row) : null;
}

export async function getContentTypeRouteBases(db: D1Database): Promise<string[]> {
  const types = await listContentTypes(db, { enabledOnly: true });
  return types
    .map((type) => type.route_base)
    .filter((value): value is string => Boolean(value));
}

export async function getContentTypeAdminNavItems(db: D1Database): Promise<
  Array<{ href: string; label: string; icon: string }>
> {
  const types = await listContentTypes(db, { enabledOnly: true });
  return types
    .filter((type) => type.admin_base)
    .map((type) => ({
      href: type.admin_base!,
      label: type.plural_label,
      icon: type.icon ?? "📄",
    }));
}

export function supportsCapability(
  type: ContentTypeRecord | null | undefined,
  capability:
    | "revisions"
    | "workflow"
    | "seo"
    | "featured_image"
    | "public_routes",
): boolean {
  if (!type) return false;
  switch (capability) {
    case "revisions":
      return type.supports_revisions;
    case "workflow":
      return type.supports_workflow;
    case "seo":
      return type.supports_seo;
    case "featured_image":
      return type.supports_featured_image;
    case "public_routes":
      return type.supports_public_routes;
  }
}

export function sourceTableForContentType(typeKey: string): string | null {
  switch (typeKey) {
    case "page":
      return "pages";
    case "post":
      return "posts";
    case "event":
      return "events";
    case "form":
      return "forms";
    default:
      return "content_entries";
  }
}
