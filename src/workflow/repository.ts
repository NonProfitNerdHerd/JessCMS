import type { AuthUser } from "../auth";
import { userHasPermission } from "../auth";
import { generateId } from "../lib/crypto";
import { getClientIp, writeAuditLog } from "../db/audit";
import {
  contentStatusForWorkflowState,
  entityTypeToTable,
  type ContentEntityType,
  type WorkflowAction,
  type WorkflowHistoryRecord,
  type WorkflowState,
  type WorkflowStateRecord,
  type WorkflowUpdateInput,
} from "./types";

export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "invalid_transition" | "validation",
    public readonly details?: string[],
  ) {
    super(message);
  }
}

const TRANSITIONS: Record<
  WorkflowAction,
  { from: WorkflowState[]; to: WorkflowState; permission: string }
> = {
  submit: { from: ["draft"], to: "in_review", permission: "workflow:submit" },
  approve: { from: ["in_review"], to: "approved", permission: "workflow:approve" },
  reject: { from: ["in_review"], to: "draft", permission: "workflow:approve" },
  publish: { from: ["approved", "draft"], to: "published", permission: "workflow:publish" },
  schedule: { from: ["approved", "draft"], to: "scheduled", permission: "workflow:publish" },
  archive: {
    from: ["draft", "in_review", "approved", "scheduled", "published"],
    to: "archived",
    permission: "workflow:publish",
  },
};

export async function ensureWorkflowState(
  db: D1Database,
  entityType: ContentEntityType,
  entityId: string,
  initialState: WorkflowState = "draft",
): Promise<WorkflowStateRecord> {
  const existing = await getWorkflowState(db, entityType, entityId);
  if (existing) {
    return existing;
  }

  const id = generateId("wfs");
  await db
    .prepare(
      `
        INSERT INTO workflow_states (id, entity_type, entity_id, state)
        VALUES (?, ?, ?, ?)
      `,
    )
    .bind(id, entityType, entityId, initialState)
    .run();

  return (await getWorkflowState(db, entityType, entityId))!;
}

export async function getWorkflowState(
  db: D1Database,
  entityType: ContentEntityType,
  entityId: string,
): Promise<WorkflowStateRecord | null> {
  return db
    .prepare(
      `
        SELECT id, entity_type, entity_id, state, scheduled_at,
               assigned_reviewer_id, notes, updated_by, updated_at
        FROM workflow_states
        WHERE entity_type = ? AND entity_id = ?
      `,
    )
    .bind(entityType, entityId)
    .first<WorkflowStateRecord>();
}

