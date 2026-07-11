import { getBlockDefinition } from "./definitions";
import type {
  Block,
  BlockValidationIssue,
  BlockValidationResult,
  ContentDocument,
} from "./types";
import { parseContentDocument } from "./render";
import {
  actionIsPartial,
  isValidUrl,
  normalizeAction,
  normalizeMedia,
} from "./shared-props";

const MAX_DEPTH = 8;
const MAX_BLOCKS = 500;
const FEATURE_ITEM_WARN = 24;

function walk(
  blocks: Block[],
  visitor: (block: Block, path: string, depth: number) => void,
  path = "blocks",
  depth = 0,
): void {
  blocks.forEach((block, index) => {
    const blockPath = `${path}[${index}]`;
    visitor(block, blockPath, depth);
    if (block.children?.length) {
      walk(block.children, visitor, `${blockPath}.children`, depth + 1);
    }
  });
}

function countBlocks(blocks: Block[]): number {
  let total = 0;
  walk(blocks, () => {
    total += 1;
  });
  return total;
}

function validateAction(
  action: unknown,
  block: Block,
  path: string,
  field: string,
  errors: BlockValidationIssue[],
  warnings: BlockValidationIssue[],
  required = false,
): void {
  const normalized = normalizeAction(action);
  if (!normalized) {
    if (required) {
      warnings.push({
        severity: "warning",
        code: "missing_action",
        message: `${field} is recommended`,
        block_id: block.id,
        path: `${path}.props.${field}`,
      });
    }
    return;
  }
  if (actionIsPartial(normalized)) {
    errors.push({
      severity: "error",
      code: "incomplete_action",
      message: `${field} requires both a label and a valid destination`,
      block_id: block.id,
      path: `${path}.props.${field}`,
    });
  }
}

function validateMediaAlt(
  media: unknown,
  block: Block,
  path: string,
  field: string,
  warnings: BlockValidationIssue[],
): void {
  const m = normalizeMedia(media);
  if (m.type === "image" && (m.imageUrl || m.imageId) && !String(m.alt ?? "").trim()) {
    warnings.push({
      severity: "warning",
      code: "image_missing_alt",
      message: `${field} is missing alt text`,
      block_id: block.id,
      path: `${path}.props.${field}.alt`,
    });
  }
}

