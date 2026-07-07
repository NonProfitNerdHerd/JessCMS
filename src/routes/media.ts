import { isAuthUser, requirePermission } from "../auth";
import { getClientIp, writeAuditLog } from "../db/audit";
import {
  countMediaReferences,
  createMedia,
  createUploadedMedia,
  deleteMedia,
  getMediaById,
  listMedia,
  listMediaFolders,
  NotFoundError,
  readJsonBody,
  updateMedia,
  ValidationError,
  type CreateMediaInput,
  type UpdateMediaInput,
} from "../media/repository";
import { uploadMediaToR2 } from "../media/upload";
import { getMediaStorageProvider, getR2Bucket } from "../media/storage";
import { enrichMediaRecord } from "./media-serve";
import { indexMediaFromRow, removeFromIndex } from "../search/indexer";
import {
  badRequest,
  created,
  notFound,
  ok,
  serverError,
} from "../lib/response";

function handleMediaError(error: unknown): Response {
  if (error instanceof ValidationError) {
    return badRequest("Validation failed", error.errors);
  }

  if (error instanceof NotFoundError) {
    return notFound();
  }

  console.error(error);
  return serverError();
}

function parseListOptions(url: URL) {
  return {
    q: url.searchParams.get("q") ?? undefined,
    mime_type: url.searchParams.get("mime_type") ?? undefined,
    folder: url.searchParams.has("folder") ? url.searchParams.get("folder") ?? "" : undefined,
    limit: Number(url.searchParams.get("limit") ?? 24),
    offset: Number(url.searchParams.get("offset") ?? 0),
  };
}

function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export async function handleListMedia(request: Request, env: Env): Promise<Response> {
  const authResult = await requirePermission(request, env, "media:read");
  if (!isAuthUser(authResult)) {
    return authResult;
  }

  try {
    const url = new URL(request.url);
    const options = parseListOptions(url);
    const { items, count } = await listMedia(env.DB, options);
    const folders = url.searchParams.get("include_folders") === "1"
      ? await listMediaFolders(env.DB)
      : undefined;

    const origin = requestOrigin(request);
    const enriched = await Promise.all(
      items.map((item) => enrichMediaRecord(item, env, origin)),
    );

    return ok({
      items: enriched,
      count,
      limit: options.limit,
      offset: options.offset,
      folders,
    });
  } catch (error) {
    return handleMediaError(error);
  }
}

export async function handleGetMediaById(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "media:read");
  if (!isAuthUser(authResult)) {
    return authResult;
  }

  try {
    const item = await getMediaById(env.DB, params.id);
    if (!item) {
      return notFound();
    }

    return ok(await enrichMediaRecord(item, env, requestOrigin(request)));
  } catch (error) {
    return handleMediaError(error);
  }
}

export async function handleCreateMedia(request: Request, env: Env): Promise<Response> {
  const authResult = await requirePermission(request, env, "media:create");
  if (!isAuthUser(authResult)) {
    return authResult;
  }

  let body: CreateMediaInput;
  try {
    body = await readJsonBody<CreateMediaInput>(request);
  } catch {
    return badRequest("Invalid JSON body");
  }

  try {
    const item = await createMedia(env.DB, body, authResult.id);

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "create",
      entityType: "media",
      entityId: item.id,
      ipAddress: getClientIp(request),
      metadata: { title: item.title, public_url: item.public_url, storage_provider: "url" },
    });

    await indexMediaFromRow(env.DB, item);

    return created(await enrichMediaRecord(item, env, requestOrigin(request)));
  } catch (error) {
    return handleMediaError(error);
  }
}

export async function handleUploadMedia(request: Request, env: Env): Promise<Response> {
  const authResult = await requirePermission(request, env, "media:create");
  if (!isAuthUser(authResult)) {
    return authResult;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return badRequest("Validation failed", { file: "file is required" });
    }

    const uploaded = await uploadMediaToR2(env, file, {
      folder: String(formData.get("folder") ?? ""),
      title: String(formData.get("title") ?? ""),
      alt_text: String(formData.get("alt_text") ?? ""),
      caption: String(formData.get("caption") ?? ""),
      description: String(formData.get("description") ?? ""),
      uploadedBy: authResult.id,
    });

    const item = await createUploadedMedia(env.DB, uploaded);

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "create",
      entityType: "media",
      entityId: item.id,
      ipAddress: getClientIp(request),
      metadata: {
        title: item.title,
        storage_provider: "r2",
        storage_key: item.storage_key,
        public_url: item.public_url,
      },
    });

    await indexMediaFromRow(env.DB, item);

    return created(await enrichMediaRecord(item, env, requestOrigin(request)));
  } catch (error) {
    return handleMediaError(error);
  }
}

export async function handleUpdateMedia(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "media:update");
  if (!isAuthUser(authResult)) {
    return authResult;
  }

  let body: UpdateMediaInput;
  try {
    body = await readJsonBody<UpdateMediaInput>(request);
  } catch {
    return badRequest("Invalid JSON body");
  }

  try {
    const item = await updateMedia(env.DB, params.id, body);

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "update",
      entityType: "media",
      entityId: item.id,
      ipAddress: getClientIp(request),
    });

    await indexMediaFromRow(env.DB, item);

    return ok(await enrichMediaRecord(item, env, requestOrigin(request)));
  } catch (error) {
    return handleMediaError(error);
  }
}

export async function handleDeleteMedia(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "media:delete");
  if (!isAuthUser(authResult)) {
    return authResult;
  }

  try {
    const existing = await getMediaById(env.DB, params.id);
    if (!existing) {
      return notFound();
    }

    const referenceCount = await countMediaReferences(env.DB, params.id);
    const force = new URL(request.url).searchParams.get("force") === "1";

    if (referenceCount > 0 && !force) {
      return badRequest("Media is referenced by content", {
        reference_count: String(referenceCount),
        message: "Confirm delete to remove anyway",
      });
    }

    const provider = getMediaStorageProvider(existing, getR2Bucket(env));
    if (provider.deleteObject) {
      await provider.deleteObject(existing);
    }

    await deleteMedia(env.DB, params.id);
    await removeFromIndex(env.DB, "media", params.id);

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "delete",
      entityType: "media",
      entityId: params.id,
      ipAddress: getClientIp(request),
      metadata: {
        storage_provider: existing.storage_provider,
        storage_key: existing.storage_key,
        reference_count: referenceCount,
      },
    });

    return ok({ deleted: true, id: params.id, reference_count: referenceCount });
  } catch (error) {
    return handleMediaError(error);
  }
}
