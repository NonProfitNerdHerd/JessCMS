import { Registry } from "./registry-base";
import type { RuntimePermissionDefinition } from "./types";

export class PermissionRegistry extends Registry<RuntimePermissionDefinition> {
  constructor() {
    super((entry) => entry.slug);
  }

  validate(): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const permission of this.getAll()) {
      if (seen.has(permission.slug)) {
        errors.push(`Duplicate permission: ${permission.slug}`);
      }
      seen.add(permission.slug);
    }
    return errors;
  }
}

export const permissionRegistry = new PermissionRegistry();
