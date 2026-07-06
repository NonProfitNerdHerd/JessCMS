import type { ContentRecord, EventRecord, PostRecord } from "../content/repository";
import type { SearchHit } from "./queries";
import type { ThemeSettings } from "../theme/settings";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PublicMenuItem {
  id: string;
  label: string;
  url: string;
  openInNewTab: boolean;
  children: PublicMenuItem[];
  isActive: boolean;
}

export interface PublicMenus {
  primary: PublicMenuItem[];
  footer: PublicMenuItem[];
}

export interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  ogType: string;
  image: string | null;
  robots: string;
  jsonLd: Record<string, unknown> | null;
}

export type PageTemplate =
  | "default"
  | "landing"
  | "full-width"
  | "sidebar-right"
  | "sidebar-left"
  | "blank";

export type PublicViewKind =
  | "home"
  | "page"
  | "blog-index"
  | "post"
  | "events-index"
  | "event"
  | "category"
  | "tag"
  | "search"
  | "not-found"
  | "error";

export interface PublicView {
  kind: PublicViewKind;
  template: PageTemplate;
  seo: SeoMeta;
  page?: ContentRecord;
  post?: PostRecord;
  posts?: PostRecord[];
  event?: EventRecord;
  events?: EventRecord[];
  category?: { slug: string; name: string; description: string | null };
  tag?: { slug: string; name: string };
  searchQuery?: string;
  searchResults?: SearchHit[];
  pagination?: Pagination;
}

export interface PublicContext {
  request: Request;
  url: URL;
  env: Env;
  settings: ThemeSettings;
  menus: PublicMenus;
  view: PublicView;
}
