import { isLegacyContentType } from "../content-entries/registry";

export type ContentEntityType = string;

const LEGACY_TABLE_MAP: Record<string, "pages" | "posts" | "events" | "forms"> = {
  page: "pages",
  post: "posts",
  event: "events",
  form: "forms",
};

export type EntityStorage =
  | { table: "pages" | "posts" | "events" | "forms"; isGeneric: false }
  | { table: "content_entries"; isGeneric: true; contentType: string };

export function resolveEntityStorage(entityType: ContentEntityType): EntityStorage {
  const legacy = LEGACY_TABLE_MAP[entityType];
  if (legacy) {
    return { table: legacy, isGeneric: false };
  }
  return { table: "content_entries", isGeneric: true, contentType: entityType };
}

/** @deprecated Use resolveEntityStorage for generic content support */
export function entityTypeToTable(
  entityType: ContentEntityType,
): "pages" | "posts" | "events" | "forms" | "content_entries" {
  const storage = resolveEntityStorage(entityType);
  return storage.table;
}

export function isGenericEntityType(entityType: ContentEntityType): boolean {
  return !isLegacyContentType(entityType);
}

export function tableToEntityType(
  table: "pages" | "posts" | "events" | "forms",
): ContentEntityType {
  switch (table) {
    case "pages":
      return "page";
    case "posts":
      return "post";
    case "events":
      return "event";
    case "forms":
      return "form";
  }
}

export function contentStatusForWorkflowState(state: WorkflowState): string {
  switch (state) {
    case "scheduled":
      return "scheduled";
    case "published":
      return "published";
    case "archived":
      return "archived";
    default:
      return "draft";
  }
}

export type WorkflowState =
  | "draft"
  | "in_review"
  | "approved"
  | "scheduled"
  | "published"
  | "archived";

export type WorkflowAction =
  | "submit"
  | "approve"
  | "reject"
  | "publish"
  | "schedule"
  | "archive";

export const WORKFLOW_STATE_LABELS: Record<WorkflowState, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

export interface WorkflowStateRecord {
  id: string;
  entity_type: ContentEntityType;
  entity_id: string;
  state: WorkflowState;
  scheduled_at: string | null;
  assigned_reviewer_id: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface WorkflowHistoryRecord {
  id: string;
  entity_type: ContentEntityType;
  entity_id: string;
  from_state: WorkflowState | null;
  to_state: WorkflowState;
  action: WorkflowAction;
  comment: string | null;
  actor_id: string | null;
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
}

export interface WorkflowUpdateInput {
  action: WorkflowAction;
  comment?: string | null;
  scheduled_at?: string | null;
}
