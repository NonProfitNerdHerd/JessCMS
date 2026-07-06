export const MEDIA_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
] as const;

export type AllowedMediaMimeType = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];

export const MIME_TO_EXTENSIONS: Record<AllowedMediaMimeType, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/svg+xml": ["svg"],
  "application/pdf": ["pdf"],
};

export const STORAGE_KEY_PREFIX = "uploads";
