import { escapeHtml } from "../../blocks/render";
import type { PublicMenuItem } from "../../public/types";

export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

export function renderNavItems(items: PublicMenuItem[]): string {
  if (items.length === 0) return "";

  return `<ul class="jess-nav-list">
    ${items
      .map((item) => {
        const target = item.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : "";
        const active = item.isActive ? " is-active" : "";
        const children = item.children.length
          ? `<ul class="jess-nav-sublist">${renderNavItems(item.children).replace(/^<ul class="jess-nav-list">|<\/ul>$/g, "")}</ul>`
          : "";
        return `<li class="jess-nav-item${active}"><a href="${escapeAttr(item.url)}"${target}>${escapeHtml(item.label)}</a>${children}</li>`;
      })
      .join("")}
  </ul>`;
}

export function renderPagination(
  basePath: string,
  page: number,
  totalPages: number,
  query = "",
): string {
  if (totalPages <= 1) return "";

  const qs = query ? `&${query.replace(/^\?/, "")}` : "";
  const links: string[] = [];

  if (page > 1) {
    links.push(
      `<a class="jess-pagination-link" href="${escapeAttr(basePath)}?page=${page - 1}${qs}">Previous</a>`,
    );
  }

  links.push(`<span class="jess-pagination-status">Page ${page} of ${totalPages}</span>`);

  if (page < totalPages) {
    links.push(
      `<a class="jess-pagination-link" href="${escapeAttr(basePath)}?page=${page + 1}${qs}">Next</a>`,
    );
  }

  return `<nav class="jess-pagination" aria-label="Pagination">${links.join("")}</nav>`;
}

export function renderContentCard(input: {
  title: string;
  url: string;
  excerpt?: string | null;
  meta?: string | null;
}): string {
  const excerpt = input.excerpt
    ? `<p class="jess-card-excerpt">${escapeHtml(input.excerpt)}</p>`
    : "";
  const meta = input.meta ? `<p class="jess-card-meta">${escapeHtml(input.meta)}</p>` : "";

  return `<article class="jess-card">
    <h2 class="jess-card-title"><a href="${escapeAttr(input.url)}">${escapeHtml(input.title)}</a></h2>
    ${meta}
    ${excerpt}
  </article>`;
}
