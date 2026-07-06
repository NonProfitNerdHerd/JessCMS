import type { ContentRecord, EventRecord, PostRecord } from "../content/repository";
import { PUBLISHED_WHERE, PUBLISHED_WHERE_PREFIX } from "./published";

const PUBLISHED = PUBLISHED_WHERE;

const PAGE_COLUMNS = `
  id, slug, title, excerpt, content, content_json, content_html, status,
  author_id, featured_image_id, parent_id, template, seo_title, seo_description,
  published_at, created_at, updated_at
`;

const POST_COLUMNS = `
  id, slug, title, excerpt, content, content_json, content_html, status,
  author_id, category_id, featured_image_id, parent_id, template, seo_title,
  seo_description, published_at, created_at, updated_at
`;

const EVENT_COLUMNS = `
  id, slug, title, status, excerpt, content_json, content_html, author_id,
  featured_image_id, parent_id, template, seo_title, seo_description,
  start_datetime, end_datetime, location_name, location_address, latitude,
  longitude, timezone, event_status, published_at, created_at, updated_at
`;

export interface ListOptions {
  limit?: number;
  offset?: number;
  q?: string;
}

export async function countPublished(
  db: D1Database,
  table: "pages" | "posts" | "events",
  extraWhere = "",
  params: unknown[] = [],
): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM ${table} WHERE ${PUBLISHED}${extraWhere ? ` AND ${extraWhere}` : ""}`,
    )
    .bind(...params)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

export async function getPublishedPageBySlug(
  db: D1Database,
  slug: string,
): Promise<ContentRecord | null> {
  return db
    .prepare(
      `SELECT ${PAGE_COLUMNS} FROM pages WHERE slug = ? AND ${PUBLISHED}`,
    )
    .bind(slug)
    .first<ContentRecord>();
}

export async function listPublishedPages(
  db: D1Database,
  options: ListOptions = {},
): Promise<ContentRecord[]> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  const result = await db
    .prepare(
      `
        SELECT ${PAGE_COLUMNS}
        FROM pages
        WHERE ${PUBLISHED}
        ORDER BY published_at DESC, updated_at DESC
        LIMIT ? OFFSET ?
      `,
    )
    .bind(limit, offset)
    .all<ContentRecord>();
  return result.results ?? [];
}

export async function listPublishedPosts(
  db: D1Database,
  options: ListOptions & { categorySlug?: string; tagSlug?: string } = {},
): Promise<PostRecord[]> {
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;
  const params: unknown[] = [];
  let joins = "";
  let extra = "";

  if (options.categorySlug) {
    joins += " INNER JOIN categories c ON c.id = posts.category_id";
    extra += " AND c.slug = ?";
    params.push(options.categorySlug);
  }

  if (options.tagSlug) {
    joins +=
      " INNER JOIN post_tags pt ON pt.post_id = posts.id INNER JOIN tags t ON t.id = pt.tag_id";
    extra += " AND t.slug = ?";
    params.push(options.tagSlug);
  }

  const result = await db
    .prepare(
      `
        SELECT posts.id, posts.slug, posts.title, posts.excerpt, posts.content, posts.content_json,
               posts.content_html, posts.status, posts.author_id, posts.category_id,
               posts.featured_image_id, posts.parent_id, posts.template, posts.seo_title,
               posts.seo_description, posts.published_at, posts.created_at, posts.updated_at
        FROM posts
        ${joins}
        WHERE ${PUBLISHED_WHERE_PREFIX("posts")}
        ${extra}
        ORDER BY posts.published_at DESC, posts.updated_at DESC
        LIMIT ? OFFSET ?
      `,
    )
    .bind(...params, limit, offset)
    .all<PostRecord>();

  return result.results ?? [];
}

export async function countPublishedPosts(
  db: D1Database,
  options: { categorySlug?: string; tagSlug?: string } = {},
): Promise<number> {
  const params: unknown[] = [];
  let joins = "";
  let extra = "";

  if (options.categorySlug) {
    joins += " INNER JOIN categories c ON c.id = posts.category_id";
    extra += " AND c.slug = ?";
    params.push(options.categorySlug);
  }

  if (options.tagSlug) {
    joins +=
      " INNER JOIN post_tags pt ON pt.post_id = posts.id INNER JOIN tags t ON t.id = pt.tag_id";
    extra += " AND t.slug = ?";
    params.push(options.tagSlug);
  }

  const result = await db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM posts
        ${joins}
        WHERE ${PUBLISHED_WHERE_PREFIX("posts")}
        ${extra}
      `,
    )
    .bind(...params)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

export async function getPublishedPostBySlug(
  db: D1Database,
  slug: string,
): Promise<PostRecord | null> {
  return db
    .prepare(`SELECT ${POST_COLUMNS} FROM posts WHERE slug = ? AND ${PUBLISHED}`)
    .bind(slug)
    .first<PostRecord>();
}

