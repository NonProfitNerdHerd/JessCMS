import { Registry } from "./registry-base";
import type { RuntimeBlockDefinition } from "./types";

export class BlockRegistry extends Registry<RuntimeBlockDefinition> {
  constructor() {
    super((entry) => entry.type);
  }

  validate(): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const block of this.getAll()) {
      if (seen.has(block.type)) {
        errors.push(`Duplicate block type: ${block.type}`);
      }
      seen.add(block.type);
    }
    return errors;
  }
}

export const blockRegistry = new BlockRegistry();
