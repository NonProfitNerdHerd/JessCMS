import { generateId } from "../lib/crypto";

export type AuditAction =
  | "create"
  | "update"
  | "publish"
  | "delete"
  | "approve"
  | "reject"
  | "restore"
  | "login"
  | "login_failed"
  | "logout"
  | "disable"
  | "enable"
  | "reset_password"
  | "rebuild";

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata_json: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  actor_id?: string;
  action?: string;
  entity_type?: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

const SENSITIVE_METADATA_KEYS = new Set([
  "password",
  "password_hash",
  "new_password",
  "current_password",
  "token",
  "session",
  "session_token",
]);

export function sanitizeAuditMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEYS.has(key.toLowerCase())) continue;
    clean[key] = value;
  }
  return clean;
}

export async function writeAuditLog(
  db: D1Database,
  input: {
    actorId: string | null;
    action: AuditAction | string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
  },
): Promise<void> {
  const metadata = sanitizeAuditMetadata(input.metadata);

  await db
    .prepare(
      `
        INSERT INTO audit_log (
          id,
          actor_id,
          action,
          entity_type,
          entity_id,
          metadata_json,
          ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      generateId("aud"),
      input.actorId,
      input.action,
      input.entityType,
      input.entityId,
      metadata ? JSON.stringify(metadata) : null,
      input.ipAddress ?? null,
    )
    .run();
}

export async function getAuditLogs(
  db: D1Database,
  filters: AuditLogFilters,
): Promise<{ items: AuditLogEntry[]; total: number }> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.actor_id) {
    conditions.push("a.actor_id = ?");
    values.push(filters.actor_id);
  }
  if (filters.action) {
    conditions.push("a.action = ?");
    values.push(filters.action);
  }
  if (filters.entity_type) {
    conditions.push("a.entity_type = ?");
    values.push(filters.entity_type);
  }
  if (filters.from) {
    conditions.push("a.created_at >= ?");
    values.push(filters.from);
  }
  if (filters.to) {
    conditions.push("a.created_at <= ?");
    values.push(filters.to);
  }
  if (filters.q) {
    conditions.push(
      "(INSTR(LOWER(COALESCE(a.metadata_json, '')), LOWER(?)) > 0 OR INSTR(LOWER(COALESCE(a.entity_id, '')), LOWER(?)) > 0)",
    );
    values.push(filters.q, filters.q);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM audit_log a ${where}`)
    .bind(...values)
    .first<{ total: number }>();

  const result = await db
    .prepare(
      `
        SELECT
          a.id,
          a.actor_id,
          u.email AS actor_email,
          u.name AS actor_name,
          a.action,
          a.entity_type,
          a.entity_id,
          a.metadata_json,
          a.ip_address,
          a.created_at
        FROM audit_log a
        LEFT JOIN users u ON u.id = a.actor_id
        ${where}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `,
    )
    .bind(...values, limit, offset)
    .all<AuditLogEntry>();

  const items = (result.results ?? []).map((row) => {
    let metadata: Record<string, unknown> | null = null;
    if (row.metadata_json) {
      try {
        metadata = JSON.parse(row.metadata_json) as Record<string, unknown>;
      } catch {
        metadata = null;
      }
    }
    return {
      ...row,
      metadata,
    };
  });

  return {
    items,
    total: countRow?.total ?? 0,
  };
}

export async function countRecentFailedLogins(
  db: D1Database,
  ipAddress: string,
  windowMinutes = 15,
): Promise<number> {
  const result = await db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM audit_log
        WHERE action = 'login_failed'
          AND ip_address = ?
          AND created_at >= datetime('now', ?)
      `,
    )
    .bind(ipAddress, `-${windowMinutes} minutes`)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

export function getClientIp(request: Request): string | null {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    null
  );
}

export function resolveAuditAction(
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined,
  defaultAction: AuditAction,
): AuditAction {
  if (
    nextStatus &&
    (nextStatus === "published" || nextStatus === "scheduled") &&
    previousStatus !== nextStatus
  ) {
    return "publish";
  }

  return defaultAction;
}
