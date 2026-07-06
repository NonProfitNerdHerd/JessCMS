import type { MediaRecord } from "./repository";
import { publicMediaPath } from "./filename";

export type StorageProviderType = "url" | "r2";

export interface MediaStorageProvider {
  readonly type: StorageProviderType;
  resolvePublicUrl(item: MediaRecord, origin?: string | null): Promise<string | null>;
  deleteObject?(item: MediaRecord): Promise<void>;
}

/** Resolves media from a stored public URL (no upload). */
export class UrlMediaStorage implements MediaStorageProvider {
  readonly type = "url" as const;

  async resolvePublicUrl(item: MediaRecord, origin?: string | null): Promise<string | null> {
    if (!item.public_url) return null;
    if (item.public_url.startsWith("http://") || item.public_url.startsWith("https://")) {
      return item.public_url;
    }
    if (origin && item.public_url.startsWith("/")) {
      return `${origin.replace(/\/+$/, "")}${item.public_url}`;
    }
    return item.public_url;
  }
}

export class R2MediaStorage implements MediaStorageProvider {
  readonly type = "r2" as const;

  constructor(private readonly bucket: R2Bucket | null) {}

  async resolvePublicUrl(item: MediaRecord, origin?: string | null): Promise<string | null> {
    if (item.public_url) {
      if (item.public_url.startsWith("http://") || item.public_url.startsWith("https://")) {
        return item.public_url;
      }
      if (origin) {
        return `${origin.replace(/\/+$/, "")}${item.public_url}`;
      }
      return item.public_url;
    }

    if (item.storage_key) {
      const path = publicMediaPath(item.storage_key);
      return origin ? `${origin.replace(/\/+$/, "")}${path}` : path;
    }

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

export function getR2Bucket(env: Env): R2Bucket | null {
  return env.MEDIA_BUCKET ?? null;
}
