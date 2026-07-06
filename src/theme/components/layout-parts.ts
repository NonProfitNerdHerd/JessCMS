import { escapeHtml } from "../../blocks/render";
import type { PublicContext } from "../../public/types";
import { themeCssVariables } from "../settings";
import {
  applyCssInjectors,
  applyHeadInjectors,
  applyJsInjectors,
  applyBodyEndInjectors,
} from "../hooks";
import { renderNavItems } from "./html";

export function renderHeader(ctx: PublicContext): string {
  const { settings, menus } = ctx;
  const logo = settings.logo_url
    ? `<img class="jess-logo" src="${escapeHtml(settings.logo_url)}" alt="${escapeHtml(settings.site_name)}">`
    : `<span class="jess-site-title">${escapeHtml(settings.site_name)}</span>`;

  return `<header class="jess-header">
    <div class="jess-container jess-header-inner">
      <a class="jess-brand" href="/">${logo}</a>
      <nav class="jess-nav jess-nav-primary" aria-label="Primary">${renderNavItems(menus.primary)}</nav>
    </div>
  </header>`;
}

export function renderFooter(ctx: PublicContext): string {
  const year = new Date().getFullYear();
  return `<footer class="jess-footer">
    <div class="jess-container jess-footer-inner">
      <nav class="jess-nav jess-nav-footer" aria-label="Footer">${renderNavItems(ctx.menus.footer)}</nav>
      <p class="jess-footer-copy">&copy; ${year} ${escapeHtml(ctx.settings.site_name)}</p>
    </div>
  </footer>`;
}

export function renderSidebar(ctx: PublicContext): string {
  return `<aside class="jess-sidebar" aria-label="Sidebar">
    <section class="jess-sidebar-section">
      <h2 class="jess-sidebar-title">Explore</h2>
      ${renderNavItems(ctx.menus.primary)}
    </section>
  </aside>`;
}

export function renderHead(ctx: PublicContext): string {
  const { settings } = ctx;
  const seo = ctx.view.seo;
  const favicon = settings.favicon_url
    ? `<link rel="icon" href="${escapeHtml(settings.favicon_url)}">`
    : "";

  const ogImage = seo.image
    ? `<meta property="og:image" content="${escapeHtml(seo.image)}">
       <meta name="twitter:image" content="${escapeHtml(seo.image)}">`
    : "";

  const jsonLd = seo.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(seo.jsonLd)}</script>`
    : `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":${JSON.stringify(settings.site_name)},"url":${JSON.stringify(seo.canonical.replace(/\/[^/]*$/, "/"))}}</script>`;

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(seo.title)}</title>
<meta name="description" content="${escapeHtml(seo.description)}">
<meta name="robots" content="${escapeHtml(seo.robots)}">
<link rel="canonical" href="${escapeHtml(seo.canonical)}">
<meta property="og:title" content="${escapeHtml(seo.title)}">
<meta property="og:description" content="${escapeHtml(seo.description)}">
<meta property="og:type" content="${escapeHtml(seo.ogType)}">
<meta property="og:url" content="${escapeHtml(seo.canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(seo.title)}">
<meta name="twitter:description" content="${escapeHtml(seo.description)}">
${ogImage}
${favicon}
<link rel="stylesheet" href="/blocks.css">
<link rel="stylesheet" href="/theme/jess-default.css">
<style>${themeCssVariables(settings)}${applyCssInjectors()}</style>
${settings.custom_css ? `<style>${settings.custom_css}</style>` : ""}
${applyHeadInjectors(ctx)}
${jsonLd}`;
}

export function wrapDocument(ctx: PublicContext, bodyInner: string): string {
  const template = ctx.view.template;
  const showChrome = template !== "blank";

  return `<!DOCTYPE html>
<html lang="en">
<head>${renderHead(ctx)}</head>
<body class="jess-theme jess-template-${escapeHtml(template)}">
${showChrome ? renderHeader(ctx) : ""}
${bodyInner}
${showChrome ? renderFooter(ctx) : ""}
<script>${applyJsInjectors()}</script>
<script src="/forms-embed.js" defer></script>
${applyBodyEndInjectors(ctx)}
</body>
</html>`;
}
