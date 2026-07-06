import type { AuthUser } from "../auth";
import { getCurrentUser, userHasPermission } from "../auth";
import {
  getContentTypeByKey,
  supportsCapability,
} from "../content-types/registry";
import type { ContentTypeRecord } from "../foundation/types";
import {
  removeContentIndexEntry,
  syncContentEntryToContentIndex,
} from "../content-index/repository";
import { generateId } from "../lib/crypto";
import {
  isPublicPublishedFilter,
  normalizeContentJson,
  parseListQuery,
  validateBaseContentInput,
} from "../lib/validation";
import { getClientIp, resolveAuditAction, writeAuditLog } from "../db/audit";
import { createContentRevision } from "../revisions/repository";
import {
  ensureWorkflowState,
  workflowStateFromContentStatus,
} from "../workflow/repository";
import {
  NotFoundError,
  ValidationError,
} from "../content/repository";
import {
  parseContentTypeSchema,
  validateMetadataAgainstSchema,
} from "./schema-validation";
import type { ContentEntryInput, ContentEntryRecord } from "./types";
export type { ContentEntryInput } from "./types";
import { isGenericContentType } from "./registry";

export { NotFoundError, ValidationError };

const ENTRY_COLUMNS = `
  id, content_type, title, slug, status, excerpt, content_json, content_html,
  author_id, featured_image_id, parent_id, template, seo_title, seo_description,
  published_at, metadata_json, plugin_id, created_at, updated_at
`;

