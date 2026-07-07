import type { AuthUser } from "../auth";
import { generateId } from "../lib/crypto";
import { getClientIp, writeAuditLog } from "../db/audit";
import {
  resolveEntityStorage,
  type ContentEntityType,
} from "../workflow/types";
import {
  syncContentEntryToContentIndex,
  syncEventToContentIndex,
  syncPageToContentIndex,
  syncPostToContentIndex,
} from "../content-index/repository";
import { getContentTypeByKey } from "../content-types/registry";
import type {
  ContentRevisionRecord,
  RevisionCompareResult,
  RevisionSnapshot,
} from "./types";

export class RevisionError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "validation",
    public readonly details?: string[],
  ) {
    super(message);
  }
}

const SNAPSHOT_FIELDS = [
  "id",
  "slug",
  "title",
  "excerpt",
  "content",
  "content_json",
  "content_html",
  "status",
  "author_id",
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
  "metadata_json",
  "content_type",
  "plugin_id",
  "created_at",
  "updated_at",
] as const;

async function fetchEntityRow(
  db: D1Database,
  entityType: ContentEntityType,
  entityId: string,
): Promise<Record<string, unknown> | null> {
  const storage = resolveEntityStorage(entityType);
  if (storage.isGeneric) {
    return db
      .prepare(`SELECT * FROM content_entries WHERE id = ? AND content_type = ?`)
      .bind(entityId, storage.contentType)
      .first<Record<string, unknown>>();
  }

  return db
    .prepare(`SELECT * FROM ${storage.table} WHERE id = ?`)
    .bind(entityId)
    .first<Record<string, unknown>>();
}

export async function createContentRevision(
  db: D1Database,
  entityType: ContentEntityType,
  entityId: string,
  authorId: string | null,
  changeSummary?: string | null,
): Promise<ContentRevisionRecord> {
  const row = await fetchEntityRow(db, entityType, entityId);

  if (!row) {
    throw new RevisionError("Content not found", "not_found");
  }

  const snapshot: RevisionSnapshot = {};
  for (const field of SNAPSHOT_FIELDS) {
    if (field in row) {
      snapshot[field] = row[field];
    }
  }

  const maxResult = await db
    .prepare(
      `
        SELECT COALESCE(MAX(revision_number), 0) AS max_num
        FROM content_revisions
        WHERE entity_type = ? AND entity_id = ?
      `,
    )
    .bind(entityType, entityId)
    .first<{ max_num: number }>();

  const revisionNumber = (maxResult?.max_num ?? 0) + 1;
  const id = generateId("rev");

  await db
    .prepare(
      `
        INSERT INTO content_revisions (
          id, entity_type, entity_id, revision_number, snapshot_json,
          change_summary, author_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      id,
      entityType,
      entityId,
      revisionNumber,
      JSON.stringify(snapshot),
      changeSummary?.trim() || null,
      authorId,
    )
    .run();

  return (await getRevisionById(db, entityType, entityId, id))!;
}

export async function listRevisions(
  db: D1Database,
  entityType: ContentEntityType,
  entityId: string,
  limit = 50,
  offset = 0,
): Promise<{ items: ContentRevisionRecord[]; count: number }> {
  const items = await db
    .prepare(
      `
        SELECT r.id, r.entity_type, r.entity_id, r.revision_number,
               r.snapshot_json, r.change_summary, r.author_id, r.created_at,
               u.name AS author_name, u.email AS author_email
        FROM content_revisions r
        LEFT JOIN users u ON u.id = r.author_id
        WHERE r.entity_type = ? AND r.entity_id = ?
        ORDER BY r.revision_number DESC
        LIMIT ? OFFSET ?
      `,
    )
    .bind(entityType, entityId, limit, offset)
    .all<ContentRevisionRecord>();

  const countResult = await db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM content_revisions
        WHERE entity_type = ? AND entity_id = ?
      `,
    )
    .bind(entityType, entityId)
    .first<{ count: number }>();

  return {
    items: items.results ?? [],
    count: countResult?.count ?? 0,
  };
}

export async function getRevisionById(
  db: D1Database,
  entityType: ContentEntityType,
  entityId: string,
  revisionId: string,
): Promise<ContentRevisionRecord | null> {
  return db
    .prepare(
      `
        SELECT r.id, r.entity_type, r.entity_id, r.revision_number,
               r.snapshot_json, r.change_summary, r.author_id, r.created_at,
               u.name AS author_name, u.email AS author_email
        FROM content_revisions r
        LEFT JOIN users u ON u.id = r.author_id
        WHERE r.entity_type = ? AND r.entity_id = ? AND r.id = ?
      `,
    )
    .bind(entityType, entityId, revisionId)
    .first<ContentRevisionRecord>();
}

