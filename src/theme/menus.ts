import type { PublicMenuItem, PublicMenus } from "../public/types";

interface MenuItemRow {
  id: string;
  menu_id: string;
  parent_id: string | null;
  label: string;
  url: string | null;
  content_type: string | null;
  content_id: string | null;
  sort_order: number;
  open_in_new_tab: number;
}

async function resolveItemUrl(db: D1Database, row: MenuItemRow): Promise<string> {
  if (row.url) return row.url;

  if (row.content_type === "page" && row.content_id) {
    const page = await db
      .prepare("SELECT slug FROM pages WHERE id = ?")
      .bind(row.content_id)
      .first<{ slug: string }>();
    if (page) return `/${page.slug}`;
  }

  if (row.content_type === "post" && row.content_id) {
    const post = await db
      .prepare("SELECT slug FROM posts WHERE id = ?")
      .bind(row.content_id)
      .first<{ slug: string }>();
    if (post) return `/blog/${post.slug}`;
  }

  if (row.content_type === "event" && row.content_id) {
    const event = await db
      .prepare("SELECT slug FROM events WHERE id = ?")
      .bind(row.content_id)
      .first<{ slug: string }>();
    if (event) return `/events/${event.slug}`;
  }

  return "#";
}

function isActivePath(currentPath: string, itemUrl: string): boolean {
  if (itemUrl === "/") return currentPath === "/";
  return currentPath === itemUrl || currentPath.startsWith(`${itemUrl}/`);
}

function buildMenuTree(
  rows: MenuItemRow[],
  urls: Map<string, string>,
  currentPath: string,
  parentId: string | null = null,
): PublicMenuItem[] {
  return rows
    .filter((row) => row.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => {
      const url = urls.get(row.id) ?? "#";
      const children = buildMenuTree(rows, urls, currentPath, row.id);
      const childActive = children.some((child) => child.isActive);
      return {
        id: row.id,
        label: row.label,
        url,
        openInNewTab: row.open_in_new_tab === 1,
        children,
        isActive: isActivePath(currentPath, url) || childActive,
      };
    });
}

async function loadMenuByLocation(
  db: D1Database,
  location: string,
  currentPath: string,
): Promise<PublicMenuItem[]> {
  const menu = await db
    .prepare("SELECT id FROM menus WHERE location = ? OR slug = ? LIMIT 1")
    .bind(location, location)
    .first<{ id: string }>();

  if (!menu) return [];

  const items = await db
    .prepare(
      `
        SELECT id, menu_id, parent_id, label, url, content_type, content_id,
               sort_order, open_in_new_tab
        FROM menu_items
        WHERE menu_id = ?
        ORDER BY sort_order ASC
      `,
    )
    .bind(menu.id)
    .all<MenuItemRow>();

  const rows = items.results ?? [];
  const urls = new Map<string, string>();
  for (const row of rows) {
    urls.set(row.id, await resolveItemUrl(db, row));
  }

  return buildMenuTree(rows, urls, currentPath);
}

export async function loadPublicMenus(
  db: D1Database,
  currentPath: string,
): Promise<PublicMenus> {
  const [primary, footer] = await Promise.all([
    loadMenuByLocation(db, "primary", currentPath),
    loadMenuByLocation(db, "footer", currentPath),
  ]);

  return { primary, footer };
}
