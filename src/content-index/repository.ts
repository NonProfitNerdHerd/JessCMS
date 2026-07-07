import type { ContentIndexRecord } from "../foundation/types";
import { resolveRoutePath } from "../search/path";

export type { IndexContentInput as ContentIndexInput } from "../search/indexer";

export {
  indexContent,
  removeFromIndex,
  rebuildIndex,
  syncContentEntryToContentIndex,
  syncEventToContentIndex,
  syncFormToContentIndex,
  syncPageToContentIndex,
  syncPostToContentIndex,
  indexMediaFromRow,
} from "../search/indexer";

export { searchContentIndex, searchPublic, searchAdmin } from "../search/query";
export { resolveRoutePath } from "../search/path";

const INDEX_COLUMNS = `
  id, content_type, source_table, source_id, slug, title, status,
  author_id, published_at, updated_at, plugin_id, route_path,
  searchable_text, metadata_json, excerpt, featured_image_id,
  search_weight, indexed_at
`;

export async function removeContentIndexEntry(
  db: D1Database,
  contentType: string,
  sourceId: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM content_index WHERE content_type = ? AND source_id = ?")
    .bind(contentType, sourceId)
    .run();
}

export async function lookupPublishedByRoutePath(
  db: D1Database,
  pathname: string,
): Promise<ContentIndexRecord | null> {
  const normalized = pathname.replace(/\/+$/, "") || "/";

  const row = await db
    .prepare(
      `
        SELECT ${INDEX_COLUMNS}
        FROM content_index
        WHERE route_path = ?
          AND status = 'published'
          AND (published_at IS NULL OR datetime(published_at) <= datetime('now'))
      `,
    )
    .bind(normalized)
    .first<ContentIndexRecord>();

  return row ?? null;
}
