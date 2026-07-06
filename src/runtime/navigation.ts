import { getRuntime } from "./sync";
import type { RuntimeNavigationItem, RuntimeSnapshot } from "./types";
import { userHasPermission, type AuthUser } from "../auth";
import { genericAdminBase, isLegacyContentType } from "../content-entries/registry";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
  permission?: string | null;
}

export interface AdminNavSection {
  id: string;
  label: string;
  items: AdminNavItem[];
}

const CORE_CONTENT_ORDER = ["page", "post", "event", "form"] as const;

const SITE_NAV_HREFS = new Set([
  "/admin/dashboard",
  "/admin/media",
  "/admin/settings/theme",
  "/admin/plugins",
  "/admin/profile",
]);

function dedupeNavItems(items: AdminNavItem[]): AdminNavItem[] {
  const seen = new Set<string>();
  const result: AdminNavItem[] = [];
  for (const item of items) {
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    result.push(item);
  }
  return result;
}

export function navigationToAdminItems(
  navigation: RuntimeNavigationItem[],
): AdminNavItem[] {
  return navigation.map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
    permission: item.permission,
  }));
}

type RuntimeContentType = RuntimeSnapshot["content_types"][number];

function contentTypeHref(type: RuntimeContentType): string {
  if (type.admin_base) return type.admin_base;
  if (isLegacyContentType(type.type_key)) {
    if (type.type_key === "page") return "/admin/pages";
    if (type.type_key === "form") return "/admin/forms";
    return `/admin/${type.type_key}s`;
  }
  return genericAdminBase(type.type_key);
}

function sortContentTypes(types: RuntimeContentType[]): RuntimeContentType[] {
  return [...types].sort((a, b) => {
    const ai = CORE_CONTENT_ORDER.indexOf(
      a.type_key as (typeof CORE_CONTENT_ORDER)[number],
    );
    const bi = CORE_CONTENT_ORDER.indexOf(
      b.type_key as (typeof CORE_CONTENT_ORDER)[number],
    );
    const aOrder = ai === -1 ? 1000 : ai;
    const bOrder = bi === -1 ? 1000 : bi;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.plural_label.localeCompare(b.plural_label);
  });
}

function canAccessNavItem(user: AuthUser | null | undefined, item: AdminNavItem): boolean {
  if (!user || !item.permission) return true;
  return userHasPermission(user.permissions, item.permission);
}

export async function getAdminNavigation(
  env: Env,
  user?: AuthUser | null,
): Promise<AdminNavSection[]> {
  const snapshot = await getRuntime(env);

  const contentTypeHrefs = new Set<string>();
  const contentItems: AdminNavItem[] = [];

  for (const type of sortContentTypes(
    snapshot.content_types.filter((entry) => entry.enabled !== false),
  )) {
    const href = contentTypeHref(type);
    if (contentTypeHrefs.has(href)) continue;
    contentTypeHrefs.add(href);
    contentItems.push({
      href,
      label: type.plural_label,
      icon: type.icon ?? "📄",
    });
  }

  const extensionItems = dedupeNavItems(
    navigationToAdminItems(snapshot.navigation).filter(
      (item) =>
        canAccessNavItem(user, item) &&
        !contentTypeHrefs.has(item.href) &&
        !SITE_NAV_HREFS.has(item.href),
    ),
  );

  const siteItems: AdminNavItem[] = [
    { href: "/admin/media", label: "Media", icon: "🖼", permission: "media:read" },
    { href: "/admin/settings/theme", label: "Theme", icon: "🎨", permission: "settings:read" },
    { href: "/admin/plugins", label: "Plugins", icon: "🧩", permission: "plugins:read" },
  ].filter((item) => canAccessNavItem(user, item));

  const sections: AdminNavSection[] = [
    {
      id: "main",
      label: "",
      items: [{ href: "/admin/dashboard", label: "Dashboard", icon: "⌂" }],
    },
    {
      id: "content",
      label: "Content",
      items: contentItems,
    },
  ];

  if (extensionItems.length > 0) {
    sections.push({
      id: "extensions",
      label: "Extensions",
      items: extensionItems,
    });
  }

  sections.push({
    id: "site",
    label: "Site",
    items: siteItems,
  });

  return sections;
}
