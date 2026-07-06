export interface BlockStyle {
  textAlign?: "left" | "center" | "right";
  margin?: string;
  padding?: string;
  backgroundColor?: string;
  className?: string;
  [key: string]: unknown;
}

export interface Block {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children: Block[];
  style: BlockStyle;
  plugin_source: string | null;
}

export interface ContentDocument {
  version: number;
  blocks: Block[];
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getAlignment(block: Block): "left" | "center" | "right" {
  const fromStyle = block.style?.textAlign;
  if (fromStyle === "center" || fromStyle === "right") {
    return fromStyle;
  }

  const fromProps = block.props?.alignment;
  if (fromProps === "center" || fromProps === "right") {
    return fromProps;
  }

  return "left";
}

function alignClass(block: Block): string {
  return `align-${getAlignment(block)}`;
}

function blockClass(type: string, block: Block): string {
  const extra = block.style?.className ? ` ${block.style.className}` : "";
  return `jess-block jess-${type} ${alignClass(block)}${extra}`.trim();
}

function buttonVariant(block: Block): string {
  const style = block.props.style ?? block.props.variant ?? "primary";
  if (style === "secondary" || style === "outline") {
    return style;
  }
  return "primary";
}

function headingTag(block: Block): string {
  const level = Number(block.props.level ?? 2);
  if (level >= 1 && level <= 4) {
    return `h${level}`;
  }
  return "h2";
}

function listItems(block: Block): string[] {
  const items = block.props.items;
  if (Array.isArray(items)) {
    return items.map((item) => String(item)).filter(Boolean);
  }
  if (typeof items === "string") {
    return items.split("\n").map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

export function renderBlock(block: Block): string {
  const classes = blockClass(block.type, block);

  switch (block.type) {
    case "paragraph":
      return `<p class="${classes}">${escapeHtml(block.props.text)}</p>`;

    case "heading": {
      const tag = headingTag(block);
      return `<${tag} class="${classes}">${escapeHtml(block.props.text)}</${tag}>`;
    }

    case "image": {
      const url = escapeHtml(block.props.url);
      const alt = escapeHtml(block.props.alt ?? "");
      const caption = block.props.caption
        ? `<figcaption>${escapeHtml(block.props.caption)}</figcaption>`
        : "";
      if (!url) {
        return `<figure class="${classes}"></figure>`;
      }
      return `<figure class="${classes}"><img src="${url}" alt="${alt}">${caption}</figure>`;
    }

    case "button": {
      const text = escapeHtml(block.props.text);
      const url = escapeHtml(block.props.url ?? "#");
      const variant = buttonVariant(block);
      return `<p class="${classes} jess-button-wrap"><a class="jess-button ${variant}" href="${url}">${text}</a></p>`;
    }

    case "quote": {
      const citation = block.props.citation
        ? `<cite>${escapeHtml(block.props.citation)}</cite>`
        : "";
      return `<blockquote class="${classes}"><p>${escapeHtml(block.props.text)}</p>${citation}</blockquote>`;
    }

    case "list": {
      const tag = block.props.ordered ? "ol" : "ul";
      const items = listItems(block)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
      return `<${tag} class="${classes}">${items}</${tag}>`;
    }

    case "spacer": {
      const height = escapeHtml(block.props.height ?? "2rem");
      return `<div class="${classes}" style="height:${height}" aria-hidden="true"></div>`;
    }

    case "html": {
      const raw = String(block.props.raw_html ?? block.props.raw ?? "");
      return `<div class="${classes}">${raw}</div>`;
    }

    default:
      return `<!-- unsupported block: ${escapeHtml(block.type)} -->`;
  }
}

export function renderBlocksToHtml(blocks: Block[]): string {
  return blocks.map((block) => renderBlock(block)).join("\n");
}

export function renderDocument(doc: ContentDocument): string {
  return renderBlocksToHtml(doc.blocks ?? []);
}

export function createBlockId(): string {
  return `blk_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function defaultBlockProps(type: string): Record<string, unknown> {
  switch (type) {
    case "paragraph":
      return { text: "", alignment: "left" };
    case "heading":
      return { text: "", level: 2, alignment: "left" };
    case "image":
      return { url: "", alt: "", caption: "" };
    case "button":
      return { text: "Click here", url: "", style: "primary", alignment: "left" };
    case "quote":
      return { text: "", citation: "" };
    case "list":
      return { ordered: false, items: [] };
    case "spacer":
      return { height: "2rem" };
    case "html":
      return { raw_html: "" };
    default:
      return {};
  }
}

export function createBlock(type: string): Block {
  const props = defaultBlockProps(type);
  const alignment = props.alignment;
  delete props.alignment;

  return {
    id: createBlockId(),
    type,
    props,
    children: [],
    style: alignment ? { textAlign: alignment as BlockStyle["textAlign"] } : {},
    plugin_source: null,
  };
}

export function normalizeBlock(raw: Partial<Block>): Block {
  const type = String(raw.type ?? "paragraph");
  const defaults = defaultBlockProps(type);
  const props = { ...defaults, ...(raw.props ?? {}) };
  const alignment = props.alignment;
  if ("alignment" in props) {
    delete props.alignment;
  }

  return {
    id: String(raw.id ?? createBlockId()),
    type,
    props,
    children: Array.isArray(raw.children) ? raw.children.map(normalizeBlock) : [],
    style: {
      ...(raw.style ?? {}),
      ...(alignment ? { textAlign: alignment as BlockStyle["textAlign"] } : {}),
    },
    plugin_source: raw.plugin_source ?? null,
  };
}

export function parseContentDocument(
  contentJson: string | null | undefined,
  contentHtml?: string | null,
): ContentDocument {
  if (contentJson?.trim()) {
    try {
      const parsed = JSON.parse(contentJson) as Partial<ContentDocument>;
      if (Array.isArray(parsed.blocks)) {
        return {
          version: Number(parsed.version ?? 1),
          blocks: parsed.blocks.map((block) => normalizeBlock(block as Partial<Block>)),
        };
      }
    } catch {
      // fall through to HTML fallback
    }
  }

  if (contentHtml?.trim()) {
    return {
      version: 1,
      blocks: [
        normalizeBlock({
          type: "html",
          props: { raw_html: contentHtml },
        }),
      ],
    };
  }

  return {
    version: 1,
    blocks: [createBlock("paragraph")],
  };
}

export const EDITOR_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "image",
  "button",
  "quote",
  "list",
  "spacer",
  "html",
] as const;
