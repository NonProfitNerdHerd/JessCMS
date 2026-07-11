import type { Block, ContentDocument } from "./types";
import { normalizeMarketingProps, remintFeatureItemIds } from "./marketing";

const MARKETING_TYPES = new Set([
  "hero",
  "call_to_action",
  "card",
  "image_box",
  "feature_grid",
]);

/**
 * Migrate a single block to the current schema version.
 * Initial migrations are identity + defaults fill for marketing blocks.
 */
export function migrateBlock(block: Block): Block {
  if (!MARKETING_TYPES.has(block.type)) {
    return block;
  }

  const version = Number(block.props?.version ?? 0);
  let props = { ...block.props };

  // v0 / missing → v1: apply defaults for missing keys
  if (version < 1) {
    props = normalizeMarketingProps(block.type, props);
    props.version = 1;
  } else {
    props = normalizeMarketingProps(block.type, props);
  }

  return {
    ...block,
    props,
  };
}

export function migrateDocument(doc: ContentDocument): ContentDocument {
  const walk = (blocks: Block[]): Block[] =>
    blocks.map((block) => ({
      ...migrateBlock(block),
      children: walk(block.children ?? []),
    }));

  return {
    version: Number(doc.version ?? 1),
    blocks: walk(doc.blocks ?? []),
  };
}

export function prepareClonedMarketingProps(
  type: string,
  props: Record<string, unknown>,
): Record<string, unknown> {
  if (type === "feature_grid") {
    return remintFeatureItemIds(props);
  }
  return props;
}
