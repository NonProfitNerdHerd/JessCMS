import { getMediaByStorageKey } from "../media/repository";
import { isSafeStorageKey, storageKeyFromMediaPath } from "../media/filename";
import { getMediaStorageProvider, getR2Bucket } from "../media/storage";

export async function handleServeMediaFile(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const storageKey = storageKeyFromMediaPath(url.pathname);

  if (!storageKey || !isSafeStorageKey(storageKey)) {
    return new Response("Not found", { status: 404 });
  }

  const bucket = getR2Bucket(env);
  if (!bucket) {
    return new Response("Media storage unavailable", { status: 503 });
  }

  const object = await bucket.get(storageKey);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const record = await getMediaByStorageKey(env.DB, storageKey);
  const contentType =
    object.httpMetadata?.contentType ||
    record?.mime_type ||
    "application/octet-stream";

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Content-Disposition", "inline");

  if (object.httpEtag) {
    headers.set("ETag", object.httpEtag);
  }

  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch && object.httpEtag && ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  if (request.method === "HEAD") {
    headers.set("Content-Length", String(object.size));
    return new Response(null, { status: 200, headers });
  }

  return new Response(object.body, { status: 200, headers });
}

export async function enrichMediaRecord(
  item: import("../media/repository").MediaRecord,
  env: Env,
  origin?: string | null,
): Promise<Record<string, unknown>> {
  const provider = getMediaStorageProvider(item, getR2Bucket(env));
  const resolved_url = await provider.resolvePublicUrl(item, origin ?? null);
  const reference_count = await import("../media/repository").then((mod) =>
    mod.countMediaReferences(env.DB, item.id),
  );

  return {
    ...item,
    resolved_url,
    reference_count,
  };
}
