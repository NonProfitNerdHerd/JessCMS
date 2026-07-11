import { getBlockDefinition } from "./definitions";
import type {
  Block,
  BlockValidationIssue,
  BlockValidationResult,
  ContentDocument,
} from "./types";
import { parseContentDocument } from "./render";

const MAX_DEPTH = 8;
const MAX_BLOCKS = 500;

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
