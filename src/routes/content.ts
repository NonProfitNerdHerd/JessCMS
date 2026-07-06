import { isAuthUser, requireAuth, requirePermission } from "../auth";
import {
  createEvent,
  createPage,
  createPost,
  deleteContent,
  getContentById,
  getContentBySlug,
  listContent,
  needsPublishPermission,
  NotFoundError,
  readJsonBody,
  updateEvent,
  updatePage,
  updatePost,
  ValidationError,
  type ContentRecord,
  type EventRecord,
  type PostRecord,
} from "../content/repository";
import {
  badRequest,
  created,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
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
    if (!authResult.permissions.some((p) =>
      ["content:publish", "content.publish"].includes(p),
    )) {
      return forbidden("Missing permission: content:publish");
    }
  }

  return authResult;
}

function handleContentError(error: unknown): Response {
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

function createContentHandlers<T extends ContentRecord>(
  table: "pages" | "posts" | "events",
) {
  return {
    list: async (request: Request, env: Env): Promise<Response> => {
      try {
        const result = await listContent<T>(request, env, table);
        return ok({ ...result, data: result.items });
      } catch (error) {
        return handleContentError(error);
      }
    },

    getById: async (
      request: Request,
      env: Env,
      params: Record<string, string>,
    ): Promise<Response> => {
      try {
        const item = await getContentById<T>(request, env, table, params.id);
        if (!item) {
          return notFound();
        }
        return ok(item);
      } catch (error) {
        return handleContentError(error);
      }
    },

    getBySlug: async (
      request: Request,
      env: Env,
      params: Record<string, string>,
    ): Promise<Response> => {
      try {
        const item = await getContentBySlug<T>(request, env, table, params.slug);
        if (!item) {
          return notFound();
        }
        return ok(item);
      } catch (error) {
        return handleContentError(error);
      }
    },

    remove: async (
      request: Request,
      env: Env,
      params: Record<string, string>,
    ): Promise<Response> => {
      try {
        const authResult = await ensureWritePermissions(request, env, "delete");
        if (!isAuthUser(authResult)) {
          return authResult;
        }

        await deleteContent(request, env, authResult, table, params.id);
        return ok({ deleted: true, id: params.id });
      } catch (error) {
        return handleContentError(error);
      }
    },
  };
}

const pageHandlers = createContentHandlers<ContentRecord>("pages");
const postHandlers = createContentHandlers<PostRecord>("posts");
const eventHandlers = createContentHandlers<EventRecord>("events");

export async function handleListPages(request: Request, env: Env): Promise<Response> {
  return pageHandlers.list(request, env);
}

export async function handleGetPageById(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  return pageHandlers.getById(request, env, params);
}

export async function handleGetPageBySlug(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  return pageHandlers.getBySlug(request, env, params);
}

export async function handleCreatePage(request: Request, env: Env): Promise<Response> {
  try {
    const body = await readJsonBody<Record<string, unknown>>(request);
    const authResult = await ensureWritePermissions(
      request,
      env,
      "create",
      body as { status?: string },
    );
    if (!isAuthUser(authResult)) {
      return authResult;
    }

    const page = await createPage(request, env, authResult, body);
    return created(page);
  } catch (error) {
    return handleContentError(error);
  }
}

export async function handleUpdatePage(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const body = await readJsonBody<Record<string, unknown>>(request);
    const authResult = await ensureWritePermissions(
      request,
      env,
      "update",
      body as { status?: string },
    );
    if (!isAuthUser(authResult)) {
      return authResult;
    }

    const page = await updatePage(request, env, authResult, params.id, body);
    return ok(page);
  } catch (error) {
    return handleContentError(error);
  }
}

export async function handleDeletePage(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  return pageHandlers.remove(request, env, params);
}

export async function handleListPosts(request: Request, env: Env): Promise<Response> {
  return postHandlers.list(request, env);
}

export async function handleGetPostById(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  return postHandlers.getById(request, env, params);
}

export async function handleGetPostBySlug(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  return postHandlers.getBySlug(request, env, params);
}

export async function handleCreatePost(request: Request, env: Env): Promise<Response> {
  try {
    const body = await readJsonBody<Record<string, unknown>>(request);
    const authResult = await ensureWritePermissions(
      request,
      env,
      "create",
      body as { status?: string },
    );
    if (!isAuthUser(authResult)) {
      return authResult;
    }

    const post = await createPost(request, env, authResult, body);
    return created(post);
  } catch (error) {
    return handleContentError(error);
  }
}

export async function handleUpdatePost(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const body = await readJsonBody<Record<string, unknown>>(request);
    const authResult = await ensureWritePermissions(
      request,
      env,
      "update",
      body as { status?: string },
    );
    if (!isAuthUser(authResult)) {
      return authResult;
    }

    const post = await updatePost(request, env, authResult, params.id, body);
    return ok(post);
  } catch (error) {
    return handleContentError(error);
  }
}

export async function handleDeletePost(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  return postHandlers.remove(request, env, params);
}

export async function handleListEvents(request: Request, env: Env): Promise<Response> {
  return eventHandlers.list(request, env);
}

export async function handleGetEventById(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  return eventHandlers.getById(request, env, params);
}

export async function handleGetEventBySlug(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  return eventHandlers.getBySlug(request, env, params);
}

export async function handleCreateEvent(request: Request, env: Env): Promise<Response> {
  try {
    const body = await readJsonBody<Record<string, unknown>>(request);
    const authResult = await ensureWritePermissions(
      request,
      env,
      "create",
      body as { status?: string },
    );
    if (!isAuthUser(authResult)) {
      return authResult;
    }

    const event = await createEvent(request, env, authResult, body);
    return created(event);
  } catch (error) {
    return handleContentError(error);
  }
}

export async function handleUpdateEvent(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const body = await readJsonBody<Record<string, unknown>>(request);
    const authResult = await ensureWritePermissions(
      request,
      env,
      "update",
      body as { status?: string },
    );
    if (!isAuthUser(authResult)) {
      return authResult;
    }

    const event = await updateEvent(request, env, authResult, params.id, body);
    return ok(event);
  } catch (error) {
    return handleContentError(error);
  }
}

export async function handleDeleteEvent(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  return eventHandlers.remove(request, env, params);
}
