import { isAuthUser, requirePermission } from "../auth";
import {
  compareRevisions,
  getRevisionById,
  getRevisionByNumber,
  listRevisions,
  restoreRevision,
  RevisionError,
} from "../revisions/repository";
import {
  ensureWorkflowState,
  listWorkflowHistory,
  transitionWorkflow,
  WorkflowError,
} from "../workflow/repository";
import {
  tableToEntityType,
  type ContentEntityType,
  WORKFLOW_STATE_LABELS,
} from "../workflow/types";
import {
  badRequest,
  notFound,
  ok,
  serverError,
} from "../lib/response";

type ContentTable = "pages" | "posts" | "events";

function entityType(table: ContentTable): ContentEntityType {
  return tableToEntityType(table);
}

function handleWorkflowError(error: unknown): Response {
  if (error instanceof WorkflowError) {
    if (error.code === "not_found") return notFound();
    return badRequest(error.message, error.details);
  }
  if (error instanceof Response) return error;
  console.error(error);
  return serverError();
}

function handleRevisionError(error: unknown): Response {
  if (error instanceof RevisionError) {
    if (error.code === "not_found") return notFound();
    return badRequest(error.message, error.details);
  }
  if (error instanceof Response) return error;
  console.error(error);
  return serverError();
}

export function createWorkflowHandlers(table: ContentTable) {
  const type = entityType(table);

  return {
    getWorkflow: async (
      request: Request,
      env: Env,
      params: Record<string, string>,
    ): Promise<Response> => {
      try {
        const authResult = await requirePermission(request, env, "content:read");
        if (!isAuthUser(authResult)) return authResult;

        const state = await ensureWorkflowState(env.DB, type, params.id);
        const history = await listWorkflowHistory(env.DB, type, params.id);

        return ok({
          state,
          state_label: WORKFLOW_STATE_LABELS[state.state],
          history,
        });
      } catch (error) {
        return handleWorkflowError(error);
      }
    },

    updateWorkflow: async (
      request: Request,
      env: Env,
      params: Record<string, string>,
    ): Promise<Response> => {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          action?: string;
          comment?: string;
          scheduled_at?: string;
        };

        if (!body.action) {
          return badRequest("action is required");
        }

        const permissionMap: Record<string, string> = {
          submit: "workflow:submit",
          approve: "workflow:approve",
          reject: "workflow:approve",
          publish: "workflow:publish",
          schedule: "workflow:publish",
          archive: "workflow:publish",
        };

        const permission = permissionMap[body.action];
        if (!permission) {
          return badRequest("Invalid workflow action", [body.action]);
        }

        const authResult = await requirePermission(request, env, permission);
        if (!isAuthUser(authResult)) return authResult;

        const result = await transitionWorkflow(
          request,
          env,
          authResult,
          type,
          params.id,
          {
            action: body.action as import("../workflow/types").WorkflowAction,
            comment: body.comment,
            scheduled_at: body.scheduled_at,
          },
        );

        return ok({
          state: result.state,
          state_label: WORKFLOW_STATE_LABELS[result.state.state],
          history_entry: result.history,
        });
      } catch (error) {
        return handleWorkflowError(error);
      }
    },
  };
}

export function createRevisionHandlers(table: ContentTable) {
  const type = entityType(table);

  return {
    listRevisions: async (
      request: Request,
      env: Env,
      params: Record<string, string>,
    ): Promise<Response> => {
      try {
        const authResult = await requirePermission(request, env, "revisions:read");
        if (!isAuthUser(authResult)) return authResult;

        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
        const offset = Number(url.searchParams.get("offset") ?? 0);

        const result = await listRevisions(env.DB, type, params.id, limit, offset);
        const items = result.items.map((item) => ({
          id: item.id,
          revision_number: item.revision_number,
          change_summary: item.change_summary,
          author_id: item.author_id,
          author_name: item.author_name,
          author_email: item.author_email,
          created_at: item.created_at,
        }));

        return ok({ ...result, items, data: items });
      } catch (error) {
        return handleRevisionError(error);
      }
    },

    getRevision: async (
      request: Request,
      env: Env,
      params: Record<string, string>,
    ): Promise<Response> => {
      try {
        const authResult = await requirePermission(request, env, "revisions:read");
        if (!isAuthUser(authResult)) return authResult;

        const revision = await getRevisionById(
          env.DB,
          type,
          params.id,
          params.revisionId,
        );
        if (!revision) return notFound();

        return ok({
          ...revision,
          snapshot: JSON.parse(revision.snapshot_json),
        });
      } catch (error) {
        return handleRevisionError(error);
      }
    },

    compareRevisions: async (
      request: Request,
      env: Env,
      params: Record<string, string>,
    ): Promise<Response> => {
      try {
        const authResult = await requirePermission(request, env, "revisions:read");
        if (!isAuthUser(authResult)) return authResult;

        const url = new URL(request.url);
        const fromNum = Number(url.searchParams.get("from"));
        const toNum = Number(url.searchParams.get("to"));

        if (!fromNum || !toNum) {
          return badRequest("from and to revision numbers are required");
        }

        const fromRevision = await getRevisionByNumber(
          env.DB,
          type,
          params.id,
          fromNum,
        );
        const toRevision = await getRevisionByNumber(
          env.DB,
          type,
          params.id,
          toNum,
        );

        if (!fromRevision || !toRevision) {
          return notFound();
        }

        return ok(compareRevisions(fromRevision, toRevision));
      } catch (error) {
        return handleRevisionError(error);
      }
    },

    restoreRevision: async (
      request: Request,
      env: Env,
      params: Record<string, string>,
    ): Promise<Response> => {
      try {
        const authResult = await requirePermission(request, env, "revisions:restore");
        if (!isAuthUser(authResult)) return authResult;

        const result = await restoreRevision(
          request,
          env,
          authResult,
          type,
          params.id,
          params.revisionId,
        );

        return ok(result);
      } catch (error) {
        return handleRevisionError(error);
      }
    },
  };
}

const pageWorkflow = createWorkflowHandlers("pages");
const postWorkflow = createWorkflowHandlers("posts");
const eventWorkflow = createWorkflowHandlers("events");

const pageRevisions = createRevisionHandlers("pages");
const postRevisions = createRevisionHandlers("posts");
const eventRevisions = createRevisionHandlers("events");

export const handleGetPageWorkflow = pageWorkflow.getWorkflow;
export const handleUpdatePageWorkflow = pageWorkflow.updateWorkflow;
export const handleListPageRevisions = pageRevisions.listRevisions;
export const handleGetPageRevision = pageRevisions.getRevision;
export const handleComparePageRevisions = pageRevisions.compareRevisions;
export const handleRestorePageRevision = pageRevisions.restoreRevision;

export const handleGetPostWorkflow = postWorkflow.getWorkflow;
export const handleUpdatePostWorkflow = postWorkflow.updateWorkflow;
export const handleListPostRevisions = postRevisions.listRevisions;
export const handleGetPostRevision = postRevisions.getRevision;
export const handleComparePostRevisions = postRevisions.compareRevisions;
export const handleRestorePostRevision = postRevisions.restoreRevision;

export const handleGetEventWorkflow = eventWorkflow.getWorkflow;
export const handleUpdateEventWorkflow = eventWorkflow.updateWorkflow;
export const handleListEventRevisions = eventRevisions.listRevisions;
export const handleGetEventRevision = eventRevisions.getRevision;
export const handleCompareEventRevisions = eventRevisions.compareRevisions;
export const handleRestoreEventRevision = eventRevisions.restoreRevision;
