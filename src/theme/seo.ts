import type { PageTemplate, PublicView, SeoMeta } from "../public/types";
import type { ThemeSettings } from "./settings";

const RESERVED_PAGE_SLUGS = new Set([
  "blog",
  "events",
  "category",
  "tag",
  "search",
  "admin",
  "api",
]);

export function isReservedPageSlug(slug: string): boolean {
  return RESERVED_PAGE_SLUGS.has(slug);
}

export function normalizeTemplate(value: string | null | undefined): PageTemplate {
  const allowed: PageTemplate[] = [
    "default",
    "landing",
    "full-width",
    "sidebar-right",
    "sidebar-left",
    "blank",
  ];
  if (value && allowed.includes(value as PageTemplate)) {
    return value as PageTemplate;
  }
  return "default";
}

export function buildSeoMeta(input: {
  settings: ThemeSettings;
  origin: string;
  pathname: string;
  title: string;
  description?: string | null;
  ogType?: string;
  image?: string | null;
  robots?: string;
  jsonLd?: Record<string, unknown> | null;
}): SeoMeta {
  const canonical = `${input.origin}${input.pathname}`;
  return {
    title: input.title,
    description:
      input.description?.trim() ||
      `${input.settings.site_name} — powered by JessCMS`,
    canonical,
    ogType: input.ogType ?? "website",
    image: input.image ?? input.settings.logo_url,
    robots: input.robots ?? "index, follow",
    jsonLd: input.jsonLd ?? null,
  };
}

export function seoForView(
  view: PublicView,
  settings: ThemeSettings,
  origin: string,
  pathname: string,
): SeoMeta {
  switch (view.kind) {
    case "page":
    case "home":
      return buildSeoMeta({
        settings,
        origin,
        pathname,
        title: view.page?.seo_title || view.page?.title || settings.site_name,
        description: view.page?.seo_description || view.page?.excerpt,
        ogType: "website",
      });
    case "post":
      return buildSeoMeta({
        settings,
        origin,
        pathname,
        title: view.post?.seo_title || view.post?.title || settings.site_name,
        description: view.post?.seo_description || view.post?.excerpt,
        ogType: "article",
      });
    case "event":
      return buildSeoMeta({
        settings,
        origin,
        pathname,
        title: view.event?.seo_title || view.event?.title || settings.site_name,
        description: view.event?.seo_description || view.event?.excerpt,
        ogType: "website",
      });
    case "blog-index":
      return buildSeoMeta({
        settings,
        origin,
        pathname,
        title: `Blog — ${settings.site_name}`,
        description: `Latest posts from ${settings.site_name}`,
      });
    case "events-index":
      return buildSeoMeta({
        settings,
        origin,
        pathname,
        title: `Events — ${settings.site_name}`,
        description: `Upcoming events from ${settings.site_name}`,
      });
    case "category":
      return buildSeoMeta({
        settings,
        origin,
        pathname,
        title: `${view.category?.name ?? "Category"} — ${settings.site_name}`,
        description: view.category?.description,
      });
    case "tag":
      return buildSeoMeta({
        settings,
        origin,
        pathname,
        title: `#${view.tag?.name ?? "Tag"} — ${settings.site_name}`,
      });
    case "search":
      return buildSeoMeta({
        settings,
        origin,
        pathname,
        title: `Search — ${settings.site_name}`,
        robots: "noindex, follow",
      });
    case "not-found":
      return buildSeoMeta({
        settings,
        origin,
        pathname,
        title: `Not Found — ${settings.site_name}`,
        robots: "noindex, follow",
      });
    case "error":
      return buildSeoMeta({
        settings,
        origin,
        pathname,
        title: `Error — ${settings.site_name}`,
        robots: "noindex, nofollow",
      });
    default:
      return buildSeoMeta({ settings, origin, pathname, title: settings.site_name });
  }
}
