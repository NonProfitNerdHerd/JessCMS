import { generateId } from "../lib/crypto";

export type StorageProviderType = "url" | "r2";

export interface MediaRecord {
  id: string;
  filename: string;
  original_filename: string | null;
  title: string | null;
  alt_text: string | null;
  caption: string | null;
  description: string | null;
  mime_type: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  storage_provider: StorageProviderType;
  storage_key: string | null;
  public_url: string | null;
  folder: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaListOptions {
  q?: string;
  mime_type?: string;
  folder?: string;
  limit?: number;
  offset?: number;
}

export interface CreateMediaInput {
  public_url: string;
  filename?: string | null;
  original_filename?: string | null;
  title?: string | null;
  alt_text?: string | null;
  caption?: string | null;
  description?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  folder?: string | null;
  storage_provider?: StorageProviderType;
  storage_key?: string | null;
}

export interface UpdateMediaInput {
  filename?: string | null;
  original_filename?: string | null;
  title?: string | null;
  alt_text?: string | null;
  caption?: string | null;
  description?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  public_url?: string | null;
  folder?: string | null;
}

export class ValidationError extends Error {
  constructor(public readonly errors: Record<string, string>) {
    super("Validation failed");
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
  }
}

const MEDIA_COLUMNS = `
  id, filename, original_filename, title, alt_text, caption, description,
  mime_type, file_size, width, height, storage_provider, storage_key,
  public_url, folder, uploaded_by, created_at, updated_at
`;

function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").filter(Boolean).pop();
    return base || "media";
  } catch {
    return "media";
  }
}

function guessMimeType(url: string, provided?: string | null): string {
  if (provided?.trim()) {
    return provided.trim();
  }

  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function normalizeFolder(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().replace(/^\/+|\/+$/g, "");
}

function validateCreateInput(input: CreateMediaInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.public_url?.trim()) {
    errors.public_url = "Public URL is required";
  } else {
    try {
      new URL(input.public_url.trim());
    } catch {
      errors.public_url = "Public URL must be a valid URL";
    }
  }

  return errors;
}

