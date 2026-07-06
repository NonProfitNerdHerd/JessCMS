import type { AuthUser } from "../auth";
import { getCurrentUser, userHasPermission } from "../auth";
import { generateId } from "../lib/crypto";
import {
  isPublicPublishedFilter,
  normalizeContentJson,
  parseListQuery,
  type BaseContentInput,
  type EventContentInput,
  validateBaseContentInput,
  validateEventInput,
} from "../lib/validation";
import { getClientIp, resolveAuditAction, writeAuditLog } from "../db/audit";
import { createContentRevision } from "../revisions/repository";
import {
  ensureWorkflowState,
  workflowStateFromContentStatus,
} from "../workflow/repository";
import { tableToEntityType } from "../workflow/types";

export interface ContentRecord {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  content_json: string | null;
  content_html: string | null;
  status: string;
  author_id: string | null;
  featured_image_id: string | null;
  parent_id: string | null;
  template: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostRecord extends ContentRecord {
  category_id: string | null;
}

export interface EventRecord extends ContentRecord {
  start_datetime: string;
  end_datetime: string | null;
  location_name: string | null;
  location_address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  event_status: string;
}

type ContentTable = "pages" | "posts" | "events";

const PAGE_COLUMNS = `
  id, slug, title, excerpt, content, content_json, content_html, status,
  author_id, featured_image_id, parent_id, template, seo_title, seo_description,
  published_at, created_at, updated_at
`;

const POST_COLUMNS = `
  id, slug, title, excerpt, content, content_json, content_html, status,
  author_id, category_id, featured_image_id, parent_id, template, seo_title,
  seo_description, published_at, created_at, updated_at
`;

const EVENT_COLUMNS = `
  id, slug, title, status, excerpt, content_json, content_html, author_id,
  featured_image_id, parent_id, template, seo_title, seo_description,
  start_datetime, end_datetime, location_name, location_address, latitude,
  longitude, timezone, event_status, published_at, created_at, updated_at
`;

function tableConfig(table: ContentTable): {
  entityType: string;
  listColumns: string;
  idPrefix: string;
} {
  switch (table) {
    case "pages":
      return { entityType: "page", listColumns: PAGE_COLUMNS, idPrefix: "page" };
    case "posts":
      return { entityType: "post", listColumns: POST_COLUMNS, idPrefix: "post" };
    case "events":
      return { entityType: "event", listColumns: EVENT_COLUMNS, idPrefix: "event" };
  }
}

function buildListWhereClause(
  user: AuthUser | null,
  status: string | undefined,
  q: string | undefined,
): { clause: string; params: unknown[] } {
  const params: unknown[] = [];
  const conditions: string[] = [];

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

  if (conditions.length === 0) {
    return { clause: "", params };
  }

  return { clause: `WHERE ${conditions.join(" AND ")}`, params };
}

export async function listContent<T extends ContentRecord>(
  request: Request,
  env: Env,
  table: ContentTable,
): Promise<{ items: T[]; count: number; limit: number; offset: number }> {
  const user = await getCurrentUser(request, env);
  const url = new URL(request.url);
  const { status, q, limit, offset } = parseListQuery(url);
  const { listColumns } = tableConfig(table);
  const { clause, params } = buildListWhereClause(user, status, q);

  const items = await env.DB.prepare(
    `
      SELECT ${listColumns}
      FROM ${table}
      ${clause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `,
  )
    .bind(...params, limit, offset)
    .all<T>();

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM ${table} ${clause}`,
  )
    .bind(...params)
    .first<{ count: number }>();

  return {
    items: items.results ?? [],
    count: countResult?.count ?? 0,
    limit,
    offset,
  };
}

async function getContentByField<T extends ContentRecord>(
  request: Request,
  env: Env,
  table: ContentTable,
  field: "id" | "slug",
  value: string,
): Promise<T | null> {
  const user = await getCurrentUser(request, env);
  const { listColumns } = tableConfig(table);

  const row = await env.DB.prepare(
    `SELECT ${listColumns} FROM ${table} WHERE ${field} = ?`,
  )
    .bind(value)
    .first<T>();

  if (!row) {
    return null;
  }

  const canReadDrafts = user && userHasPermission(user.permissions, "content:read");
  if (canReadDrafts) {
    return row;
  }

  if (row.status !== "published") {
    return null;
  }

  if (row.published_at && Date.parse(row.published_at) > Date.now()) {
    return null;
  }

  return row;
}

export async function getContentById<T extends ContentRecord>(
  request: Request,
  env: Env,
  table: ContentTable,
  id: string,
): Promise<T | null> {
  return getContentByField<T>(request, env, table, "id", id);
}

export async function getContentBySlug<T extends ContentRecord>(
  request: Request,
  env: Env,
  table: ContentTable,
  slug: string,
): Promise<T | null> {
  return getContentByField<T>(request, env, table, "slug", slug);
}

async function slugExists(
  db: D1Database,
  table: ContentTable,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const query = excludeId
    ? `SELECT id FROM ${table} WHERE slug = ? AND id != ?`
    : `SELECT id FROM ${table} WHERE slug = ?`;

  const row = excludeId
    ? await db.prepare(query).bind(slug, excludeId).first<{ id: string }>()
    : await db.prepare(query).bind(slug).first<{ id: string }>();

  return Boolean(row);
}

function baseInsertFields(input: BaseContentInput): {
  columns: string[];
  values: unknown[];
} {
  const columns: string[] = [];
  const values: unknown[] = [];
  const entries: Array<[string, unknown]> = [
    ["title", input.title],
    ["slug", input.slug],
    ["status", input.status ?? "draft"],
    ["excerpt", input.excerpt ?? null],
    ["content_json", normalizeContentJson(input.content_json)],
    ["content_html", input.content_html ?? null],
    ["featured_image_id", input.featured_image_id ?? null],
    ["parent_id", input.parent_id ?? null],
    ["template", input.template ?? null],
    ["seo_title", input.seo_title ?? null],
    ["seo_description", input.seo_description ?? null],
    ["published_at", input.published_at ?? null],
  ];

  for (const [column, value] of entries) {
    if (value !== undefined) {
      columns.push(column);
      values.push(value);
    }
  }

  return { columns, values };
}

export async function createPage(
  request: Request,
  env: Env,
  user: AuthUser,
  input: BaseContentInput,
): Promise<ContentRecord> {
  const validation = validateBaseContentInput(input, {
    requireTitle: true,
    requireSlug: true,
  });
  if (!validation.valid) {
    throw new ValidationError(validation.errors);
  }

  if (await slugExists(env.DB, "pages", input.slug!)) {
    throw new ValidationError(["slug already exists"]);
  }

  const id = generateId("page");
  const { columns, values } = baseInsertFields(input);

  await env.DB.prepare(
    `
      INSERT INTO pages (id, author_id, ${columns.join(", ")})
      VALUES (?, ?, ${columns.map(() => "?").join(", ")})
    `,
  )
    .bind(id, user.id, ...values)
    .run();

  const created = await env.DB.prepare(
    `SELECT ${PAGE_COLUMNS} FROM pages WHERE id = ?`,
  )
    .bind(id)
    .first<ContentRecord>();

  await writeAuditLog(env.DB, {
    actorId: user.id,
    action: "create",
    entityType: "page",
    entityId: id,
    metadata: { title: input.title, slug: input.slug, status: input.status ?? "draft" },
    ipAddress: getClientIp(request),
  });

  await ensureWorkflowState(
    env.DB,
    "page",
    id,
    workflowStateFromContentStatus(input.status ?? "draft"),
  );
  await createContentRevision(
    env.DB,
    "page",
    id,
    user.id,
    (input as { change_summary?: string }).change_summary ?? "Initial version",
  );

  return created!;
}

export async function createPost(
  request: Request,
  env: Env,
  user: AuthUser,
  input: BaseContentInput & { category_id?: string | null },
): Promise<PostRecord> {
  const validation = validateBaseContentInput(input, {
    requireTitle: true,
    requireSlug: true,
  });
  if (!validation.valid) {
    throw new ValidationError(validation.errors);
  }

  if (await slugExists(env.DB, "posts", input.slug!)) {
    throw new ValidationError(["slug already exists"]);
  }

  const id = generateId("post");
  const { columns, values } = baseInsertFields(input);
  columns.push("category_id");
  values.push(input.category_id ?? null);

  await env.DB.prepare(
    `
      INSERT INTO posts (id, author_id, ${columns.join(", ")})
      VALUES (?, ?, ${columns.map(() => "?").join(", ")})
    `,
  )
    .bind(id, user.id, ...values)
    .run();

  const created = await env.DB.prepare(
    `SELECT ${POST_COLUMNS} FROM posts WHERE id = ?`,
  )
    .bind(id)
    .first<PostRecord>();

  await writeAuditLog(env.DB, {
    actorId: user.id,
    action: "create",
    entityType: "post",
    entityId: id,
    metadata: { title: input.title, slug: input.slug, status: input.status ?? "draft" },
    ipAddress: getClientIp(request),
  });

  await ensureWorkflowState(
    env.DB,
    "post",
    id,
    workflowStateFromContentStatus(input.status ?? "draft"),
  );
  await createContentRevision(
    env.DB,
    "post",
    id,
    user.id,
    (input as { change_summary?: string }).change_summary ?? "Initial version",
  );

  return created!;
}

export async function createEvent(
  request: Request,
  env: Env,
  user: AuthUser,
  input: EventContentInput,
): Promise<EventRecord> {
  const validation = validateEventInput(input, {
    requireTitle: true,
    requireSlug: true,
  });
  if (!validation.valid) {
    throw new ValidationError(validation.errors);
  }

  if (await slugExists(env.DB, "events", input.slug!)) {
    throw new ValidationError(["slug already exists"]);
  }

  const id = generateId("event");
  const { columns, values } = baseInsertFields(input);
  const eventFields: Array<[string, unknown]> = [
    ["start_datetime", input.start_datetime],
    ["end_datetime", input.end_datetime ?? null],
    ["location_name", input.location_name ?? null],
    ["location_address", input.location_address ?? null],
    ["latitude", input.latitude ?? null],
    ["longitude", input.longitude ?? null],
    ["timezone", input.timezone ?? "UTC"],
    ["event_status", input.event_status ?? "scheduled"],
  ];

  for (const [column, value] of eventFields) {
    columns.push(column);
    values.push(value);
  }

  await env.DB.prepare(
    `
      INSERT INTO events (id, author_id, ${columns.join(", ")})
      VALUES (?, ?, ${columns.map(() => "?").join(", ")})
    `,
  )
    .bind(id, user.id, ...values)
    .run();

  const created = await env.DB.prepare(
    `SELECT ${EVENT_COLUMNS} FROM events WHERE id = ?`,
  )
    .bind(id)
    .first<EventRecord>();

  await writeAuditLog(env.DB, {
    actorId: user.id,
    action: "create",
    entityType: "event",
    entityId: id,
    metadata: { title: input.title, slug: input.slug, status: input.status ?? "draft" },
    ipAddress: getClientIp(request),
  });

  await ensureWorkflowState(
    env.DB,
    "event",
    id,
    workflowStateFromContentStatus(input.status ?? "draft"),
  );
  await createContentRevision(
    env.DB,
    "event",
    id,
    user.id,
    (input as { change_summary?: string }).change_summary ?? "Initial version",
  );

  return created!;
}

export class ValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("; "));
  }
}

async function updateRecord<T extends ContentRecord>(
  request: Request,
  env: Env,
  user: AuthUser,
  table: ContentTable,
  id: string,
  input: Record<string, unknown>,
  validate: (input: Record<string, unknown>) => { valid: boolean; errors: string[] },
): Promise<T> {
  const existing = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();

  if (!existing) {
    throw new NotFoundError();
  }

  const merged = { ...existing, ...input };
  const validation = validate(merged);
  if (!validation.valid) {
    throw new ValidationError(validation.errors);
  }

  if (input.slug && input.slug !== existing.slug) {
    if (await slugExists(env.DB, table, String(input.slug), id)) {
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
    "category_id",
    "start_datetime",
    "end_datetime",
    "location_name",
    "location_address",
    "latitude",
    "longitude",
    "timezone",
    "event_status",
  ];

  const sets: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in input) {
      sets.push(`${key} = ?`);
      values.push(
        key === "content_json"
          ? normalizeContentJson(input[key])
          : input[key],
      );
    }
  }

  if (sets.length === 0) {
    throw new ValidationError(["no valid fields to update"]);
  }

  sets.push("updated_at = datetime('now')");

  await env.DB.prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values, id)
    .run();

  const { entityType, listColumns } = tableConfig(table);
  const updated = await env.DB.prepare(
    `SELECT ${listColumns} FROM ${table} WHERE id = ?`,
  )
    .bind(id)
    .first<T>();

  await writeAuditLog(env.DB, {
    actorId: user.id,
    action: resolveAuditAction(
      existing.status as string | undefined,
      (input.status as string | undefined) ?? (existing.status as string | undefined),
      "update",
    ),
    entityType,
    entityId: id,
    metadata: { changes: input },
    ipAddress: getClientIp(request),
  });

  const changeSummary =
    typeof input.change_summary === "string" ? input.change_summary : "Content updated";
  await createContentRevision(env.DB, tableToEntityType(table), id, user.id, changeSummary);

  return updated!;
}

export class NotFoundError extends Error {
  constructor() {
    super("Not found");
  }
}

export async function updatePage(
  request: Request,
  env: Env,
  user: AuthUser,
  id: string,
  input: BaseContentInput,
): Promise<ContentRecord> {
  return updateRecord<ContentRecord>(
    request,
    env,
    user,
    "pages",
    id,
    input,
    (value) => validateBaseContentInput(value as BaseContentInput),
  );
}

export async function updatePost(
  request: Request,
  env: Env,
  user: AuthUser,
  id: string,
  input: BaseContentInput & { category_id?: string | null },
): Promise<PostRecord> {
  return updateRecord<PostRecord>(
    request,
    env,
    user,
    "posts",
    id,
    input,
    (value) => validateBaseContentInput(value as BaseContentInput),
  );
}

export async function updateEvent(
  request: Request,
  env: Env,
  user: AuthUser,
  id: string,
  input: EventContentInput,
): Promise<EventRecord> {
  return updateRecord<EventRecord>(
    request,
    env,
    user,
    "events",
    id,
    input,
    (value) => validateEventInput(value as EventContentInput),
  );
}

export async function deleteContent(
  request: Request,
  env: Env,
  user: AuthUser,
  table: ContentTable,
  id: string,
): Promise<void> {
  const { entityType } = tableConfig(table);
  const existing = await env.DB.prepare(`SELECT id, title, slug FROM ${table} WHERE id = ?`)
    .bind(id)
    .first<{ id: string; title: string; slug: string }>();

  if (!existing) {
    throw new NotFoundError();
  }

  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();

  await writeAuditLog(env.DB, {
    actorId: user.id,
    action: "delete",
    entityType,
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
