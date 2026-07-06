import { getRuntime } from "./sync";
import type { RuntimeNavigationItem } from "./types";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
  permission?: string | null;
}

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

export async function getAdminNavigation(env: Env): Promise<AdminNavItem[]> {
  const snapshot = await getRuntime(env);
  const runtimeItems = navigationToAdminItems(snapshot.navigation);

  return dedupeNavItems([
    { href: "/admin/dashboard", label: "Dashboard", icon: "⌂" },
    ...runtimeItems,
    { href: "/admin/profile", label: "Profile", icon: "👤" },
  ]);
}