export async function listMedia(
  db: D1Database,
  options: MediaListOptions = {},
): Promise<{ items: MediaRecord[]; count: number }> {
  const limit = Math.min(Math.max(options.limit ?? 24, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.q?.trim()) {
    conditions.push(
      "(title LIKE ? OR filename LIKE ? OR alt_text LIKE ? OR caption LIKE ? OR description LIKE ? OR public_url LIKE ?)",
    );
    const term = `%${options.q.trim()}%`;
    params.push(term, term, term, term, term, term);
  }

  if (options.mime_type?.trim()) {
    if (options.mime_type.endsWith("/*")) {
      conditions.push("mime_type LIKE ?");
      params.push(options.mime_type.replace("*", "%"));
    } else {
      conditions.push("mime_type = ?");
      params.push(options.mime_type.trim());
    }
  }

  if (options.folder !== undefined) {
    const folder = normalizeFolder(options.folder);
    if (folder) {
      conditions.push("folder = ?");
      params.push(folder);
    } else {
      conditions.push("(folder IS NULL OR folder = '')");
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db
    .prepare(`SELECT COUNT(*) AS count FROM media_items ${where}`)
    .bind(...params)
    .first<{ count: number }>();

  const result = await db
    .prepare(
      `
        SELECT ${MEDIA_COLUMNS}
        FROM media_items
        ${where}
        ORDER BY created_at DESC, updated_at DESC
        LIMIT ? OFFSET ?
      `,
    )
    .bind(...params, limit, offset)
    .all<MediaRecord>();

  return {
    items: result.results ?? [],
    count: countResult?.count ?? 0,
  };
}

export async function listMediaFolders(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(
      `
        SELECT DISTINCT folder
        FROM media_items
        WHERE folder IS NOT NULL AND folder != ''
        ORDER BY folder ASC
      `,
    )
    .all<{ folder: string }>();

  return (result.results ?? []).map((row) => row.folder);
}

export async function getMediaById(
  db: D1Database,
  id: string,
): Promise<MediaRecord | null> {
  return db
    .prepare(`SELECT ${MEDIA_COLUMNS} FROM media_items WHERE id = ?`)
    .bind(id)
    .first<MediaRecord>();
}

export async function createMedia(
  db: D1Database,
  input: CreateMediaInput,
  uploadedBy: string | null,
): Promise<MediaRecord> {
  const errors = validateCreateInput(input);
  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  const publicUrl = input.public_url.trim();
  const filename = input.filename?.trim() || filenameFromUrl(publicUrl);
  const id = generateId("med");
  const now = new Date().toISOString();

  await db
    .prepare(
      `
        INSERT INTO media_items (
          id, filename, original_filename, title, alt_text, caption, description,
          mime_type, file_size, width, height, storage_provider, storage_key,
          public_url, folder, uploaded_by, created_at, updated_at, url, size_bytes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      id,
      filename,
      input.original_filename?.trim() || filename,
      input.title?.trim() || filename,
      input.alt_text?.trim() || null,
      input.caption?.trim() || null,
      input.description?.trim() || null,
      guessMimeType(publicUrl, input.mime_type),
      input.file_size ?? null,
      input.width ?? null,
      input.height ?? null,
      input.storage_provider ?? "url",
      input.storage_key?.trim() || null,
      publicUrl,
      normalizeFolder(input.folder),
      uploadedBy,
      now,
      now,
      publicUrl,
      input.file_size ?? 0,
    )
    .run();

  const created = await getMediaById(db, id);
  if (!created) {
    throw new Error("Failed to create media item");
  }

  return created;
}

export async function updateMedia(
  db: D1Database,
  id: string,
  input: UpdateMediaInput,
): Promise<MediaRecord> {
  const existing = await getMediaById(db, id);
  if (!existing) {
    throw new NotFoundError();
  }

  const updated: MediaRecord = {
    ...existing,
    filename: input.filename !== undefined ? input.filename?.trim() || existing.filename : existing.filename,
    original_filename:
      input.original_filename !== undefined
        ? input.original_filename?.trim() || null
        : existing.original_filename,
    title: input.title !== undefined ? input.title?.trim() || null : existing.title,
    alt_text: input.alt_text !== undefined ? input.alt_text?.trim() || null : existing.alt_text,
    caption: input.caption !== undefined ? input.caption?.trim() || null : existing.caption,
    description:
      input.description !== undefined ? input.description?.trim() || null : existing.description,
    mime_type:
      input.mime_type !== undefined ? input.mime_type?.trim() || existing.mime_type : existing.mime_type,
    file_size: input.file_size !== undefined ? input.file_size : existing.file_size,
    width: input.width !== undefined ? input.width : existing.width,
    height: input.height !== undefined ? input.height : existing.height,
    public_url:
      input.public_url !== undefined ? input.public_url?.trim() || null : existing.public_url,
    folder: input.folder !== undefined ? normalizeFolder(input.folder) : existing.folder,
    updated_at: new Date().toISOString(),
  };

  if (updated.public_url) {
    try {
      new URL(updated.public_url);
    } catch {
      throw new ValidationError({ public_url: "Public URL must be a valid URL" });
    }
  }

  await db
    .prepare(
      `
        UPDATE media_items SET
          filename = ?,
          original_filename = ?,
          title = ?,
          alt_text = ?,
          caption = ?,
          description = ?,
          mime_type = ?,
          file_size = ?,
          width = ?,
          height = ?,
          public_url = ?,
          url = ?,
          folder = ?,
          updated_at = ?,
          size_bytes = COALESCE(?, size_bytes)
        WHERE id = ?
      `,
    )
    .bind(
      updated.filename,
      updated.original_filename,
      updated.title,
      updated.alt_text,
      updated.caption,
      updated.description,
      updated.mime_type,
      updated.file_size,
      updated.width,
      updated.height,
      updated.public_url,
      updated.public_url,
      updated.folder,
      updated.updated_at,
      updated.file_size,
      id,
    )
    .run();

  return updated;
}

export async function deleteMedia(db: D1Database, id: string): Promise<void> {
  const existing = await getMediaById(db, id);
  if (!existing) {
    throw new NotFoundError();
  }

  await db.prepare("DELETE FROM media_items WHERE id = ?").bind(id).run();
}

export async function readJsonBody<T = Record<string, unknown>>(
  request: Request,
): Promise<T> {
  return (await request.json()) as T;
}
