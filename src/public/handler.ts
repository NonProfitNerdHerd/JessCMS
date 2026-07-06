import { getSitemapEntries } from "./queries";
import { errorView, resolvePublicView } from "./router";
import type { PublicContext } from "./types";
import { loadPublicMenus } from "../theme/menus";
import { loadThemeSettings } from "../theme/settings";
import { renderPublicView } from "../theme/render";
import { getRouteHooks } from "../theme/hooks";
import { seoForView } from "../theme/seo";

export function publicCacheHeaders(maxAge = 300): HeadersInit {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge * 2}`,
  };
}

export function noCacheHeaders(contentType: string): HeadersInit {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  };
}

function htmlResponse(html: string, status = 200, headers?: HeadersInit): Response {
  return new Response(html, { status, headers: headers ?? publicCacheHeaders() });
}

function buildRobots(origin: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
}

function buildSitemap(entries: Awaited<ReturnType<typeof getSitemapEntries>>): string {
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastmod
        ? `<lastmod>${entry.lastmod.slice(0, 10)}</lastmod>`
        : "";
      return `<url><loc>${entry.loc}</loc>${lastmod}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export async function handlePublicRequest(
  request: Request,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return null;
  }

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (pathname.startsWith("/admin") || pathname.startsWith("/api")) {
    return null;
  }

  if (
    /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|webp|map)$/i.test(pathname)
  ) {
    return null;
  }

  if (pathname === "/robots.txt") {
    return new Response(buildRobots(url.origin), {
      headers: publicCacheHeaders(3600),
    });
  }

  if (pathname === "/sitemap.xml") {
    const entries = await getSitemapEntries(env.DB);
    const absolute = entries.map((entry) => ({
      ...entry,
      loc: entry.loc.startsWith("http") ? entry.loc : `${url.origin}${entry.loc}`,
    }));
    return new Response(buildSitemap(absolute), {
      headers: {
        ...publicCacheHeaders(3600),
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  }

  const settings = await loadThemeSettings(env.DB);
  const menus = await loadPublicMenus(env.DB, pathname);

  const baseContext: Omit<PublicContext, "view"> = {
    request,
    url,
    env,
    settings,
    menus,
  };

  for (const hook of getRouteHooks()) {
    if (hook.method && hook.method !== request.method) continue;
    if (!hook.pattern.test(pathname)) continue;
    const ctx: PublicContext = {
      ...baseContext,
      view: {
        kind: "page",
        template: "default",
        seo: seoForView(
          { kind: "page", template: "default", seo: {} as never },
          settings,
          url.origin,
          pathname,
        ),
      },
    };
    const hooked = await hook.handler(ctx);
    if (hooked) return hooked;
  }

  try {
    const view = await resolvePublicView(request, url, env, settings);
    view.seo = seoForView(view, settings, url.origin, pathname);

    const ctx: PublicContext = { ...baseContext, view };
    const html = renderPublicView(ctx);
    const status = view.kind === "not-found" ? 404 : 200;

    if (request.method === "HEAD") {
      return new Response(null, { status, headers: publicCacheHeaders() });
    }

    return htmlResponse(html, status);
  } catch (error) {
    console.error(error);
    const view = errorView(settings, url);
    view.seo = seoForView(view, settings, url.origin, pathname);
    const ctx: PublicContext = { ...baseContext, view };
    return htmlResponse(renderPublicView(ctx), 500, publicCacheHeaders(60));
  }
}
