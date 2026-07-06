import { Registry } from "./registry-base";
import type { RuntimeNavigationItem } from "./types";

export class NavigationRegistry extends Registry<RuntimeNavigationItem> {
  constructor() {
    super((entry) => entry.key);
  }

  sorted(): RuntimeNavigationItem[] {
    return [...this.getAll()].sort((a, b) => a.sort_order - b.sort_order);
  }
}

export const navigationRegistry = new NavigationRegistry();
