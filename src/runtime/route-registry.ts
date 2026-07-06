import { Registry } from "./registry-base";
import type { RuntimeRouteDefinition } from "./types";

export class RouteRegistry extends Registry<RuntimeRouteDefinition> {
  constructor() {
    super((entry) => entry.key);
  }

  validate(): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const route of this.getAll()) {
      if (seen.has(route.key)) {
        errors.push(`Duplicate route: ${route.key}`);
      }
      seen.add(route.key);
    }
    return errors;
  }
}

export const routeRegistry = new RouteRegistry();