export function validateContentDocument(
  input: ContentDocument | string | null | undefined,
): BlockValidationResult {
  const errors: BlockValidationIssue[] = [];
  const warnings: BlockValidationIssue[] = [];

  let doc: ContentDocument;
  try {
    if (typeof input === "string" || input == null) {
      doc = parseContentDocument(input ?? "");
    } else {
      doc = {
        version: Number(input.version ?? 1),
        blocks: Array.isArray(input.blocks) ? input.blocks : [],
      };
    }
  } catch {
    return {
      valid: false,
      errors: [
        {
          severity: "error",
          code: "invalid_json",
          message: "Block document is not valid JSON",
        },
      ],
      warnings: [],
    };
  }

  if (!Array.isArray(doc.blocks)) {
    errors.push({
      severity: "error",
      code: "missing_blocks",
      message: "Document must include a blocks array",
    });
    return { valid: false, errors, warnings };
  }

  const total = countBlocks(doc.blocks);
  if (total > MAX_BLOCKS) {
    errors.push({
      severity: "error",
      code: "too_many_blocks",
      message: `Document exceeds ${MAX_BLOCKS} blocks`,
    });
  }

  const seenIds = new Set<string>();
  let h1Count = 0;

  walk(doc.blocks, (block, path, depth) => {
    if (depth > MAX_DEPTH) {
      errors.push({
        severity: "error",
        code: "nesting_too_deep",
        message: `Block nesting exceeds ${MAX_DEPTH} levels`,
        block_id: block.id,
        path,
      });
    }

    if (!block.id) {
      errors.push({
        severity: "error",
        code: "missing_id",
        message: "Block is missing an id",
        path,
      });
    } else if (seenIds.has(block.id)) {
      errors.push({
        severity: "error",
        code: "duplicate_id",
        message: `Duplicate block id ${block.id}`,
        block_id: block.id,
        path,
      });
    } else {
      seenIds.add(block.id);
    }

    const def = getBlockDefinition(block.type);
    if (!def) {
      warnings.push({
        severity: "warning",
        code: "unknown_block",
        message: `Unknown block type “${block.type}”`,
        block_id: block.id,
        path,
      });
    }

    if (block.type === "heading" && Number(block.props?.level ?? 2) === 1) {
      h1Count += 1;
    }
    if (block.type === "hero" && Number(block.props?.headingLevel ?? 1) === 1) {
      h1Count += 1;
    }

    if (block.type === "button") {
      if (!String(block.props?.text ?? "").trim()) {
        errors.push({
          severity: "error",
          code: "empty_button_label",
          message: "Button label is required",
          block_id: block.id,
          path,
        });
      }
    }

    if (block.type === "image") {
      const hasSrc = Boolean(block.props?.url || block.props?.media_id);
      if (!hasSrc) {
        warnings.push({
          severity: "warning",
          code: "image_missing_src",
          message: "Image has no media selected",
          block_id: block.id,
          path,
        });
      } else if (!String(block.props?.alt ?? "").trim()) {
        warnings.push({
          severity: "warning",
          code: "image_missing_alt",
          message: "Image is missing alt text",
          block_id: block.id,
          path,
        });
      }
    }

    if (block.type === "columns") {
      if (!block.children?.length) {
        warnings.push({
          severity: "warning",
          code: "empty_columns",
          message: "Columns block has no column children",
          block_id: block.id,
          path,
        });
      }
      for (const child of block.children ?? []) {
        if (child.type !== "column") {
          errors.push({
            severity: "error",
            code: "invalid_column_child",
            message: "Columns may only contain column children",
            block_id: child.id,
            path,
          });
        }
      }
    }

    if (block.type === "hero") {
      if (!String(block.props?.heading ?? "").trim()) {
        errors.push({
          severity: "error",
          code: "hero_heading_required",
          message: "Hero heading is required",
          block_id: block.id,
          path: `${path}.props.heading`,
        });
      }
      const level = Number(block.props?.headingLevel ?? 1);
      if (level !== 1 && level !== 2) {
        warnings.push({
          severity: "warning",
          code: "hero_heading_level",
          message: "Hero heading level should be H1 or H2",
          block_id: block.id,
          path: `${path}.props.headingLevel`,
        });
      }
      validateAction(block.props?.primaryAction, block, path, "primaryAction", errors, warnings);
      validateAction(block.props?.secondaryAction, block, path, "secondaryAction", errors, warnings);
      validateMediaAlt(block.props?.media, block, path, "media", warnings);
      const overlay = block.props?.overlay as { opacity?: number } | undefined;
      if (overlay && overlay.opacity != null) {
        const opacity = Number(overlay.opacity);
        if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
          errors.push({
            severity: "error",
            code: "overlay_opacity",
            message: "Overlay opacity must be between 0 and 1",
            block_id: block.id,
            path: `${path}.props.overlay.opacity`,
          });
        }
      }
    }

    if (block.type === "call_to_action") {
      if (!String(block.props?.heading ?? "").trim()) {
        errors.push({
          severity: "error",
          code: "cta_heading_required",
          message: "Call to Action heading is required",
          block_id: block.id,
          path: `${path}.props.heading`,
        });
      }
      const primary = normalizeAction(block.props?.primaryAction);
      const secondary = normalizeAction(block.props?.secondaryAction);
      if (!primary && !secondary) {
        warnings.push({
          severity: "warning",
          code: "cta_missing_action",
          message: "Call to Action should include at least one action",
          block_id: block.id,
          path: `${path}.props.primaryAction`,
        });
      }
      validateAction(block.props?.primaryAction, block, path, "primaryAction", errors, warnings);
      validateAction(block.props?.secondaryAction, block, path, "secondaryAction", errors, warnings);
      validateMediaAlt(block.props?.media, block, path, "media", warnings);
    }

    if (block.type === "card") {
      if (!String(block.props?.heading ?? "").trim()) {
        errors.push({
          severity: "error",
          code: "card_heading_required",
          message: "Card heading is required",
          block_id: block.id,
          path: `${path}.props.heading`,
        });
      }
      const linkMode = String(block.props?.linkMode ?? "button");
      if (linkMode !== "button" && linkMode !== "card") {
        errors.push({
          severity: "error",
          code: "card_link_mode",
          message: "Card link mode must be button or card",
          block_id: block.id,
          path: `${path}.props.linkMode`,
        });
      }
      const linkUrl = String(block.props?.linkUrl ?? "").trim();
      if (linkUrl && !isValidUrl(linkUrl)) {
        errors.push({
          severity: "error",
          code: "card_invalid_link",
          message: "Card link destination is invalid",
          block_id: block.id,
          path: `${path}.props.linkUrl`,
        });
      }
      if (linkMode === "card" && !linkUrl) {
        warnings.push({
          severity: "warning",
          code: "card_linked_without_url",
          message: "Entire-card link mode needs a destination URL",
          block_id: block.id,
          path: `${path}.props.linkUrl`,
        });
      }
      validateMediaAlt(block.props?.media, block, path, "media", warnings);
    }

    if (block.type === "image_box") {
      if (!String(block.props?.heading ?? "").trim()) {
        errors.push({
          severity: "error",
          code: "image_box_heading_required",
          message: "Image Box heading is required",
          block_id: block.id,
          path: `${path}.props.heading`,
        });
      }
      const width = Number(block.props?.imageWidth ?? 50);
      if (!Number.isFinite(width) || width < 20 || width > 80) {
        warnings.push({
          severity: "warning",
          code: "image_box_width",
          message: "Image width should be between 20% and 80%",
          block_id: block.id,
          path: `${path}.props.imageWidth`,
        });
      }
      validateAction(block.props?.primaryAction, block, path, "primaryAction", errors, warnings);
      validateAction(block.props?.secondaryAction, block, path, "secondaryAction", errors, warnings);
      validateMediaAlt(block.props?.media, block, path, "media", warnings);
    }

    if (block.type === "feature_grid") {
      const items = Array.isArray(block.props?.items) ? block.props.items : [];
      if (!items.length) {
        errors.push({
          severity: "error",
          code: "feature_grid_empty",
          message: "Feature Grid requires at least one item",
          block_id: block.id,
          path: `${path}.props.items`,
        });
      }
      if (items.length > FEATURE_ITEM_WARN) {
        warnings.push({
          severity: "warning",
          code: "feature_grid_many_items",
          message: `Feature Grid has ${items.length} items (recommended max ${FEATURE_ITEM_WARN})`,
          block_id: block.id,
          path: `${path}.props.items`,
        });
      }
      const itemIds = new Set<string>();
      items.forEach((raw, index) => {
        const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
        const id = String(item.id ?? "");
        if (!id) {
          errors.push({
            severity: "error",
            code: "feature_item_missing_id",
            message: "Feature item is missing an id",
            block_id: block.id,
            path: `${path}.props.items[${index}].id`,
          });
        } else if (itemIds.has(id)) {
          errors.push({
            severity: "error",
            code: "feature_item_duplicate_id",
            message: `Duplicate feature item id ${id}`,
            block_id: block.id,
            path: `${path}.props.items[${index}].id`,
          });
        } else {
          itemIds.add(id);
        }
        if (!String(item.heading ?? "").trim()) {
          errors.push({
            severity: "error",
            code: "feature_item_heading_required",
            message: "Each feature item requires a heading",
            block_id: block.id,
            path: `${path}.props.items[${index}].heading`,
          });
        }
        const linkUrl = String(item.linkUrl ?? "").trim();
        const linkLabel = String(item.linkLabel ?? "").trim();
        if ((linkUrl && !linkLabel) || (!linkUrl && linkLabel) || (linkUrl && !isValidUrl(linkUrl))) {
          errors.push({
            severity: "error",
            code: "feature_item_link",
            message: "Feature item link requires a label and valid URL",
            block_id: block.id,
            path: `${path}.props.items[${index}].linkUrl`,
          });
        }
        validateMediaAlt(item.image, block, path, `items[${index}].image`, warnings);
      });

      const cols = (block.props?.columns as { desktop?: number; tablet?: number; mobile?: number }) ?? {};
      const desktop = Number(cols.desktop ?? 3);
      const tablet = Number(cols.tablet ?? 2);
      const mobile = Number(cols.mobile ?? 1);
      for (const [name, value] of [
        ["desktop", desktop],
        ["tablet", tablet],
        ["mobile", mobile],
      ] as const) {
        if (!Number.isFinite(value) || value < 1 || value > 6) {
          errors.push({
            severity: "error",
            code: "feature_grid_columns",
            message: `Feature Grid ${name} columns must be between 1 and 6`,
            block_id: block.id,
            path: `${path}.props.columns.${name}`,
          });
        }
      }
      if (mobile > tablet || tablet > desktop) {
        warnings.push({
          severity: "warning",
          code: "feature_grid_column_order",
          message: "Mobile columns should not exceed tablet, and tablet should not exceed desktop",
          block_id: block.id,
          path: `${path}.props.columns`,
        });
      }
    }

    if (def && !def.allows_children && (block.children?.length ?? 0) > 0) {
      warnings.push({
        severity: "warning",
        code: "unexpected_children",
        message: `Block type “${block.type}” does not support children`,
        block_id: block.id,
        path,
      });
    }
  });

  if (h1Count > 1) {
    warnings.push({
      severity: "warning",
      code: "multiple_h1",
      message: `Document has ${h1Count} H1 headings`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function canPublishDocument(
  input: ContentDocument | string | null | undefined,
): BlockValidationResult {
  const result = validateContentDocument(input);
  return {
    ...result,
    valid: result.errors.length === 0,
  };
}
