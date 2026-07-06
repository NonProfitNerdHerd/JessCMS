export interface MediaItem {
  id: string;
  url: string | null;
  alt: string | null;
  mimeType: string | null;
}

export interface MediaProvider {
  resolveById(mediaId: string | null | undefined): Promise<MediaItem | null>;
  resolveImageUrl(input: {
    mediaId?: string | null;
    url?: string | null;
    alt?: string | null;
  }): Promise<{ url: string | null; alt: string | null }>;
}

/** URL-only media provider until R2 uploads are implemented. */
export class UrlMediaProvider implements MediaProvider {
  constructor(private readonly db: D1Database) {}

  async resolveById(mediaId: string | null | undefined): Promise<MediaItem | null> {
    if (!mediaId) return null;

    const row = await this.db
      .prepare(
        "SELECT id, url, alt_text AS alt, mime_type AS mimeType FROM media_items WHERE id = ?",
      )
      .bind(mediaId)
      .first<{ id: string; url: string | null; alt: string | null; mimeType: string | null }>();

    if (!row) return null;

    return {
      id: row.id,
      url: row.url,
      alt: row.alt,
      mimeType: row.mimeType,
    };
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
