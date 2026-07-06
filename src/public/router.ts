import {
  countPublishedEvents,
  countPublishedPosts,
  getCategoryBySlug,
  getPublishedEventBySlug,
  getPublishedPageBySlug,
  getPublishedPostBySlug,
  getTagBySlug,
  listPublishedEvents,
  listPublishedPosts,
  searchPublishedContent,
} from "./queries";
import { lookupPublishedByRoutePath } from "../content-index/repository";
import type { ContentIndexRecord } from "../foundation/types";
import type { PublicView } from "./types";
import { isReservedPageSlug, normalizeTemplate } from "../theme/seo";
import type { ThemeSettings } from "../theme/settings";

const POSTS_PER_PAGE = 10;
const EVENTS_PER_PAGE = 10;

function pageNumber(url: URL): number {
  const raw = Number(url.searchParams.get("page") ?? 1);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
}

function paginate(total: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page: Math.min(page, totalPages),
    limit,
    total,
    totalPages,
  };
}

function stubSeo(): PublicView["seo"] {
  return {
    title: "",
    description: "",
    canonical: "",
    ogType: "website",
    image: null,
    robots: "index, follow",
    jsonLd: null,
  };
}

export async function resolvePublicView(
  _request: Request,
  url: URL,
  env: Env,
  _settings: ThemeSettings,
): Promise<PublicView> {
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const segments = pathname.split("/").filter(Boolean);
  const page = pageNumber(url);

  if (pathname === "/") {
    const home = await getPublishedPageBySlug(env.DB, "home");
    if (home) {
      return {
        kind: "home",
        template: normalizeTemplate(home.template),
        seo: stubSeo(),
        page: home,
      };
    }

    const posts = await listPublishedPosts(env.DB, { limit: POSTS_PER_PAGE, offset: 0 });
    const total = await countPublishedPosts(env.DB, {});
    return {
      kind: "blog-index",
      template: "default",
      seo: stubSeo(),
      posts,
      pagination: paginate(total, 1, POSTS_PER_PAGE),
    };
  }

  if (pathname === "/blog") {
    const offset = (page - 1) * POSTS_PER_PAGE;
    const total = await countPublishedPosts(env.DB, {});
    const posts = await listPublishedPosts(env.DB, { limit: POSTS_PER_PAGE, offset });
    return {
      kind: "blog-index",
      template: "default",
      seo: stubSeo(),
      posts,
      pagination: paginate(total, page, POSTS_PER_PAGE),
    };
  }

  if (segments[0] === "blog" && segments.length === 2) {
    const post = await getPublishedPostBySlug(env.DB, segments[1]);
    if (!post) return notFoundView();
    return {
      kind: "post",
      template: normalizeTemplate(post.template),
      seo: stubSeo(),
      post,
    };
  }

  if (pathname === "/events") {
    const offset = (page - 1) * EVENTS_PER_PAGE;
    const total = await countPublishedEvents(env.DB);
    const events = await listPublishedEvents(env.DB, { limit: EVENTS_PER_PAGE, offset });
    return {
      kind: "events-index",
      template: "default",
      seo: stubSeo(),
      events,
      pagination: paginate(total, page, EVENTS_PER_PAGE),
    };
  }

  if (segments[0] === "events" && segments.length === 2) {
    const event = await getPublishedEventBySlug(env.DB, segments[1]);
    if (!event) return notFoundView();
    return {
      kind: "event",
      template: normalizeTemplate(event.template),
      seo: stubSeo(),
      event,
    };
  }

  if (segments[0] === "category" && segments.length === 2) {
    const category = await getCategoryBySlug(env.DB, segments[1]);
    if (!category) return notFoundView();
    const offset = (page - 1) * POSTS_PER_PAGE;
    const total = await countPublishedPosts(env.DB, { categorySlug: category.slug });
    const posts = await listPublishedPosts(env.DB, {
      limit: POSTS_PER_PAGE,
      offset,
      categorySlug: category.slug,
    });
    return {
      kind: "category",
      template: "default",
      seo: stubSeo(),
      category,
      posts,
      pagination: paginate(total, page, POSTS_PER_PAGE),
    };
  }

  if (segments[0] === "tag" && segments.length === 2) {
    const tag = await getTagBySlug(env.DB, segments[1]);
    if (!tag) return notFoundView();
    const offset = (page - 1) * POSTS_PER_PAGE;
    const total = await countPublishedPosts(env.DB, { tagSlug: tag.slug });
    const posts = await listPublishedPosts(env.DB, {
      limit: POSTS_PER_PAGE,
      offset,
      tagSlug: tag.slug,
    });
    return {
      kind: "tag",
      template: "default",
      seo: stubSeo(),
      tag,
      posts,
      pagination: paginate(total, page, POSTS_PER_PAGE),
    };
  }

  if (pathname === "/search") {
    const q = url.searchParams.get("q")?.trim() ?? "";
    const offset = (page - 1) * POSTS_PER_PAGE;
    const { items, total } = await searchPublishedContent(env.DB, q, POSTS_PER_PAGE, offset);
    return {
      kind: "search",
      template: "default",
      seo: stubSeo(),
      searchQuery: q,
      searchResults: items,
      pagination: paginate(total, page, POSTS_PER_PAGE),
    };
  }

  const indexedView = await resolveViewFromContentIndex(env, pathname);
  if (indexedView) {
    return indexedView;
  }

  if (segments.length === 1 && !isReservedPageSlug(segments[0])) {
    const pageRecord = await getPublishedPageBySlug(env.DB, segments[0]);
    if (!pageRecord) return notFoundView();
    return {
      kind: "page",
      template: normalizeTemplate(pageRecord.template),
      seo: stubSeo(),
      page: pageRecord,
    };
  }

  return notFoundView();
}

function notFoundView(): PublicView {
  return {
    kind: "not-found",
    template: "default",
    seo: stubSeo(),
  };
}

async function resolveViewFromContentIndex(
  env: Env,
  pathname: string,
): Promise<PublicView | null> {
  const indexed = await lookupPublishedByRoutePath(env.DB, pathname);
  if (!indexed) return null;
  return resolveIndexedRecord(env, indexed);
}

async function resolveIndexedRecord(
  env: Env,
  indexed: ContentIndexRecord,
): Promise<PublicView | null> {
  switch (indexed.content_type) {
    case "page": {
      const page = await getPublishedPageBySlug(env.DB, indexed.slug);
      if (!page) return null;
      return {
        kind: indexed.slug === "home" ? "home" : "page",
        template: normalizeTemplate(page.template),
        seo: stubSeo(),
        page,
      };
    }
    case "post": {
      const post = await getPublishedPostBySlug(env.DB, indexed.slug);
      if (!post) return null;
      return {
        kind: "post",
        template: normalizeTemplate(post.template),
        seo: stubSeo(),
        post,
      };
    }
    case "event": {
      const event = await getPublishedEventBySlug(env.DB, indexed.slug);
      if (!event) return null;
      return {
        kind: "event",
        template: normalizeTemplate(event.template),
        seo: stubSeo(),
        event,
      };
    }
    default:
      return null;
  }
}

export function errorView(_settings: ThemeSettings, _url: URL): PublicView {
  return {
    kind: "error",
    template: "default",
    seo: stubSeo(),
  };
}