export async function listPublishedEvents(
  db: D1Database,
  options: ListOptions = {},
): Promise<EventRecord[]> {
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;
  const result = await db
    .prepare(
      `
        SELECT ${EVENT_COLUMNS}
        FROM events
        WHERE ${PUBLISHED}
        ORDER BY start_datetime DESC, published_at DESC
        LIMIT ? OFFSET ?
      `,
    )
    .bind(limit, offset)
    .all<EventRecord>();
  return result.results ?? [];
}

export async function countPublishedEvents(db: D1Database): Promise<number> {
  return countPublished(db, "events");
}

export async function getPublishedEventBySlug(
  db: D1Database,
  slug: string,
): Promise<EventRecord | null> {
  return db
    .prepare(`SELECT ${EVENT_COLUMNS} FROM events WHERE slug = ? AND ${PUBLISHED}`)
    .bind(slug)
    .first<EventRecord>();
}

export async function getCategoryBySlug(
  db: D1Database,
  slug: string,
): Promise<{ id: string; slug: string; name: string; description: string | null } | null> {
  return db
    .prepare("SELECT id, slug, name, description FROM categories WHERE slug = ?")
    .bind(slug)
    .first();
}

export async function getTagBySlug(
  db: D1Database,
  slug: string,
): Promise<{ id: string; slug: string; name: string } | null> {
  return db
    .prepare("SELECT id, slug, name FROM tags WHERE slug = ?")
    .bind(slug)
    .first();
}

export interface SearchHit {
  kind: "page" | "post" | "event";
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  url: string;
}

export async function searchPublishedContent(
  db: D1Database,
  query: string,
  limit = 20,
  offset = 0,
): Promise<{ items: SearchHit[]; total: number }> {
  const term = `%${query.trim()}%`;
  if (!query.trim()) {
    return { items: [], total: 0 };
  }

  const pages = await db
    .prepare(
      `
        SELECT id, slug, title, excerpt
        FROM pages
        WHERE ${PUBLISHED}
          AND (title LIKE ? OR excerpt LIKE ? OR content_html LIKE ? OR content_json LIKE ?)
        LIMIT 50
      `,
    )
    .bind(term, term, term, term)
    .all<{ id: string; slug: string; title: string; excerpt: string | null }>();

  const posts = await db
    .prepare(
      `
        SELECT id, slug, title, excerpt
        FROM posts
        WHERE ${PUBLISHED}
          AND (title LIKE ? OR excerpt LIKE ? OR content_html LIKE ? OR content_json LIKE ?)
        LIMIT 50
      `,
    )
    .bind(term, term, term, term)
    .all<{ id: string; slug: string; title: string; excerpt: string | null }>();

  const events = await db
    .prepare(
      `
        SELECT id, slug, title, excerpt
        FROM events
        WHERE ${PUBLISHED}
          AND (title LIKE ? OR excerpt LIKE ? OR content_html LIKE ? OR content_json LIKE ?)
        LIMIT 50
      `,
    )
    .bind(term, term, term, term)
    .all<{ id: string; slug: string; title: string; excerpt: string | null }>();

  const combined: SearchHit[] = [
    ...(pages.results ?? []).map((row) => ({
      kind: "page" as const,
      ...row,
      url: `/${row.slug}`,
    })),
    ...(posts.results ?? []).map((row) => ({
      kind: "post" as const,
      ...row,
      url: `/blog/${row.slug}`,
    })),
    ...(events.results ?? []).map((row) => ({
      kind: "event" as const,
      ...row,
      url: `/events/${row.slug}`,
    })),
  ];

  combined.sort((a, b) => a.title.localeCompare(b.title));
  const total = combined.length;
  const items = combined.slice(offset, offset + limit);

  return { items, total };
}

export interface SitemapEntry {
  loc: string;
  lastmod: string | null;
}

export async function getSitemapEntries(db: D1Database): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [
    { loc: "/", lastmod: null },
    { loc: "/blog", lastmod: null },
    { loc: "/events", lastmod: null },
  ];

  const pages = await db
    .prepare(
      `SELECT slug, updated_at FROM pages WHERE ${PUBLISHED} AND slug != 'home'`,
    )
    .all<{ slug: string; updated_at: string }>();

  for (const page of pages.results ?? []) {
    entries.push({ loc: `/${page.slug}`, lastmod: page.updated_at });
  }

  const posts = await db
    .prepare(`SELECT slug, updated_at FROM posts WHERE ${PUBLISHED}`)
    .all<{ slug: string; updated_at: string }>();

  for (const post of posts.results ?? []) {
    entries.push({ loc: `/blog/${post.slug}`, lastmod: post.updated_at });
  }

  const events = await db
    .prepare(`SELECT slug, updated_at FROM events WHERE ${PUBLISHED}`)
    .all<{ slug: string; updated_at: string }>();

  for (const event of events.results ?? []) {
    entries.push({ loc: `/events/${event.slug}`, lastmod: event.updated_at });
  }

  return entries;
}