export async function getRevisionByNumber(
  db: D1Database,
  entityType: ContentEntityType,
  entityId: string,
  revisionNumber: number,
): Promise<ContentRevisionRecord | null> {
  return db
    .prepare(
      `
        SELECT r.id, r.entity_type, r.entity_id, r.revision_number,
               r.snapshot_json, r.change_summary, r.author_id, r.created_at,
               u.name AS author_name, u.email AS author_email
        FROM content_revisions r
        LEFT JOIN users u ON u.id = r.author_id
        WHERE r.entity_type = ? AND r.entity_id = ? AND r.revision_number = ?
      `,
    )
    .bind(entityType, entityId, revisionNumber)
    .first<ContentRevisionRecord>();
}

function parseSnapshot(revision: ContentRevisionRecord): RevisionSnapshot {
  try {
    return JSON.parse(revision.snapshot_json) as RevisionSnapshot;
  } catch {
    return {};
  }
}

export function compareRevisions(
  fromRevision: ContentRevisionRecord,
  toRevision: ContentRevisionRecord,
): RevisionCompareResult {
  const fromSnap = parseSnapshot(fromRevision);
  const toSnap = parseSnapshot(toRevision);
  const fields = new Set([...Object.keys(fromSnap), ...Object.keys(toSnap)]);
  const changed_fields: RevisionCompareResult["changed_fields"] = [];

  for (const field of fields) {
    const fromVal = fromSnap[field];
    const toVal = toSnap[field];
    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      changed_fields.push({ field, from: fromVal ?? null, to: toVal ?? null });
    }
  }

  return {
    from_revision: fromRevision.revision_number,
    to_revision: toRevision.revision_number,
    changed_fields,
  };
}

export async function restoreRevision(
  request: Request,
  env: Env,
  user: AuthUser,
  entityType: ContentEntityType,
  entityId: string,
  revisionId: string,
): Promise<{ restored: Record<string, unknown>; revision: ContentRevisionRecord }> {
  const revision = await getRevisionById(env.DB, entityType, entityId, revisionId);
  if (!revision) {
    throw new RevisionError("Revision not found", "not_found");
  }

  const snapshot = parseSnapshot(revision);
  const storage = resolveEntityStorage(entityType);

  const updatable = [
    "title",
    "slug",
    "excerpt",
    "content",
    "content_json",
    "content_html",
    "featured_image_id",
    "parent_id",
    "template",
    "seo_title",
    "seo_description",
    "category_id",
    "start_datetime",
    "end_datetime",
    "location_name",
    "location_address",
    "latitude",
    "longitude",
    "timezone",
    "event_status",
    "metadata_json",
  ];

  const sets: string[] = [];
  const values: unknown[] = [];

  for (const key of updatable) {
    if (key in snapshot) {
      sets.push(`${key} = ?`);
      values.push(snapshot[key] ?? null);
    }
  }

  if (sets.length === 0) {
    throw new RevisionError("Revision snapshot has no restorable fields", "validation");
  }

  sets.push("updated_at = datetime('now')");
  values.push(entityId);

  if (storage.isGeneric) {
    values.push(storage.contentType);
    await env.DB.prepare(
      `UPDATE content_entries SET ${sets.join(", ")} WHERE id = ? AND content_type = ?`,
    )
      .bind(...values)
      .run();

    const restored = await env.DB.prepare(
      `SELECT * FROM content_entries WHERE id = ? AND content_type = ?`,
    )
      .bind(entityId, storage.contentType)
      .first<Record<string, unknown>>();

    const newRevision = await createContentRevision(
      env.DB,
      entityType,
      entityId,
      user.id,
      `Restored from revision #${revision.revision_number}`,
    );

    const contentType = await getContentTypeByKey(env.DB, storage.contentType);
    if (restored && contentType) {
      await syncContentEntryToContentIndex(env.DB, restored as never, contentType);
    }

    await writeAuditLog(env.DB, {
      actorId: user.id,
      action: "restore",
      entityType,
      entityId,
      metadata: {
        restored_from_revision: revision.revision_number,
        restored_from_id: revision.id,
        new_revision: newRevision.revision_number,
      },
      ipAddress: getClientIp(request),
    });

    return { restored: restored!, revision: newRevision };
  }

  await env.DB.prepare(`UPDATE ${storage.table} SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  const restored = await env.DB.prepare(`SELECT * FROM ${storage.table} WHERE id = ?`)
    .bind(entityId)
    .first<Record<string, unknown>>();

  if (storage.table === "pages") {
    await syncPageToContentIndex(env.DB, restored as never);
  } else if (storage.table === "posts") {
    await syncPostToContentIndex(env.DB, restored as never);
  } else if (storage.table === "events") {
    await syncEventToContentIndex(env.DB, restored as never);
  }

  const newRevision = await createContentRevision(
    env.DB,
    entityType,
    entityId,
    user.id,
    `Restored from revision #${revision.revision_number}`,
  );

  await writeAuditLog(env.DB, {
    actorId: user.id,
    action: "restore",
    entityType,
    entityId,
    metadata: {
      restored_from_revision: revision.revision_number,
      restored_from_id: revision.id,
      new_revision: newRevision.revision_number,
    },
    ipAddress: getClientIp(request),
  });

  return { restored: restored!, revision: newRevision };
}
