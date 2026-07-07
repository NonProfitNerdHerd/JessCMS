import type { ContentIndexRecord } from "../foundation/types";
import { resolveAdminEditUrl } from "./admin-url";
import { buildSnippet, normalizeSearchText } from "./text";

export interface SearchOptions {
  q: string;
  content_type?: string;
  status?: string;
  plugin_id?: string;
  include_media?: boolean;
  limit?: number;
  offset?: number;
  publishedOnly?: boolean;
}

export interface SearchResultItem {
  id: string;
  content_type: string;
  source_id: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string | null;
  snippet: string | null;
  updated_at: string;
  published_at: string | null;
  plugin_id: string | null;
  route_path: string | null;
  url: string | null;
  admin_url: string;
  score: number;
}

const INDEX_COLUMNS = `
  id, content_type, source_table, source_id, slug, title, status,
  author_id, published_at, updated_at, plugin_id, route_path,
  searchable_text, metadata_json, excerpt, featured_image_id,
  search_weight, indexed_at
`;

function buildMatchConditions(query: string): { sql: string; params: unknown[] } {
  const needle = normalizeSearchText(query);
  if (!needle) {
    return { sql: "1 = 0", params: [] };
  }

  const sql = `(
    INSTR(LOWER(title), ?) > 0 OR
    INSTR(LOWER(slug), ?) > 0 OR
    INSTR(LOWER(COALESCE(excerpt, '')), ?) > 0 OR
    INSTR(LOWER(COALESCE(searchable_text, '')), ?) > 0
  )`;

  return { sql, params: [needle, needle, needle, needle] };
}

function scoreRecord(record: ContentIndexRecord, query: string): number {
  const q = normalizeSearchText(query);
  if (!q) return 0;

  const title = normalizeSearchText(record.title);
  const slug = normalizeSearchText(record.slug);
  const body = normalizeSearchText(record.searchable_text);
  const excerpt = normalizeSearchText(record.excerpt);

  let score = Number(record.search_weight ?? 1) * 2;

  if (title === q) score += 100;
  else if (title.includes(q)) score += 50;

  if (slug === q) score += 40;
  else if (slug.includes(q)) score += 25;

  if (excerpt.includes(q)) score += 15;
  if (body.includes(q)) score += 10;

  if (record.published_at) {
    const published = new Date(record.published_at).getTime();
    if (!Number.isNaN(published)) {
      score += Math.min(10, Math.floor(published / 1_000_000_000_000));
    }
  }

  return score;
}

function mapResult(record: ContentIndexRecord, query: string): SearchResultItem {
  const snippetSource = record.excerpt || record.searchable_text;
  return {
    id: record.id,
    content_type: record.content_type,
    source_id: record.source_id,
    title: record.title,
    slug: record.slug,
    status: record.status,
    excerpt: record.excerpt,
    snippet: buildSnippet(snippetSource, query),
    updated_at: record.updated_at,
    published_at: record.published_at,
    plugin_id: record.plugin_id,
    route_path: record.route_path,
    url: record.route_path,
    admin_url: resolveAdminEditUrl(record),
    score: scoreRecord(record, query),
  };
}

export async function searchIndex(
  db: D1Database,
  options: SearchOptions,
): Promise<{ items: SearchResultItem[]; total: number }> {
  const query = options.q.trim();
  if (!query) {
    return { items: [], total: 0 };
  }

  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const publishedOnly = options.publishedOnly === true;
  const match = buildMatchConditions(query);
  if (match.params.length === 0) {
    return { items: [], total: 0 };
  }

  const conditions: string[] = [match.sql];
  const params: unknown[] = [...match.params];

  if (publishedOnly) {
    conditions.push("status = 'published'");
    conditions.push("(published_at IS NULL OR datetime(published_at) <= datetime('now'))");
    conditions.push("content_type NOT IN ('media', 'form')");
    conditions.push("route_path IS NOT NULL");
  } else if (!options.include_media) {
    conditions.push("content_type != 'media'");
  }

  if (options.content_type) {
    conditions.push("content_type = ?");
    params.push(options.content_type);
  }

  if (options.status) {
    conditions.push("status = ?");
    params.push(options.status);
  }

  if (options.plugin_id) {
    conditions.push("plugin_id = ?");
    params.push(options.plugin_id);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const rows = await db
    .prepare(
      `
        SELECT ${INDEX_COLUMNS}
        FROM content_index
        ${where}
        LIMIT 200
      `,
    )
    .bind(...params)
    .all<ContentIndexRecord>();

  const ranked = (rows.results ?? [])
    .map((record) => mapResult(record, query))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.updated_at).localeCompare(String(a.updated_at));
    });

  const total = ranked.length;
  const items = ranked.slice(offset, offset + limit);
  return { items, total };
}

export async function searchPublic(
  db: D1Database,
  options: Omit<SearchOptions, "publishedOnly" | "include_media">,
): Promise<{ items: SearchResultItem[]; total: number }> {
  return searchIndex(db, { ...options, publishedOnly: true });
}

export async function searchAdmin(
  db: D1Database,
  options: SearchOptions,
): Promise<{ items: SearchResultItem[]; total: number }> {
  return searchIndex(db, { ...options, publishedOnly: false });
}

/** @deprecated Use searchPublic instead */
export async function searchContentIndex(
  db: D1Database,
  query: string,
  limit = 20,
  offset = 0,
): Promise<{ items: ContentIndexRecord[]; total: number }> {
  const result = await searchPublic(db, { q: query, limit, offset });
  const items = await Promise.all(
    result.items.map(async (item) =>
      db
        .prepare(`SELECT ${INDEX_COLUMNS} FROM content_index WHERE id = ?`)
        .bind(item.id)
        .first<ContentIndexRecord>(),
    ),
  );
  return {
    items: items.filter(Boolean) as ContentIndexRecord[],
    total: result.total,
  };
}
