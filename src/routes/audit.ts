import { isAuthUser, requirePermission } from "../auth";
import { getAuditLogs } from "../db/audit";
import { ok, serverError } from "../lib/response";

export async function handleListAuditLogs(request: Request, env: Env): Promise<Response> {
  const authResult = await requirePermission(request, env, "audit:read");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const url = new URL(request.url);
    const result = await getAuditLogs(env.DB, {
      actor_id: url.searchParams.get("actor_id") ?? undefined,
      action: url.searchParams.get("action") ?? undefined,
      entity_type: url.searchParams.get("entity_type") ?? undefined,
      q: url.searchParams.get("q")?.trim() || undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50),
      offset: Number(url.searchParams.get("offset") ?? 0),
    });

    return ok({
      items: result.items,
      total: result.total,
      limit: Number(url.searchParams.get("limit") ?? 50),
      offset: Number(url.searchParams.get("offset") ?? 0),
    });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
