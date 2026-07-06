import type { PublicContext } from "../../public/types";
import { renderSidebar, wrapDocument } from "../components/layout-parts";

function layoutShell(ctx: PublicContext, mainHtml: string, withSidebar: "left" | "right" | false): string {
  const sidebar = withSidebar ? renderSidebar(ctx) : "";
  const gridClass =
    withSidebar === "left"
      ? "jess-layout jess-layout-sidebar-left"
      : withSidebar === "right"
        ? "jess-layout jess-layout-sidebar-right"
        : "jess-layout jess-layout-single";

  const body =
    withSidebar === "left"
      ? `<main class="jess-main"><div class="jess-container ${gridClass}">${sidebar}<div class="jess-main-content">${mainHtml}</div></div></main>`
      : withSidebar === "right"
        ? `<main class="jess-main"><div class="jess-container ${gridClass}"><div class="jess-main-content">${mainHtml}</div>${sidebar}</div></main>`
        : `<main class="jess-main"><div class="jess-container ${gridClass}"><div class="jess-main-content">${mainHtml}</div></div></main>`;

  return wrapDocument(ctx, body);
}

export function renderDefaultLayout(ctx: PublicContext, contentHtml: string): string {
  return layoutShell(ctx, contentHtml, false);
}

export function renderLandingLayout(ctx: PublicContext, contentHtml: string): string {
  const body = `<main class="jess-main jess-landing"><div class="jess-container">${contentHtml}</div></main>`;
  return wrapDocument(ctx, body);
}

export function renderFullWidthLayout(ctx: PublicContext, contentHtml: string): string {
  const body = `<main class="jess-main jess-full-width">${contentHtml}</main>`;
  return wrapDocument(ctx, body);
}

export function renderSidebarRightLayout(ctx: PublicContext, contentHtml: string): string {
  return layoutShell(ctx, contentHtml, "right");
}

export function renderSidebarLeftLayout(ctx: PublicContext, contentHtml: string): string {
  return layoutShell(ctx, contentHtml, "left");
}

export function renderBlankLayout(ctx: PublicContext, contentHtml: string): string {
  return wrapDocument(ctx, contentHtml);
}

export function renderByTemplate(ctx: PublicContext, contentHtml: string): string {
  switch (ctx.view.template) {
    case "landing":
      return renderLandingLayout(ctx, contentHtml);
    case "full-width":
      return renderFullWidthLayout(ctx, contentHtml);
    case "sidebar-right":
      return renderSidebarRightLayout(ctx, contentHtml);
    case "sidebar-left":
      return renderSidebarLeftLayout(ctx, contentHtml);
    case "blank":
      return renderBlankLayout(ctx, contentHtml);
    default:
      return renderDefaultLayout(ctx, contentHtml);
  }
}
