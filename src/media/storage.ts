import type { MediaRecord } from "./repository";

export type StorageProviderType = "url" | "r2";

export interface MediaStorageProvider {
  readonly type: StorageProviderType;
  resolvePublicUrl(item: MediaRecord): Promise<string | null>;
  deleteObject?(item: MediaRecord): Promise<void>;
}

/** Resolves media from a stored public URL (no upload). */
export class UrlMediaStorage implements MediaStorageProvider {
  readonly type = "url" as const;

  async resolvePublicUrl(item: MediaRecord): Promise<string | null> {
    return item.public_url;
  }
}

/**
 * Placeholder for Cloudflare R2 uploads.
 * Wire env.MEDIA_BUCKET and implement put/get/delete when R2 is enabled.
 */
export class R2MediaStorage implements MediaStorageProvider {
  readonly type = "r2" as const;

  constructor(private readonly bucket: R2Bucket | null) {}

  async resolvePublicUrl(item: MediaRecord): Promise<string | null> {
    if (item.public_url) {
      return item.public_url;
    }

    if (!this.bucket || !item.storage_key) {
      return null;
    }

    // Future: signed URL or public bucket URL from storage_key
    return null;
  }

  async deleteObject(item: MediaRecord): Promise<void> {
    if (!this.bucket || !item.storage_key) {
      return;
    }

    await this.bucket.delete(item.storage_key);
  }
}

export function getMediaStorageProvider(
  item: MediaRecord,
  r2Bucket?: R2Bucket | null,
): MediaStorageProvider {
  if (item.storage_provider === "r2") {
    return new R2MediaStorage(r2Bucket ?? null);
  }

  return new UrlMediaStorage();
}
