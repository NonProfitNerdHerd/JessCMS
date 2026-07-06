import { isAuthUser, requirePermission } from "../auth";
import {
  ContentTypeAccessError,
  createContentEntry,
  deleteContentEntry,
  getContentEntryById,
  getContentEntryBySlug,
  listContentEntries,
  needsPublishPermission,
  NotFoundError,
  readJsonBody,
  updateContentEntry,
  ValidationError,
  type ContentEntryInput,
} from "../content-entries/repository";
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
  WORKFLOW_STATE_LABELS,
  type ContentEntityType,
  type WorkflowAction,
} from "../workflow/types";
import {
  badRequest,
  created,
  forbidden,
  notFound,
  ok,
  serverError,
} from "../lib/response";

async function ensureWritePermissions(
  request: Request,
  env: Env,
  action: "create" | "update" | "delete",
  input?: { status?: string },
): Promise<import("../auth").AuthUser | Response> {
  const permissionMap = {
    create: "content:create",
    update: "content:update",
    delete: "content:delete",
  } as const;

  const authResult = await requirePermission(request, env, permissionMap[action]);
  if (!isAuthUser(authResult)) {
    return authResult;
  }

  if (input && needsPublishPermission(input)) {
    if (
      !authResult.permissions.some((p) =>
        ["content:publish", "content.publish"].includes(p),
      )
    ) {
      return forbidden("Missing permission: content:publish");
    }
  }

  return authResult;
}

function handleContentError(error: unknown): Response {
  if (error instanceof ContentTypeAccessError) {
    if (error.code === "not_found") return notFound();
    if (error.code === "disabled") return badRequest(error.message);
    return badRequest(error.message);
  }
  if (error instanceof ValidationError) {
    return badRequest("Validation failed", error.errors);
  }
  if (error instanceof NotFoundError) {
    return notFound();
  }
  if (error instanceof Response) {
    return error;
  }
  console.error(error);
  return serverError();
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

function contentTypeFromParams(params: Record<string, string>): string {
  return params.contentType;
}

export async function handleListGenericContent(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const result = await listContentEntries(
      request,
      env,
      contentTypeFromParams(params),
    );
    return ok({ ...result, data: result.items });
  } catch (error) {
    return handleContentError(error);
  }
}

export async function handleGetGenericContentById(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const item = await getContentEntryById(
      request,
      env,
      contentTypeFromParams(params),
      params.id,
    );
    if (!item) {
      return notFound();
    }
    return ok(item);
  } catch (error) {
    return handleContentError(error);
  }
}

export async function handleGetGenericContentBySlug(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const item = await getContentEntryBySlug(
      request,
      env,
      contentTypeFromParams(params),
      params.slug,
    );
    if (!item) {
      return notFound();
    }
    return ok(item);
  } catch (error) {
    return handleContentError(error);
  }
}

export async function handleCreateGenericContent(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const body = await readJsonBody<ContentEntryInput>(request);
    const authResult = await ensureWritePermissions(request, env, "create", body);
    if (!isAuthUser(authResult)) {
      return authResult;
    }

    const entry = await createContentEntry(
      request,
      env,
      authResult,
      contentTypeFromParams(params),
      body,
    );
    return created(entry);
  } catch (error) {
    return handleContentError(error);
  }
}

export async function handleUpdateGenericContent(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const body = await readJsonBody<ContentEntryInput>(request);
    const authResult = await ensureWritePermissions(request, env, "update", body);
    if (!isAuthUser(authResult)) {
      return authResult;
    }

    const entry = await updateContentEntry(
      request,
      env,
      authResult,
      contentTypeFromParams(params),
      params.id,
      body,
    );
    return ok(entry);
  } catch (error) {
    return handleContentError(error);
  }
}

export async function handleDeleteGenericContent(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const authResult = await ensureWritePermissions(request, env, "delete");
    if (!isAuthUser(authResult)) {
      return authResult;
    }

    await deleteContentEntry(
      request,
      env,
      authResult,
      contentTypeFromParams(params),
      params.id,
    );
    return ok({ deleted: true, id: params.id });
  } catch (error) {
    return handleContentError(error);
  }
}

function entityType(params: Record<string, string>): ContentEntityType {
  return contentTypeFromParams(params);
}

export async function handleGetGenericWorkflow(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const authResult = await requirePermission(request, env, "content:read");
    if (!isAuthUser(authResult)) return authResult;

    const type = entityType(params);
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
}

export async function handleUpdateGenericWorkflow(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
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
      entityType(params),
      params.id,
      {
        action: body.action as WorkflowAction,
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
}

export async function handleListGenericRevisions(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const authResult = await requirePermission(request, env, "revisions:read");
    if (!isAuthUser(authResult)) return authResult;

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    const result = await listRevisions(
      env.DB,
      entityType(params),
      params.id,
      limit,
      offset,
    );
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
}

export async function handleGetGenericRevision(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const authResult = await requirePermission(request, env, "revisions:read");
    if (!isAuthUser(authResult)) return authResult;

    const revision = await getRevisionById(
      env.DB,
      entityType(params),
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
}

export async function handleCompareGenericRevisions(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const authResult = await requirePermission(request, env, "revisions:read");
    if (!isAuthUser(authResult)) return authResult;

    const url = new URL(request.url);
    const fromNum = Number(url.searchParams.get("from"));
    const toNum = Number(url.searchParams.get("to"));

    if (!fromNum || !toNum) {
      return badRequest("from and to revision numbers are required");
    }

    const type = entityType(params);
    const fromRevision = await getRevisionByNumber(env.DB, type, params.id, fromNum);
    const toRevision = await getRevisionByNumber(env.DB, type, params.id, toNum);

    if (!fromRevision || !toRevision) {
      return notFound();
    }

    return ok(compareRevisions(fromRevision, toRevision));
  } catch (error) {
    return handleRevisionError(error);
  }
}

export async function handleRestoreGenericRevision(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const authResult = await requirePermission(request, env, "revisions:restore");
    if (!isAuthUser(authResult)) return authResult;

    const result = await restoreRevision(
      request,
      env,
      authResult,
      entityType(params),
      params.id,
      params.revisionId,
    );

    return ok(result);
  } catch (error) {
    return handleRevisionError(error);
  }
}