export async function listWorkflowHistory(
  db: D1Database,
  entityType: ContentEntityType,
  entityId: string,
  limit = 50,
): Promise<WorkflowHistoryRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT h.id, h.entity_type, h.entity_id, h.from_state, h.to_state,
               h.action, h.comment, h.actor_id, h.created_at,
               u.name AS actor_name, u.email AS actor_email
        FROM workflow_history h
        LEFT JOIN users u ON u.id = h.actor_id
        WHERE h.entity_type = ? AND h.entity_id = ?
        ORDER BY h.created_at DESC
        LIMIT ?
      `,
    )
    .bind(entityType, entityId, limit)
    .all<WorkflowHistoryRecord>();

  return result.results ?? [];
}

async function contentExists(
  db: D1Database,
  entityType: ContentEntityType,
  entityId: string,
): Promise<boolean> {
  const table = entityTypeToTable(entityType);
  const row = await db
    .prepare(`SELECT id FROM ${table} WHERE id = ?`)
    .bind(entityId)
    .first<{ id: string }>();
  return Boolean(row);
}

async function syncContentStatus(
  db: D1Database,
  entityType: ContentEntityType,
  entityId: string,
  state: WorkflowState,
  scheduledAt?: string | null,
): Promise<void> {
  const table = entityTypeToTable(entityType);
  const status = contentStatusForWorkflowState(state);
  const sets = ["status = ?", "updated_at = datetime('now')"];
  const values: unknown[] = [status];

  if (state === "published") {
    sets.push("published_at = COALESCE(published_at, datetime('now'))");
  } else if (state === "scheduled" && scheduledAt) {
    sets.push("published_at = ?");
    values.push(scheduledAt);
  } else if (state === "draft" || state === "in_review" || state === "approved") {
    sets.push("published_at = NULL");
  }

  values.push(entityId);
  await db
    .prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
}

export async function transitionWorkflow(
  request: Request,
  env: Env,
  user: AuthUser,
  entityType: ContentEntityType,
  entityId: string,
  input: WorkflowUpdateInput,
): Promise<{ state: WorkflowStateRecord; history: WorkflowHistoryRecord }> {
  if (!(await contentExists(env.DB, entityType, entityId))) {
    throw new WorkflowError("Content not found", "not_found");
  }

  const rule = TRANSITIONS[input.action];
  if (!rule) {
    throw new WorkflowError("Unknown workflow action", "validation", [input.action]);
  }

  if (!userHasPermission(user.permissions, rule.permission)) {
    throw new WorkflowError(`Missing permission: ${rule.permission}`, "validation");
  }

  if (input.action === "schedule" && !input.scheduled_at?.trim()) {
    throw new WorkflowError("scheduled_at is required for schedule action", "validation");
  }

  const current = await ensureWorkflowState(env.DB, entityType, entityId);
  if (!rule.from.includes(current.state)) {
    throw new WorkflowError(
      `Cannot ${input.action} from state "${current.state}"`,
      "invalid_transition",
      [`Allowed from: ${rule.from.join(", ")}`],
    );
  }

  const nextState = rule.to;
  const scheduledAt =
    input.action === "schedule" ? input.scheduled_at!.trim() : current.scheduled_at;

  await env.DB
    .prepare(
      `
        UPDATE workflow_states
        SET state = ?,
            scheduled_at = ?,
            notes = COALESCE(?, notes),
            updated_by = ?,
            updated_at = datetime('now')
        WHERE entity_type = ? AND entity_id = ?
      `,
    )
    .bind(
      nextState,
      nextState === "scheduled" ? scheduledAt : null,
      input.comment ?? null,
      user.id,
      entityType,
      entityId,
    )
    .run();

  await syncContentStatus(env.DB, entityType, entityId, nextState, scheduledAt);

  const historyId = generateId("wfh");
  await env.DB
    .prepare(
      `
        INSERT INTO workflow_history (
          id, entity_type, entity_id, from_state, to_state, action, comment, actor_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      historyId,
      entityType,
      entityId,
      current.state,
      nextState,
      input.action,
      input.comment ?? null,
      user.id,
    )
    .run();

  const auditAction =
    input.action === "approve"
      ? "approve"
      : input.action === "reject"
        ? "reject"
        : input.action === "publish" || input.action === "schedule"
          ? "publish"
          : "update";

  await writeAuditLog(env.DB, {
    actorId: user.id,
    action: auditAction,
    entityType,
    entityId,
    metadata: {
      workflow_action: input.action,
      from_state: current.state,
      to_state: nextState,
      comment: input.comment ?? null,
    },
    ipAddress: getClientIp(request),
  });

  const state = (await getWorkflowState(env.DB, entityType, entityId))!;
  const history = await env.DB
    .prepare(
      `
        SELECT h.id, h.entity_type, h.entity_id, h.from_state, h.to_state,
               h.action, h.comment, h.actor_id, h.created_at,
               u.name AS actor_name, u.email AS actor_email
        FROM workflow_history h
        LEFT JOIN users u ON u.id = h.actor_id
        WHERE h.id = ?
      `,
    )
    .bind(historyId)
    .first<WorkflowHistoryRecord>();

  return { state, history: history! };
}

export function workflowStateFromContentStatus(status: string): WorkflowState {
  switch (status) {
    case "published":
      return "published";
    case "scheduled":
      return "scheduled";
    case "archived":
      return "archived";
    default:
      return "draft";
  }
}
