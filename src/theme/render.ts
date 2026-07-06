import { escapeHtml } from "../blocks/render";
import { renderContentCard, renderPagination } from "./components/html";
import { formatDate, renderEventBody, renderGenericEntryBody, renderPageBody, renderPostBody } from "./content";
import { renderByTemplate } from "./layouts/index";
import type { PublicContext } from "../public/types";

function renderArchive(ctx: PublicContext, title: string, intro: string, cards: string): string {
  const pagination = ctx.view.pagination
    ? renderPagination(
        ctx.url.pathname,
        ctx.view.pagination.page,
        ctx.view.pagination.totalPages,
        ctx.url.searchParams.toString().replace(/(^|&)page=\d+&?/g, "$1").replace(/&$/, ""),
      )
    : "";

  return `<section class="jess-archive">
    <header class="jess-page-header"><h1>${escapeHtml(title)}</h1><p class="jess-intro">${escapeHtml(intro)}</p></header>
    <div class="jess-card-grid">${cards}</div>
    ${pagination}
  </section>`;
}

export function renderPublicView(ctx: PublicContext): string {
  const { view } = ctx;

  switch (view.kind) {
    case "home":
    case "page": {
      const page = view.page!;
      const header = `<header class="jess-page-header"><h1>${escapeHtml(page.title)}</h1></header>`;
      return renderByTemplate(ctx, `${header}${renderPageBody(page)}`);
    }
    case "post": {
      const post = view.post!;
      const header = `<header class="jess-page-header"><h1>${escapeHtml(post.title)}</h1><p class="jess-meta">${escapeHtml(formatDate(post.published_at))}</p></header>`;
      return renderByTemplate(ctx, `${header}${renderPostBody(post)}`);
    }
    case "event": {
      const event = view.event!;
      const header = `<header class="jess-page-header"><h1>${escapeHtml(event.title)}</h1></header>`;
      return renderByTemplate(ctx, `${header}${renderEventBody(event)}`);
    }
    case "generic-content": {
      const entry = view.entry!;
      const header = `<header class="jess-page-header"><h1>${escapeHtml(entry.title)}</h1>${entry.excerpt ? `<p class="jess-intro">${escapeHtml(entry.excerpt)}</p>` : ""}</header>`;
      return renderByTemplate(ctx, `${header}${renderGenericEntryBody(entry)}`);
    }
    case "blog-index": {
      const cards = (view.posts ?? [])
        .map((post) =>
          renderContentCard({
            title: post.title,
            url: `/blog/${post.slug}`,
            excerpt: post.excerpt,
            meta: formatDate(post.published_at),
          }),
        )
        .join("");
      return renderByTemplate(
        ctx,
        renderArchive(ctx, "Blog", "Latest posts", cards || "<p>No posts yet.</p>"),
      );
    }
    case "events-index": {
      const cards = (view.events ?? [])
        .map((event) =>
          renderContentCard({
            title: event.title,
            url: `/events/${event.slug}`,
            excerpt: event.excerpt,
            meta: event.start_datetime,
          }),
        )
        .join("");
      return renderByTemplate(
        ctx,
        renderArchive(ctx, "Events", "Upcoming and recent events", cards || "<p>No events yet.</p>"),
      );
    }
    case "category": {
      const cards = (view.posts ?? [])
        .map((post) =>
          renderContentCard({
            title: post.title,
            url: `/blog/${post.slug}`,
            excerpt: post.excerpt,
          }),
        )
        .join("");
      return renderByTemplate(
        ctx,
        renderArchive(
          ctx,
          view.category?.name ?? "Category",
          view.category?.description ?? "Posts in this category",
          cards || "<p>No posts in this category.</p>",
        ),
      );
    }
    case "tag": {
      const cards = (view.posts ?? [])
        .map((post) =>
          renderContentCard({
            title: post.title,
            url: `/blog/${post.slug}`,
            excerpt: post.excerpt,
          }),
        )
        .join("");
      return renderByTemplate(
        ctx,
        renderArchive(
          ctx,
          `#${view.tag?.name ?? "Tag"}`,
          "Posts with this tag",
          cards || "<p>No posts with this tag.</p>",
        ),
      );
    }
    case "search": {
      const q = view.searchQuery ?? "";
      const cards = (view.searchResults ?? [])
        .map((hit) =>
          renderContentCard({
            title: hit.title,
            url: hit.url,
            excerpt: hit.excerpt,
          }),
        )
        .join("");
      const searchParams = new URLSearchParams(ctx.url.searchParams);
      searchParams.delete("page");
      const queryString = searchParams.toString();
      const pagination = view.pagination
        ? renderPagination(
            ctx.url.pathname,
            view.pagination.page,
            view.pagination.totalPages,
            queryString,
          )
        : "";
      return renderByTemplate(
        ctx,
        `<section class="jess-search">
          <header class="jess-page-header"><h1>Search</h1><p>Results for “${escapeHtml(q)}”</p></header>
          <div class="jess-card-grid">${cards || "<p>No results found.</p>"}</div>
          ${pagination}
        </section>`,
      );
    }
    case "not-found":
      return renderByTemplate(
        ctx,
        `<section class="jess-error-page"><h1>404</h1><p>The page you requested could not be found.</p><p><a href="/">Return home</a></p></section>`,
      );
    case "error":
      return renderByTemplate(
        ctx,
        `<section class="jess-error-page"><h1>Something went wrong</h1><p>Please try again later.</p><p><a href="/">Return home</a></p></section>`,
      );
    default:
      return renderByTemplate(ctx, "<p>Unsupported view.</p>");
  }
}
