import type { Block } from "../blocks/render";
import type { BlockRenderer } from "../blocks/registry";
import type { PublicContext, PublicView } from "../public/types";

export type HeadInjector = (ctx: PublicContext) => string;
export type BodyInjector = (ctx: PublicContext) => string;
export type CssInjector = () => string;
export type JsInjector = () => string;

export interface PublicRouteHook {
  pattern: RegExp;
  method?: string;
  handler: (ctx: PublicContext) => Promise<Response | null>;
}

const routeHooks: PublicRouteHook[] = [];
const blockRenderers = new Map<string, BlockRenderer>();
const headInjectors: HeadInjector[] = [];
const bodyEndInjectors: BodyInjector[] = [];
const cssInjectors: CssInjector[] = [];
const jsInjectors: JsInjector[] = [];
const menuItemInjectors: Array<(ctx: PublicContext) => Array<{ label: string; url: string }>> = [];

export function registerPublicRoute(hook: PublicRouteHook): void {
  routeHooks.push(hook);
}

export function registerPluginBlockRenderer(type: string, renderer: BlockRenderer): void {
  blockRenderers.set(type, renderer);
}

export function registerHeadInjector(injector: HeadInjector): void {
  headInjectors.push(injector);
}

export function registerBodyEndInjector(injector: BodyInjector): void {
  bodyEndInjectors.push(injector);
}

export function registerCssInjector(injector: CssInjector): void {
  cssInjectors.push(injector);
}

export function registerJsInjector(injector: JsInjector): void {
  jsInjectors.push(injector);
}

export function registerMenuItemInjector(
  injector: (ctx: PublicContext) => Array<{ label: string; url: string }>,
): void {
  menuItemInjectors.push(injector);
}

export function getRouteHooks(): PublicRouteHook[] {
  return routeHooks;
}

export function getPluginBlockRenderers(): Map<string, BlockRenderer> {
  return blockRenderers;
}

export function applyHeadInjectors(ctx: PublicContext): string {
  return headInjectors.map((fn) => fn(ctx)).join("\n");
}

export function applyBodyEndInjectors(ctx: PublicContext): string {
  return bodyEndInjectors.map((fn) => fn(ctx)).join("\n");
}

export function applyCssInjectors(): string {
  return cssInjectors.map((fn) => fn()).join("\n");
}

export function applyJsInjectors(): string {
  return jsInjectors.map((fn) => fn()).join("\n");
}

export function applyMenuItemInjectors(ctx: PublicContext): Array<{ label: string; url: string }> {
  return menuItemInjectors.flatMap((fn) => fn(ctx));
}

export type LayoutRenderer = (ctx: PublicContext, contentHtml: string) => string;

const layoutRenderers = new Map<string, LayoutRenderer>();

export function registerLayout(name: string, renderer: LayoutRenderer): void {
  layoutRenderers.set(name, renderer);
}

export function getLayoutRenderer(name: string): LayoutRenderer | undefined {
  return layoutRenderers.get(name);
}

export function resolvePluginBlockRenderer(block: Block): BlockRenderer | undefined {
  return blockRenderers.get(block.type);
}
