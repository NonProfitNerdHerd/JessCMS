import { generateId } from "../lib/crypto";
import { getContentTypeByKey } from "../content-types/registry";
import type { ContentTypeRecord } from "../foundation/types";
import { resolveRoutePath } from "./path";
import {
  buildSearchableText,
  extractTextFromBlocks,
  extractTextFromHtml,
} from "./text";

export { resolveRoutePath as buildRoutePath } from "./path";

export interface IndexContentInput {
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
  excerpt?: string | null;
  featured_image_id?: string | null;
  content_json?: string | null;
  content_html?: string | null;
  metadata_json?: Record<string, unknown> | string | null;
  searchable_text?: string | null;
  search_weight?: number | null;
}

export type ContentIndexInput = IndexContentInput;

async function shouldIndexContentType(
  db: D1Database,
  contentTypeKey: string,
): Promise<{ allowed: boolean; contentType: ContentTypeRecord | null }> {
  const contentType = await getContentTypeByKey(db, contentTypeKey);
  if (!contentType) {
    return { allowed: true, contentType: null };
  }

  if (contentType.enabled === false) {
    return { allowed: false, contentType };
  }

  const supportsSearch =
    contentType.supports_search === undefined || contentType.supports_search === true;
  return { allowed: supportsSearch, contentType };
}

function metadataToObject(
  value: Record<string, unknown> | string | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return value;
}

export function composeSearchableText(input: IndexContentInput): string {
  if (input.searchable_text?.trim()) {
    return buildSearchableText([input.searchable_text]);
  }

  const metadata = metadataToObject(input.metadata_json);
  const blockText = extractTextFromBlocks(input.content_json);
  const htmlText = extractTextFromHtml(input.content_html);

  return buildSearchableText([
    input.title,
    input.slug,
    input.excerpt,
    blockText,
    htmlText,
    metadata ? JSON.stringify(metadata) : null,
  ]);
}

