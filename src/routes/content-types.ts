import { listContentTypes } from "../content-types/registry";
import { CONTENT_TYPES } from "../foundation/registry";
import { ok } from "../lib/response";

export async function handleContentTypes(env: Env): Promise<Response> {
  try {
    const items = await listContentTypes(env.DB, { enabledOnly: false });
    if (items.length > 0) {
      return ok({ items, count: items.length, source: "database" });
    }
  } catch {
    // Fall back to legacy in-memory registry if migration not applied yet.
  }

  return ok({
    items: CONTENT_TYPES,
    count: CONTENT_TYPES.length,
    source: "legacy",
  });
}

export async function handleAdminContentTypes(env: Env): Promise<Response> {
  const items = await listContentTypes(env.DB, { enabledOnly: true });
  return ok({ items, count: items.length });
}
