import { Registry } from "./registry-base";
import type { ContentTypeDefinition } from "../foundation/types";

export type RegisteredContentType = ContentTypeDefinition & {
  key: string;
  plugin_id: string;
};

export class ContentTypeRegistry extends Registry<RegisteredContentType> {
  constructor() {
    super((entry) => entry.key);
  }

  validate(): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const type of this.getAll()) {
      if (seen.has(type.type_key)) {
        errors.push(`Duplicate content type: ${type.type_key}`);
      }
      seen.add(type.type_key);
    }
    return errors;
  }
}

export const contentTypeRegistry = new ContentTypeRegistry();