export async function indexContent(
  db: D1Database,
  input: IndexContentInput,
): Promise<boolean> {
  if (input.content_type === "media") {
    return indexMediaRecord(db, input);
  }

  const { allowed, contentType } = await shouldIndexContentType(db, input.content_type);
  if (!allowed) {
    await removeFromIndex(db, input.content_type, input.source_id);
    return false;
  }

  const routePath =
    input.route_path ??
    resolveRoutePath(input.content_type, input.slug, contentType?.route_base);

  const finalRoutePath =
    contentType?.supports_public_routes === false ? null : routePath;

  const searchWeight =
    input.search_weight ??
    contentType?.search_weight ??
    1;

  const metadata = metadataToObject(input.metadata_json);
  const searchableText = composeSearchableText(input);
  const now = new Date().toISOString();

  const existing = await db
    .prepare(
      "SELECT id FROM content_index WHERE content_type = ? AND source_id = ?",
    )
    .bind(input.content_type, input.source_id)
    .first<{ id: string }>();

  const id = existing?.id ?? generateId("cidx");

  await db
    .prepare(
      `
        INSERT INTO content_index (
          id, content_type, source_table, source_id, slug, title, status,
          author_id, published_at, updated_at, plugin_id, route_path,
          searchable_text, metadata_json, excerpt, featured_image_id,
          search_weight, indexed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?, ?, ?, ?, ?, ?)
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
          metadata_json = excluded.metadata_json,
          excerpt = excluded.excerpt,
          featured_image_id = excluded.featured_image_id,
          search_weight = excluded.search_weight,
          indexed_at = excluded.indexed_at
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
      finalRoutePath,
      searchableText,
      metadata ? JSON.stringify(metadata) : null,
      input.excerpt ?? null,
      input.featured_image_id ?? null,
      searchWeight,
      now,
    )
    .run();

  return true;
}

async function indexMediaRecord(db: D1Database, input: IndexContentInput): Promise<boolean> {
  const searchableText = buildSearchableText([
    input.title,
    input.slug,
    input.excerpt,
    input.searchable_text,
  ]);
  const now = new Date().toISOString();

  const existing = await db
    .prepare(
      "SELECT id FROM content_index WHERE content_type = ? AND source_id = ?",
    )
    .bind("media", input.source_id)
    .first<{ id: string }>();

  const id = existing?.id ?? generateId("cidx");

  await db
    .prepare(
      `
        INSERT INTO content_index (
          id, content_type, source_table, source_id, slug, title, status,
          author_id, published_at, updated_at, plugin_id, route_path,
          searchable_text, metadata_json, excerpt, featured_image_id,
          search_weight, indexed_at
        ) VALUES (?, 'media', 'media_items', ?, ?, ?, 'published', ?, NULL, COALESCE(?, datetime('now')), NULL, ?, ?, NULL, ?, NULL, 0.5, ?)
        ON CONFLICT(content_type, source_id) DO UPDATE SET
          slug = excluded.slug,
          title = excluded.title,
          updated_at = excluded.updated_at,
          route_path = excluded.route_path,
          searchable_text = excluded.searchable_text,
          excerpt = excluded.excerpt,
          indexed_at = excluded.indexed_at
      `,
    )
    .bind(
      id,
      input.source_id,
      input.slug,
      input.title,
      input.author_id ?? null,
      input.updated_at ?? null,
      input.route_path ?? null,
      searchableText,
      input.excerpt ?? null,
      now,
    )
    .run();

  return true;
}

export async function removeFromIndex(
  db: D1Database,
  contentType: string,
  sourceId: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM content_index WHERE content_type = ? AND source_id = ?")
    .bind(contentType, sourceId)
    .run();
}

const PAGE_COLUMNS = `
  id, slug, title, status, excerpt, content_json, content_html,
  author_id, featured_image_id, published_at, updated_at
`;

const POST_COLUMNS = PAGE_COLUMNS;
const EVENT_COLUMNS = PAGE_COLUMNS;

export async function rebuildIndex(
  db: D1Database,
  options: { includeForms?: boolean; includeMedia?: boolean } = {},
): Promise<{ indexed: number }> {
  await db.prepare("DELETE FROM content_index").run();

  let indexed = 0;
  const includeForms = options.includeForms !== false;
  const includeMedia = options.includeMedia !== false;

  const pages = await db.prepare(`SELECT ${PAGE_COLUMNS} FROM pages`).all<Record<string, unknown>>();
  for (const row of pages.results ?? []) {
    await indexContent(db, {
      content_type: "page",
      source_table: "pages",
      source_id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      status: String(row.status),
      author_id: (row.author_id as string | null) ?? null,
      published_at: (row.published_at as string | null) ?? null,
      updated_at: (row.updated_at as string | null) ?? null,
      excerpt: (row.excerpt as string | null) ?? null,
      featured_image_id: (row.featured_image_id as string | null) ?? null,
      content_json: (row.content_json as string | null) ?? null,
      content_html: (row.content_html as string | null) ?? null,
    });
    indexed++;
  }

  const posts = await db.prepare(`SELECT ${POST_COLUMNS} FROM posts`).all<Record<string, unknown>>();
  for (const row of posts.results ?? []) {
    await indexContent(db, {
      content_type: "post",
      source_table: "posts",
      source_id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      status: String(row.status),
      author_id: (row.author_id as string | null) ?? null,
      published_at: (row.published_at as string | null) ?? null,
      updated_at: (row.updated_at as string | null) ?? null,
      excerpt: (row.excerpt as string | null) ?? null,
      featured_image_id: (row.featured_image_id as string | null) ?? null,
      content_json: (row.content_json as string | null) ?? null,
      content_html: (row.content_html as string | null) ?? null,
    });
    indexed++;
  }

  const events = await db.prepare(`SELECT ${EVENT_COLUMNS} FROM events`).all<Record<string, unknown>>();
  for (const row of events.results ?? []) {
    await indexContent(db, {
      content_type: "event",
      source_table: "events",
      source_id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      status: String(row.status),
      author_id: (row.author_id as string | null) ?? null,
      published_at: (row.published_at as string | null) ?? null,
      updated_at: (row.updated_at as string | null) ?? null,
      excerpt: (row.excerpt as string | null) ?? null,
      featured_image_id: (row.featured_image_id as string | null) ?? null,
      content_json: (row.content_json as string | null) ?? null,
      content_html: (row.content_html as string | null) ?? null,
    });
    indexed++;
  }

  const entries = await db
    .prepare(
      `
        SELECT id, content_type, slug, title, status, excerpt, content_json, content_html,
               author_id, featured_image_id, published_at, updated_at, metadata_json, plugin_id
        FROM content_entries
      `,
    )
    .all<Record<string, unknown>>();

  for (const row of entries.results ?? []) {
    const added = await indexContent(db, {
      content_type: String(row.content_type),
      source_table: "content_entries",
      source_id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      status: String(row.status),
      author_id: (row.author_id as string | null) ?? null,
      published_at: (row.published_at as string | null) ?? null,
      updated_at: (row.updated_at as string | null) ?? null,
      excerpt: (row.excerpt as string | null) ?? null,
      featured_image_id: (row.featured_image_id as string | null) ?? null,
      content_json: (row.content_json as string | null) ?? null,
      content_html: (row.content_html as string | null) ?? null,
      metadata_json: (row.metadata_json as string | null) ?? null,
      plugin_id: (row.plugin_id as string | null) ?? null,
    });
    if (added) indexed++;
  }

  if (includeForms) {
    const forms = await db
      .prepare(
        `
          SELECT id, slug, title, status, description, created_by, updated_at
          FROM forms
        `,
      )
      .all<Record<string, unknown>>();

    for (const row of forms.results ?? []) {
      await indexContent(db, {
        content_type: "form",
        source_table: "forms",
        source_id: String(row.id),
        slug: String(row.slug),
        title: String(row.title),
        status: String(row.status),
        author_id: (row.created_by as string | null) ?? null,
        updated_at: (row.updated_at as string | null) ?? null,
        excerpt: (row.description as string | null) ?? null,
        plugin_id: "forms-builder",
        route_path: null,
        searchable_text: buildSearchableText([
          String(row.title),
          String(row.description ?? ""),
        ]),
      });
      indexed++;
    }
  }

  if (includeMedia) {
    const media = await db
      .prepare(
        `
          SELECT id, filename, title, alt_text, caption, description,
                 public_url, uploaded_by, updated_at
          FROM media_items
        `,
      )
      .all<Record<string, unknown>>();

    for (const row of media.results ?? []) {
      await indexMediaFromRow(db, row);
      indexed++;
    }
  }

  return { indexed };
}

export async function indexMediaFromRow(
  db: D1Database,
  row: {
    id: string;
    filename: string;
    title?: string | null;
    alt_text?: string | null;
    caption?: string | null;
    description?: string | null;
    public_url?: string | null;
    uploaded_by?: string | null;
    updated_at?: string | null;
  },
): Promise<void> {
  await indexContent(db, {
    content_type: "media",
    source_table: "media_items",
    source_id: row.id,
    slug: row.filename,
    title: row.title ?? row.filename,
    status: "published",
    author_id: row.uploaded_by ?? null,
    updated_at: row.updated_at ?? null,
    route_path: row.public_url?.startsWith("/") ? row.public_url : null,
    excerpt: row.caption ?? row.description ?? null,
    searchable_text: buildSearchableText([
      row.title,
      row.filename,
      row.alt_text,
      row.caption,
      row.description,
    ]),
  });
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
    featured_image_id?: string | null;
    content_json?: string | null;
    content_html?: string | null;
  },
): Promise<void> {
  await indexContent(db, {
    content_type: "page",
    source_table: "pages",
    source_id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    author_id: page.author_id,
    published_at: page.published_at,
    updated_at: page.updated_at,
    excerpt: page.excerpt,
    featured_image_id: page.featured_image_id,
    content_json: page.content_json,
    content_html: page.content_html,
  });
}

export async function syncPostToContentIndex(
  db: D1Database,
  post: Parameters<typeof syncPageToContentIndex>[1],
): Promise<void> {
  await indexContent(db, {
    content_type: "post",
    source_table: "posts",
    source_id: post.id,
    slug: post.slug,
    title: post.title,
    status: post.status,
    author_id: post.author_id,
    published_at: post.published_at,
    updated_at: post.updated_at,
    excerpt: post.excerpt,
    featured_image_id: post.featured_image_id,
    content_json: post.content_json,
    content_html: post.content_html,
  });
}

export async function syncEventToContentIndex(
  db: D1Database,
  event: Parameters<typeof syncPageToContentIndex>[1],
): Promise<void> {
  await indexContent(db, {
    content_type: "event",
    source_table: "events",
    source_id: event.id,
    slug: event.slug,
    title: event.title,
    status: event.status,
    author_id: event.author_id,
    published_at: event.published_at,
    updated_at: event.updated_at,
    excerpt: event.excerpt,
    featured_image_id: event.featured_image_id,
    content_json: event.content_json,
    content_html: event.content_html,
  });
}

export async function syncContentEntryToContentIndex(
  db: D1Database,
  entry: {
    id: string;
    content_type: string;
    slug: string;
    title: string;
    status: string;
    author_id?: string | null;
    published_at?: string | null;
    updated_at?: string | null;
    excerpt?: string | null;
    featured_image_id?: string | null;
    content_json?: string | null;
    content_html?: string | null;
    metadata_json?: string | null;
    plugin_id?: string | null;
  },
  contentType?: { route_base?: string | null; supports_public_routes?: boolean } | null,
): Promise<void> {
  await indexContent(db, {
    content_type: entry.content_type,
    source_table: "content_entries",
    source_id: entry.id,
    slug: entry.slug,
    title: entry.title,
    status: entry.status,
    author_id: entry.author_id,
    published_at: entry.published_at,
    updated_at: entry.updated_at,
    excerpt: entry.excerpt,
    featured_image_id: entry.featured_image_id,
    content_json: entry.content_json,
    content_html: entry.content_html,
    metadata_json: entry.metadata_json,
    plugin_id: entry.plugin_id,
    route_path:
      contentType?.supports_public_routes === false
        ? null
        : resolveRoutePath(entry.content_type, entry.slug, contentType?.route_base),
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
  await indexContent(db, {
    content_type: "form",
    source_table: "forms",
    source_id: form.id,
    slug: form.slug,
    title: form.title,
    status: form.status,
    author_id: form.created_by,
    updated_at: form.updated_at,
    excerpt: form.description,
    plugin_id: "forms-builder",
    route_path: null,
    searchable_text: buildSearchableText([form.title, form.description]),
  });
}
