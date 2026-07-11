import { BLOCK_TYPES } from "../foundation/registry";
import type { BlockCategory, BlockDefinitionMeta, BlockSupports } from "./types";

const CATEGORY_META: Record<
  string,
  { category: BlockCategory; icon: string; keywords: string[]; supports?: BlockSupports }
> = {
  paragraph: {
    category: "text",
    icon: "¶",
    keywords: ["text", "body", "p"],
    supports: { align: ["left", "center", "right"], spacing: true, color: true, anchor: true },
  },
  heading: {
    category: "text",
    icon: "H",
    keywords: ["title", "h1", "h2"],
    supports: { align: ["left", "center", "right"], spacing: true, color: true, anchor: true },
  },
  image: {
    category: "media",
    icon: "🖼",
    keywords: ["photo", "picture", "media"],
    supports: { align: ["default", "wide", "full", "left", "center", "right"], spacing: true },
  },
  button: {
    category: "design",
    icon: "▢",
    keywords: ["cta", "link"],
    supports: { align: ["left", "center", "right"] },
  },
  columns: {
    category: "layout",
    icon: "▥",
    keywords: ["grid", "layout", "row"],
    supports: {
      align: ["default", "wide", "full"],
      spacing: true,
      nesting: true,
    },
  },
  divider: {
    category: "layout",
    icon: "—",
    keywords: ["hr", "rule", "separator", "line"],
    supports: { align: ["left", "center", "right"], spacing: true, color: true },
  },
  spacer: {
    category: "layout",
    icon: "↕",
    keywords: ["space", "gap"],
    supports: { spacing: true },
  },
  quote: {
    category: "text",
    icon: "“",
    keywords: ["blockquote", "cite"],
    supports: { spacing: true },
  },
  list: {
    category: "text",
    icon: "≡",
    keywords: ["ul", "ol", "bullets"],
    supports: { spacing: true },
  },
  html: {
    category: "advanced",
    icon: "</>",
    keywords: ["raw", "custom"],
  },
  form: {
    category: "content",
    icon: "📋",
    keywords: ["forms", "contact"],
  },
  embed: {
    category: "media",
    icon: "▶",
    keywords: ["video", "iframe"],
  },
  event_list: {
    category: "dynamic",
    icon: "📅",
    keywords: ["events", "query"],
  },
  post_list: {
    category: "dynamic",
    icon: "☰",
    keywords: ["posts", "query", "feed"],
  },
};

/** Foundational types enabled in the visual editor inserter. */
export const VISUAL_EDITOR_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "image",
  "button",
  "divider",
  "columns",
  "spacer",
  "quote",
  "list",
  "html",
  "form",
] as const;

export function getBlockDefinitions(): BlockDefinitionMeta[] {
  const fromFoundation = BLOCK_TYPES.map((entry) => {
    const meta = CATEGORY_META[entry.type] ?? {
      category: "advanced" as BlockCategory,
      icon: "📄",
      keywords: [],
    };
    return {
      type: entry.type,
      label: entry.label,
      category: meta.category,
      icon: meta.icon,
      version: 1,
      keywords: meta.keywords,
      allows_children: Boolean(
        "allows_children" in entry && (entry as { allows_children?: boolean }).allows_children,
      ),
      supports: meta.supports,
      props_schema: entry.props_schema,
      source: String(entry.source),
    } satisfies BlockDefinitionMeta;
  });

  if (!fromFoundation.some((b) => b.type === "divider")) {
    fromFoundation.push({
      type: "divider",
      label: "Divider",
      description: "Visible horizontal rule between sections",
      category: "layout",
      icon: "—",
      version: 1,
      keywords: CATEGORY_META.divider.keywords,
      allows_children: false,
      supports: CATEGORY_META.divider.supports,
      props_schema: {
        style: { type: "string", default: "solid" },
        thickness: { type: "string", default: "1px" },
        width: { type: "string", default: "100%" },
        color: { type: "string", default: "currentColor" },
      },
      source: "core",
    });
  }

  return fromFoundation;
}

export function getVisualEditorBlockDefinitions(): BlockDefinitionMeta[] {
  const allowed = new Set<string>(VISUAL_EDITOR_BLOCK_TYPES);
  return getBlockDefinitions().filter((block) => allowed.has(block.type));
}

export function getBlockDefinition(type: string): BlockDefinitionMeta | undefined {
  return getBlockDefinitions().find((block) => block.type === type);
}
