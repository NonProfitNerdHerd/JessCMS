
export interface MediaItem {
  id: string;
  url: string | null;
  alt: string | null;
  mimeType: string | null;
  title?: string | null;
  caption?: string | null;
}

export interface MediaProvider {
  resolveById(mediaId: string | null | undefined): Promise<MediaItem | null>;
  resolveImageUrl(input: {
    mediaId?: string | null;
    url?: string | null;
    alt?: string | null;
  }): Promise<{ url: string | null; alt: string | null }>;
}

function toMediaItem(row: {
  id: string;
  public_url: string | null;
  alt_text: string | null;
  mime_type: string;
  title: string | null;
  caption: string | null;
  storage_provider?: string | null;
  storage_key?: string | null;
}): MediaItem {
  const url =
    row.public_url ||
    (row.storage_provider === "r2" && row.storage_key
      ? `/media/${row.storage_key}`
      : null);

  return {
    id: row.id,
    url,
    alt: row.alt_text,
    mimeType: row.mime_type,
    title: row.title,
    caption: row.caption,
  };
}

/** Resolves media from D1 (URL and R2-backed items). */
export class UrlMediaProvider implements MediaProvider {
  constructor(private readonly db: D1Database) {}

  async resolveById(mediaId: string | null | undefined): Promise<MediaItem | null> {
    if (!mediaId) return null;

    const row = await this.db
      .prepare(
        `
          SELECT id, public_url, alt_text, mime_type, title, caption,
                 storage_provider, storage_key
          FROM media_items
          WHERE id = ?
        `,
      )
      .bind(mediaId)
      .first<{
        id: string;
        public_url: string | null;
        alt_text: string | null;
        mime_type: string;
        title: string | null;
        caption: string | null;
        storage_provider: string | null;
        storage_key: string | null;
      }>();

    if (!row) return null;

    return toMediaItem(row);
  }

  async resolveImageUrl(input: {
    mediaId?: string | null;
    url?: string | null;
    alt?: string | null;
  }): Promise<{ url: string | null; alt: string | null }> {
    if (input.url) {
      return { url: input.url, alt: input.alt ?? null };
    }

    const media = await this.resolveById(input.mediaId);
    if (!media) {
      return { url: null, alt: input.alt ?? null };
    }

    return { url: media.url, alt: input.alt ?? media.alt };
  }
}

export { toMediaItem };
