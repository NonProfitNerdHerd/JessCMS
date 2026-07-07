import { isAuthUser, requireAuth } from "../auth";
import { getClientIp, writeAuditLog } from "../db/audit";
import { rebuildIndex, searchAdmin, searchPublic } from "../search";
import { badRequest, ok, serverError } from "../lib/response";

function parseSearchParams(url: URL, admin = false) {
  const q = url.searchParams.get("q")?.trim() ?? "";
  const content_type = url.searchParams.get("content_type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const plugin_id = url.searchParams.get("plugin_id") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const include_media =
    admin && (url.searchParams.get("include_media") === "1" ||
      url.searchParams.get("include_media") === "true");

  return { q, content_type, status, plugin_id, limit, offset, include_media };
}

export async function handlePublicSearch(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = parseSearchParams(url);

    if (!params.q) {
      return ok({ items: [], total: 0, q: "", limit: params.limit, offset: params.offset });
    }

    const result = await searchPublic(env.DB, params);
    return ok({
      ...result,
      q: params.q,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}

export async function handleAdminSearch(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (!isAuthUser(authResult)) {
    return authResult;
  }

  try {
    const url = new URL(request.url);
    const params = parseSearchParams(url, true);

    if (!params.q) {
      return ok({ items: [], total: 0, q: "", limit: params.limit, offset: params.offset });
    }

    const result = await searchAdmin(env.DB, params);
    return ok({
      ...result,
      q: params.q,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}

export async function handleRebuildSearchIndex(
  request: Request,
  env: Env,
): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (!isAuthUser(authResult)) {
    return authResult;
  }

  if (request.method !== "POST") {
    return badRequest("Method not allowed");
  }

  try {
    let includeForms = true;
    let includeMedia = true;
    try {
      const body = (await request.json()) as {
        include_forms?: boolean;
        include_media?: boolean;
      };
      if (body.include_forms === false) includeForms = false;
      if (body.include_media === false) includeMedia = false;
    } catch {
      // empty body is fine
    }

    const result = await rebuildIndex(env.DB, { includeForms, includeMedia });

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "rebuild",
      entityType: "search_index",
      entityId: "global",
      metadata: {
        indexed: result.indexed,
        include_forms: includeForms,
        include_media: includeMedia,
      },
      ipAddress: getClientIp(request),
    });

    return ok({ rebuilt: true, indexed: result.indexed });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
