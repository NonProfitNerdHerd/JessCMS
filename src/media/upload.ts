import {
  ALLOWED_MEDIA_MIME_TYPES,
  MEDIA_MAX_UPLOAD_BYTES,
  MIME_TO_EXTENSIONS,
  type AllowedMediaMimeType,
} from "./constants";
import { extensionFromFilename, publicMediaPath, sanitizeFilename } from "./filename";
import type { MediaRecord } from "./repository";
import { ValidationError } from "./repository";
import { generateId } from "../lib/crypto";

export interface UploadMediaOptions {
  folder?: string | null;
  title?: string | null;
  alt_text?: string | null;
  caption?: string | null;
  description?: string | null;
  uploadedBy: string | null;
}

function normalizeFolder(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().replace(/^\/+|\/+$/g, "");
}

function detectMimeFromBytes(bytes: Uint8Array): AllowedMediaMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  const text = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 256))).trim();
  if (text.startsWith("<svg") || text.startsWith("<?xml")) {
    return "image/svg+xml";
  }
  return null;
}

function validateMimeAndExtension(
  declaredMime: string,
  filename: string,
  bytes: Uint8Array,
): AllowedMediaMimeType {
  const normalized = declaredMime.trim().toLowerCase();
  if (!ALLOWED_MEDIA_MIME_TYPES.includes(normalized as AllowedMediaMimeType)) {
    throw new ValidationError({ file: "Unsupported file type" });
  }

  const ext = extensionFromFilename(filename);
  const allowedExt = MIME_TO_EXTENSIONS[normalized as AllowedMediaMimeType];
  if (!ext || !allowedExt.includes(ext)) {
    throw new ValidationError({ file: "File extension does not match allowed types" });
  }

  const sniffed = detectMimeFromBytes(bytes);
  if (sniffed && sniffed !== normalized) {
    throw new ValidationError({ file: "File content does not match declared type" });
  }

  if (!sniffed && normalized !== "image/svg+xml") {
    throw new ValidationError({ file: "Unable to verify file content type" });
  }

  return normalized as AllowedMediaMimeType;
}

export function generateStorageKey(originalFilename: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeName = sanitizeFilename(originalFilename);
  const unique = crypto.randomUUID().replace(/-/g, "");
  return `uploads/${year}/${month}/${unique}-${safeName}`;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function uploadMediaToR2(
  env: Env,
  file: File,
  options: UploadMediaOptions,
): Promise<Omit<MediaRecord, "created_at" | "updated_at"> & { checksum: string | null; metadata_json: string | null }> {
  if (!env.MEDIA_BUCKET) {
    throw new ValidationError({ file: "Media storage is not configured (MEDIA_BUCKET missing)" });
  }

  if (file.size <= 0) {
    throw new ValidationError({ file: "File is empty" });
  }

  if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
    throw new ValidationError({ file: "File exceeds 10 MB limit" });
  }

  const originalFilename = file.name || "upload.bin";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = validateMimeAndExtension(file.type || "application/octet-stream", originalFilename, bytes);
  const storageKey = generateStorageKey(originalFilename);
  const checksum = await sha256Hex(bytes.buffer);
  const filename = sanitizeFilename(originalFilename);
  const publicUrl = publicMediaPath(storageKey);
  const id = generateId("med");
  const folder = normalizeFolder(options.folder);
  const title = options.title?.trim() || filename;

  await env.MEDIA_BUCKET.put(storageKey, bytes, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      original_filename: originalFilename,
      checksum,
    },
  });

  return {
    id,
    filename,
    original_filename: originalFilename,
    title,
    alt_text: options.alt_text?.trim() || null,
    caption: options.caption?.trim() || null,
    description: options.description?.trim() || null,
    mime_type: mimeType,
    file_size: file.size,
    width: null,
    height: null,
    storage_provider: "r2",
    storage_key: storageKey,
    public_url: publicUrl,
    folder,
    uploaded_by: options.uploadedBy,
    checksum,
    metadata_json: null,
  };
}
