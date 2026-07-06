import { ok } from "../lib/response";
import { CONTENT_TYPES } from "../foundation/registry";

export async function handleContentTypes(_env: Env): Promise<Response> {
  return ok({
    items: CONTENT_TYPES,
    count: CONTENT_TYPES.length,
  });
}
