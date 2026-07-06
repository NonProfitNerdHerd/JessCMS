import { generateId } from "../lib/crypto";
import type { ContentIndexRecord } from "../foundation/types";
import { getContentTypeByKey } from "../content-types/registry";

export interface ContentIndexInput {
  content_type: string;
  source_table: string;
  source_id: string;
  slug: string;
  title: string;
  status: string;
  author_id?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  plugin_id?: string | null;
  route_path?: string | null;
  searchable_text?: string | null;
  metadata_json?: Record<string, unknown> | null;
}

function buildSearchableText(parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

export function resolveRoutePath(
  contentType: string,
  slug: string,
  routeBase?: string | null,
): string | null {
  switch (contentType) {
    case "page":
      return slug === "home" ? "/" : `/${slug}`;
    case "post":
      return `/blog/${slug}`;
    case "event":
      return `/events/${slug}`;
    case "form":
      return routeBase ? `${routeBase.replace(/\/+$/, "")}/${slug}` : null;
    default:
      if (routeBase) {
        return `${routeBase.replace(/\/+$/, "")}/${slug}`;
      }
      return null;
  }
}

export async function upsertContentIndexEntry(
  db: D1Database,
  input: ContentIndexInput,
): Promise<void> {
  const contentType = await getContentTypeByKey(db, input.content_type);
  const routePath =
    input.route_path ??
    resolveRoutePath(input.content_type, input.slug, contentType?.route_base);

  const existing = await db
    .prepare(
      "SELECT id FROM content_index WHERE content_type = ? AND source_id = ?",
    )
    .bind(input.content_type, input.source_id)
    .first<{ id: string }>();

  const id = existing?.id ?? generateId("cidx");
  const searchable =
    input.searchable_text ??
    buildSearchableText([input.title, input.slug, input.status]);

  await db
    .prepare(
      `
        INSERT INTO content_index (
          id, content_type, source_table, source_id, slug, title, status,
          author_id, published_at, updated_at, plugin_id, route_path,
          searchable_text, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?, ?)
        ON CONFLICT(content_type, source_id) DO UPDATE SET
          source_table = excluded.source_table,
          slug = excluded.slug,
          title = excluded.title,
          status = excluded.status,
          author_id = excluded.author_id,
          published_at = excluded.published_at,
          updated_at = excluded.updated_at,
          plugin_id = excluded.plugin_id,
          route_path = excluded.route_path,
          searchable_text = excluded.searchable_text,
          metadata_json = excluded.metadata_json
      `,
    )
    .bind(
      id,
      input.content_type,
      input.source_table,
      input.source_id,
      input.slug,
      input.title,
      input.status,
      input.author_id ?? null,
      input.published_at ?? null,
      input.updated_at ?? null,
      input.plugin_id ?? contentType?.plugin_id ?? null,
      routePath,
      searchable,
      input.metadata_json ? JSON.stringify(input.metadata_json) : null,
    )
    .run();
}

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
        SELECT id, content_type, source_table, source_id, slug, title, status,
               author_id, published_at, updated_at, plugin_id, route_path,
               searchable_text, metadata_json
        FROM content_index
        WHERE route_path = ?
          AND status = 'published'
          AND (published_at IS NULL OR published_at <= datetime('now'))
      `,
    )
    .bind(normalized)
    .first<ContentIndexRecord>();

  return row ?? null;
}

export async function searchContentIndex(
  db: D1Database,
  query: string,
  limit = 20,
  offset = 0,
): Promise<{ items: ContentIndexRecord[]; total: number }> {
  const term = `%${query.trim()}%`;
  const items = await db
    .prepare(
      `
        SELECT id, content_type, source_table, source_id, slug, title, status,
               author_id, published_at, updated_at, plugin_id, route_path,
               searchable_text, metadata_json
        FROM content_index
        WHERE status = 'published'
          AND searchable_text LIKE ?
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `,
    )
    .bind(term, limit, offset)
    .all<ContentIndexRecord>();

  const count = await db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM content_index
        WHERE status = 'published' AND searchable_text LIKE ?
      `,
    )
    .bind(term)
    .first<{ count: number }>();

  return { items: items.results ?? [], total: count?.count ?? 0 };
}

export async function syncPageToContentIndex(
  db: D1Database,
  page: {
    id: string;
    slug: string;
    title: string;
    status: string;
    author_id?: string | null;
    published_at?: string | null;
    updated_at?: string | null;
    excerpt?: string | null;
    content_html?: string | null;
  },
): Promise<void> {
  await upsertContentIndexEntry(db, {
    content_type: "page",
    source_table: "pages",
    source_id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    author_id: page.author_id,
    published_at: page.published_at,
    updated_at: page.updated_at,
    searchable_text: buildSearchableText([
      page.title,
      page.excerpt,
      page.content_html,
    ]),
  });
}

export async function syncPostToContentIndex(
  db: D1Database,
  post: {
    id: string;
    slug: string;
    title: string;
    status: string;
    author_id?: string | null;
    published_at?: string | null;
    updated_at?: string | null;
    excerpt?: string | null;
    content_html?: string | null;
  },
): Promise<void> {
  await upsertContentIndexEntry(db, {
    content_type: "post",
    source_table: "posts",
    source_id: post.id,
    slug: post.slug,
    title: post.title,
    status: post.status,
    author_id: post.author_id,
    published_at: post.published_at,
    updated_at: post.updated_at,
    searchable_text: buildSearchableText([
      post.title,
      post.excerpt,
      post.content_html,
    ]),
  });
}

export async function syncEventToContentIndex(
  db: D1Database,
  event: {
    id: string;
    slug: string;
    title: string;
    status: string;
    author_id?: string | null;
    published_at?: string | null;
    updated_at?: string | null;
    excerpt?: string | null;
    content_html?: string | null;
  },
): Promise<void> {
  await upsertContentIndexEntry(db, {
    content_type: "event",
    source_table: "events",
    source_id: event.id,
    slug: event.slug,
    title: event.title,
    status: event.status,
    author_id: event.author_id,
    published_at: event.published_at,
    updated_at: event.updated_at,
    searchable_text: buildSearchableText([
      event.title,
      event.excerpt,
      event.content_html,
    ]),
  });
}

export async function syncFormToContentIndex(
  db: D1Database,
  form: {
    id: string;
    slug: string;
    title: string;
    status: string;
    created_by?: string | null;
    updated_at?: string | null;
    description?: string | null;
  },
): Promise<void> {
  await upsertContentIndexEntry(db, {
    content_type: "form",
    source_table: "forms",
    source_id: form.id,
    slug: form.slug,
    title: form.title,
    status: form.status,
    author_id: form.created_by,
    updated_at: form.updated_at,
    plugin_id: "forms-builder",
    route_path: null,
    searchable_text: buildSearchableText([form.title, form.description]),
  });
}
