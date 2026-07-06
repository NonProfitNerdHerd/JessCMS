import { generateId } from "../lib/crypto";

export type AuditAction =
  | "create"
  | "update"
  | "publish"
  | "delete"
  | "approve"
  | "reject"
  | "restore";

export async function writeAuditLog(
  db: D1Database,
  input: {
    actorId: string | null;
    action: AuditAction;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
  },
): Promise<void> {
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
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.ipAddress ?? null,
    )
    .run();
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