function mapEntryRow(row: Record<string, unknown>): ContentEntryRecord {
  const metadataJson = row.metadata_json as string | null;
  let metadata: Record<string, unknown> | null = null;
  if (metadataJson) {
    try {
      metadata = JSON.parse(metadataJson) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }

  return {
    id: String(row.id),
    content_type: String(row.content_type),
    title: String(row.title),
    slug: String(row.slug),
    status: String(row.status),
    excerpt: (row.excerpt as string | null) ?? null,
    content_json: (row.content_json as string | null) ?? null,
    content_html: (row.content_html as string | null) ?? null,
    author_id: (row.author_id as string | null) ?? null,
    featured_image_id: (row.featured_image_id as string | null) ?? null,
    parent_id: (row.parent_id as string | null) ?? null,
    template: (row.template as string | null) ?? null,
    seo_title: (row.seo_title as string | null) ?? null,
    seo_description: (row.seo_description as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    metadata_json: metadataJson,
    metadata,
    plugin_id: (row.plugin_id as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export class ContentTypeAccessError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "disabled" | "legacy",
  ) {
    super(message);
  }
}

export async function resolveGenericContentType(
  db: D1Database,
  typeKey: string,
): Promise<ContentTypeRecord> {
  if (!isGenericContentType(typeKey)) {
    throw new ContentTypeAccessError(
      `Content type "${typeKey}" uses legacy APIs`,
      "legacy",
    );
  }

  const contentType = await getContentTypeByKey(db, typeKey);
  if (!contentType) {
    throw new ContentTypeAccessError(
      `Content type "${typeKey}" not found`,
      "not_found",
    );
  }

  if (!contentType.enabled) {
    throw new ContentTypeAccessError(
      `Content type "${typeKey}" is disabled`,
      "disabled",
    );
  }

  return contentType;
}

function buildListWhereClause(
  user: AuthUser | null,
  contentType: string,
  status: string | undefined,
  q: string | undefined,
): { clause: string; params: unknown[] } {
  const params: unknown[] = [contentType];
  const conditions: string[] = ["content_type = ?"];

  if (user && userHasPermission(user.permissions, "content:read")) {
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
  } else {
    conditions.push(isPublicPublishedFilter());
  }

  if (q) {
    conditions.push("(title LIKE ? OR slug LIKE ?)");
    const term = `%${q}%`;
    params.push(term, term);
  }

  return { clause: `WHERE ${conditions.join(" AND ")}`, params };
}

function validateEntryInput(
  contentType: ContentTypeRecord,
  input: ContentEntryInput,
  options: { requireTitle?: boolean; requireSlug?: boolean } = {},
): { valid: boolean; errors: string[] } {
  const base = validateBaseContentInput(input);
  const errors = [...base.errors];

  if (options.requireTitle && !input.title?.trim()) {
    errors.push("title is required");
  }
  if (options.requireSlug && !input.slug?.trim()) {
    errors.push("slug is required");
  }

  const schema = parseContentTypeSchema(contentType.schema_json);
  const metadataResult = validateMetadataAgainstSchema(schema, input.metadata ?? {});
  errors.push(...metadataResult.errors);

  return { valid: errors.length === 0, errors };
}

async function slugExists(
  db: D1Database,
  contentType: string,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const row = excludeId
    ? await db
        .prepare(
          "SELECT id FROM content_entries WHERE content_type = ? AND slug = ? AND id != ?",
        )
        .bind(contentType, slug, excludeId)
        .first<{ id: string }>()
    : await db
        .prepare(
          "SELECT id FROM content_entries WHERE content_type = ? AND slug = ?",
        )
        .bind(contentType, slug)
        .first<{ id: string }>();

  return Boolean(row);
}

export async function listContentEntries(
  request: Request,
  env: Env,
  contentTypeKey: string,
): Promise<{ items: ContentEntryRecord[]; count: number; limit: number; offset: number }> {
  await resolveGenericContentType(env.DB, contentTypeKey);

  const user = await getCurrentUser(request, env);
  const url = new URL(request.url);
  const { status, q, limit, offset } = parseListQuery(url);
  const { clause, params } = buildListWhereClause(user, contentTypeKey, status, q);

  const items = await env.DB.prepare(
    `
      SELECT ${ENTRY_COLUMNS}
      FROM content_entries
      ${clause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `,
  )
    .bind(...params, limit, offset)
    .all<Record<string, unknown>>();

  const countResult = await env.DB.prepare(
    `
      SELECT COUNT(*) AS count
      FROM content_entries
      ${clause}
    `,
  )
    .bind(...params)
    .first<{ count: number }>();

  return {
    items: (items.results ?? []).map(mapEntryRow),
    count: countResult?.count ?? 0,
    limit,
    offset,
  };
}

export async function getContentEntryById(
  request: Request,
  env: Env,
  contentTypeKey: string,
  id: string,
): Promise<ContentEntryRecord | null> {
  await resolveGenericContentType(env.DB, contentTypeKey);

  const user = await getCurrentUser(request, env);
  const row = await env.DB.prepare(
    `SELECT ${ENTRY_COLUMNS} FROM content_entries WHERE id = ? AND content_type = ?`,
  )
    .bind(id, contentTypeKey)
    .first<Record<string, unknown>>();

  if (!row) {
    return null;
  }

  const entry = mapEntryRow(row);
  if (
    entry.status !== "published" &&
    !(user && userHasPermission(user.permissions, "content:read"))
  ) {
    return null;
  }

  return entry;
}

export async function getContentEntryBySlug(
  request: Request,
  env: Env,
  contentTypeKey: string,
  slug: string,
): Promise<ContentEntryRecord | null> {
  await resolveGenericContentType(env.DB, contentTypeKey);

  const user = await getCurrentUser(request, env);
  const row = await env.DB.prepare(
    `SELECT ${ENTRY_COLUMNS} FROM content_entries WHERE slug = ? AND content_type = ?`,
  )
    .bind(slug, contentTypeKey)
    .first<Record<string, unknown>>();

  if (!row) {
    return null;
  }

  const entry = mapEntryRow(row);
  if (
    entry.status !== "published" &&
    !(user && userHasPermission(user.permissions, "content:read"))
  ) {
    return null;
  }

  return entry;
}

export async function getPublishedContentEntryById(
  db: D1Database,
  contentTypeKey: string,
  id: string,
): Promise<ContentEntryRecord | null> {
  const row = await db
    .prepare(
      `
        SELECT ${ENTRY_COLUMNS}
        FROM content_entries
        WHERE id = ? AND content_type = ? AND status = 'published'
          AND (published_at IS NULL OR datetime(published_at) <= datetime('now'))
      `,
    )
    .bind(id, contentTypeKey)
    .first<Record<string, unknown>>();

  return row ? mapEntryRow(row) : null;
}

export async function createContentEntry(
  request: Request,
  env: Env,
  user: AuthUser,
  contentTypeKey: string,
  input: ContentEntryInput,
): Promise<ContentEntryRecord> {
  const contentType = await resolveGenericContentType(env.DB, contentTypeKey);

  const validation = validateEntryInput(contentType, input, {
    requireTitle: true,
    requireSlug: true,
  });
  if (!validation.valid) {
    throw new ValidationError(validation.errors);
  }

  if (await slugExists(env.DB, contentTypeKey, input.slug!)) {
    throw new ValidationError(["slug already exists"]);
  }

  const id = generateId(contentTypeKey.slice(0, 4) || "entry");
  const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

  await env.DB.prepare(
    `
      INSERT INTO content_entries (
        id, content_type, title, slug, status, excerpt, content_json, content_html,
        author_id, featured_image_id, parent_id, template, seo_title, seo_description,
        published_at, metadata_json, plugin_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      id,
      contentTypeKey,
      input.title,
      input.slug,
      input.status ?? "draft",
      input.excerpt ?? null,
      normalizeContentJson(input.content_json),
      input.content_html ?? null,
      contentType.supports_author !== false ? user.id : null,
      contentType.supports_featured_image
        ? input.featured_image_id ?? null
        : null,
      contentType.supports_parent ? input.parent_id ?? null : null,
      input.template ?? null,
      supportsCapability(contentType, "seo") ? input.seo_title ?? null : null,
      supportsCapability(contentType, "seo") ? input.seo_description ?? null : null,
      input.published_at ?? null,
      metadataJson,
      contentType.plugin_id ?? null,
    )
    .run();

  const created = await env.DB.prepare(
    `SELECT ${ENTRY_COLUMNS} FROM content_entries WHERE id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown>>();

  const entry = mapEntryRow(created!);

  await writeAuditLog(env.DB, {
    actorId: user.id,
    action: "create",
    entityType: contentTypeKey,
    entityId: id,
    metadata: { title: input.title, slug: input.slug, status: input.status ?? "draft" },
    ipAddress: getClientIp(request),
  });

  if (supportsCapability(contentType, "workflow")) {
    await ensureWorkflowState(
      env.DB,
      contentTypeKey,
      id,
      workflowStateFromContentStatus(input.status ?? "draft"),
    );
  }

  if (supportsCapability(contentType, "revisions")) {
    await createContentRevision(
      env.DB,
      contentTypeKey,
      id,
      user.id,
      input.change_summary ?? "Initial version",
    );
  }

  await syncContentEntryToContentIndex(env.DB, entry, contentType);

  return entry;
}

export async function updateContentEntry(
  request: Request,
  env: Env,
  user: AuthUser,
  contentTypeKey: string,
  id: string,
  input: ContentEntryInput,
): Promise<ContentEntryRecord> {
  const contentType = await resolveGenericContentType(env.DB, contentTypeKey);

  const existing = await env.DB.prepare(
    `SELECT * FROM content_entries WHERE id = ? AND content_type = ?`,
  )
    .bind(id, contentTypeKey)
    .first<Record<string, unknown>>();

  if (!existing) {
    throw new NotFoundError();
  }

  const mergedMetadata = {
    ...(existing.metadata_json
      ? (JSON.parse(String(existing.metadata_json)) as Record<string, unknown>)
      : {}),
    ...(input.metadata ?? {}),
  };

  const merged: ContentEntryInput = {
    title: (input.title ?? existing.title) as string,
    slug: (input.slug ?? existing.slug) as string,
    status: (input.status ?? existing.status) as string,
    excerpt: input.excerpt !== undefined ? input.excerpt : (existing.excerpt as string | null),
    content_json:
      input.content_json !== undefined
        ? input.content_json
        : (existing.content_json as string | null),
    content_html:
      input.content_html !== undefined
        ? input.content_html
        : (existing.content_html as string | null),
    featured_image_id:
      input.featured_image_id !== undefined
        ? input.featured_image_id
        : (existing.featured_image_id as string | null),
    parent_id:
      input.parent_id !== undefined
        ? input.parent_id
        : (existing.parent_id as string | null),
    template:
      input.template !== undefined
        ? input.template
        : (existing.template as string | null),
    seo_title:
      input.seo_title !== undefined
        ? input.seo_title
        : (existing.seo_title as string | null),
    seo_description:
      input.seo_description !== undefined
        ? input.seo_description
        : (existing.seo_description as string | null),
    published_at:
      input.published_at !== undefined
        ? input.published_at
        : (existing.published_at as string | null),
    metadata: input.metadata !== undefined ? input.metadata : mergedMetadata,
  };

  const validation = validateEntryInput(contentType, merged);
  if (!validation.valid) {
    throw new ValidationError(validation.errors);
  }

  if (input.slug && input.slug !== existing.slug) {
    if (await slugExists(env.DB, contentTypeKey, String(input.slug), id)) {
      throw new ValidationError(["slug already exists"]);
    }
  }

  const allowed = [
    "title",
    "slug",
    "status",
    "excerpt",
    "content_json",
    "content_html",
    "featured_image_id",
    "parent_id",
    "template",
    "seo_title",
    "seo_description",
    "published_at",
  ];

  const sets: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in input) {
      sets.push(`${key} = ?`);
      const value = input[key as keyof ContentEntryInput];
      values.push(
        key === "content_json" ? normalizeContentJson(value) : value,
      );
    }
  }

  if (input.metadata !== undefined) {
    sets.push("metadata_json = ?");
    values.push(JSON.stringify(input.metadata));
  }

  if (sets.length === 0) {
    throw new ValidationError(["no valid fields to update"]);
  }

  sets.push("updated_at = datetime('now')");
  values.push(id, contentTypeKey);

  await env.DB.prepare(
    `UPDATE content_entries SET ${sets.join(", ")} WHERE id = ? AND content_type = ?`,
  )
    .bind(...values)
    .run();

  const updated = await env.DB.prepare(
    `SELECT ${ENTRY_COLUMNS} FROM content_entries WHERE id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown>>();

  const entry = mapEntryRow(updated!);

  await writeAuditLog(env.DB, {
    actorId: user.id,
    action: resolveAuditAction(
      existing.status as string | undefined,
      (input.status as string | undefined) ?? (existing.status as string | undefined),
      "update",
    ),
    entityType: contentTypeKey,
    entityId: id,
    metadata: { changes: input },
    ipAddress: getClientIp(request),
  });

  if (supportsCapability(contentType, "revisions")) {
    await createContentRevision(
      env.DB,
      contentTypeKey,
      id,
      user.id,
      input.change_summary ?? "Content updated",
    );
  }

  await syncContentEntryToContentIndex(env.DB, entry, contentType);

  return entry;
}

export async function deleteContentEntry(
  request: Request,
  env: Env,
  user: AuthUser,
  contentTypeKey: string,
  id: string,
): Promise<void> {
  await resolveGenericContentType(env.DB, contentTypeKey);

  const existing = await env.DB.prepare(
    "SELECT id, title, slug FROM content_entries WHERE id = ? AND content_type = ?",
  )
    .bind(id, contentTypeKey)
    .first<{ id: string; title: string; slug: string }>();

  if (!existing) {
    throw new NotFoundError();
  }

  await env.DB.prepare(
    "DELETE FROM content_entries WHERE id = ? AND content_type = ?",
  )
    .bind(id, contentTypeKey)
    .run();

  await removeContentIndexEntry(env.DB, contentTypeKey, id);

  await writeAuditLog(env.DB, {
    actorId: user.id,
    action: "delete",
    entityType: contentTypeKey,
    entityId: id,
    metadata: { title: existing.title, slug: existing.slug },
    ipAddress: getClientIp(request),
  });
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ValidationError(["invalid JSON body"]);
  }
}

export function needsPublishPermission(input: { status?: string }): boolean {
  return input.status === "published" || input.status === "scheduled";
}
