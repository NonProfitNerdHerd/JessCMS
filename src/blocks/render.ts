import type { Block, BlockStyle, ContentDocument } from "./types";

export type { Block, BlockStyle, ContentDocument } from "./types";

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

function widthClass(block: Block): string {
  const width = block.style?.width ?? block.props?.width;
  if (width === "wide") return " is-wide";
  if (width === "full") return " is-full";
  return "";
}

function alignClass(block: Block): string {
  return `align-${getAlignment(block)}`;
}

function blockClass(type: string, block: Block): string {
  const extra = block.style?.className ? ` ${block.style.className}` : "";
  return `jess-block jess-${type} ${alignClass(block)}${widthClass(block)}${extra}`.trim();
}

function inlineStyle(block: Block): string {
  const parts: string[] = [];
  if (block.style?.backgroundColor) {
    parts.push(`background-color:${escapeHtml(block.style.backgroundColor)}`);
  }
  if (block.style?.textColor) {
    parts.push(`color:${escapeHtml(block.style.textColor)}`);
  }
  if (block.style?.margin) {
    parts.push(`margin:${escapeHtml(block.style.margin)}`);
  }
  if (block.style?.padding) {
    parts.push(`padding:${escapeHtml(block.style.padding)}`);
  }
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

function anchorAttr(block: Block): string {
  const anchor = block.style?.anchor ?? block.props?.anchor;
  if (!anchor) return "";
  return ` id="${escapeHtml(String(anchor))}"`;
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
  if (level >= 1 && level <= 6) {
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

function columnWidths(count: number, ratios?: unknown): string[] {
  if (Array.isArray(ratios) && ratios.length === count) {
    return ratios.map((value) => String(value));
  }
  const equal = `${(100 / Math.max(count, 1)).toFixed(4)}%`;
  return Array.from({ length: count }, () => equal);
}

export function renderBlock(block: Block): string {
  const classes = blockClass(block.type, block);
  const styleAttr = inlineStyle(block);
  const idAttr = anchorAttr(block);

  switch (block.type) {
    case "paragraph":
      return `<p class="${classes}"${idAttr}${styleAttr}>${escapeHtml(block.props.text)}</p>`;

    case "heading": {
      const tag = headingTag(block);
      return `<${tag} class="${classes}"${idAttr}${styleAttr}>${escapeHtml(block.props.text)}</${tag}>`;
    }

    case "image": {
      const url = escapeHtml(block.props.url);
      const alt = escapeHtml(block.props.alt ?? "");
      const caption = block.props.caption
        ? `<figcaption>${escapeHtml(block.props.caption)}</figcaption>`
        : "";
      if (!url) {
        return `<figure class="${classes}"${idAttr}${styleAttr}></figure>`;
      }
      const link = block.props.link
        ? `<a href="${escapeHtml(block.props.link)}"${block.props.open_in_new_tab ? ' target="_blank" rel="noopener noreferrer"' : ""}><img src="${url}" alt="${alt}" loading="lazy"></a>`
        : `<img src="${url}" alt="${alt}" loading="lazy">`;
      return `<figure class="${classes}"${idAttr}${styleAttr}>${link}${caption}</figure>`;
    }

    case "button": {
      const text = escapeHtml(block.props.text);
      const url = escapeHtml(block.props.url ?? "#");
      const variant = buttonVariant(block);
      const target = block.props.open_in_new_tab
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";
      return `<p class="${classes} jess-button-wrap"${idAttr}${styleAttr}><a class="jess-button ${variant}" href="${url}"${target}>${text}</a></p>`;
    }

    case "quote": {
      const citation = block.props.citation
        ? `<cite>${escapeHtml(block.props.citation)}</cite>`
        : "";
      return `<blockquote class="${classes}"${idAttr}${styleAttr}><p>${escapeHtml(block.props.text)}</p>${citation}</blockquote>`;
    }

    case "list": {
      const tag = block.props.ordered ? "ol" : "ul";
      const items = listItems(block)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
      return `<${tag} class="${classes}"${idAttr}${styleAttr}>${items}</${tag}>`;
    }

    case "spacer": {
      const height = escapeHtml(block.props.height ?? "2rem");
      return `<div class="${classes}"${idAttr} style="height:${height}" aria-hidden="true"></div>`;
    }

    case "divider": {
      const thickness = escapeHtml(block.props.thickness ?? "1px");
      const color = escapeHtml(block.props.color ?? "currentColor");
      const width = escapeHtml(block.props.width ?? "100%");
      const borderStyle = escapeHtml(block.props.style ?? "solid");
      return `<hr class="${classes}"${idAttr} style="border:0;border-top:${thickness} ${borderStyle} ${color};width:${width};margin-inline:auto" />`;
    }

    case "html": {
      const raw = String(block.props.raw_html ?? block.props.raw ?? "");
      return `<div class="${classes}"${idAttr}${styleAttr}>${raw}</div>`;
    }

    case "columns": {
      const children = block.children?.length
        ? block.children
        : [];
      const count = Math.max(
        children.length,
        Number(block.props.columnCount ?? block.props.columns ?? children.length ?? 2),
      );
      const widths = columnWidths(count, block.props.ratios);
      const gap = escapeHtml(block.props.gap ?? "1.5rem");
      const cols = children
        .map((child, index) => {
          const width = widths[index] ?? widths[0];
          const inner = renderBlocksToHtml(child.children ?? []);
          return `<div class="jess-column" style="flex:1 1 ${width};max-width:${width}">${inner || "<!-- empty column -->"}</div>`;
        })
        .join("");
      return `<div class="${classes} jess-columns"${idAttr}${styleAttr} style="display:flex;flex-wrap:wrap;gap:${gap}">${cols}</div>`;
    }

    case "column":
      return `<div class="${classes}"${idAttr}${styleAttr}>${renderBlocksToHtml(block.children ?? [])}</div>`;

    default:
      if (block.children?.length) {
        return `<div class="${classes}"${idAttr}${styleAttr} data-unknown-block="${escapeHtml(block.type)}">${renderBlocksToHtml(block.children)}</div>`;
      }
      return `<!-- unsupported block: ${escapeHtml(block.type)} -->`;
  }
}

export function renderBlocksToHtml(blocks: Block[]): string {
  return (blocks ?? []).map((block) => renderBlock(block)).join("\n");
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
      return { url: "", alt: "", caption: "", media_id: "", link: "", open_in_new_tab: false };
    case "button":
      return { text: "Click here", url: "", style: "primary", alignment: "left", open_in_new_tab: false };
    case "quote":
      return { text: "", citation: "" };
    case "list":
      return { ordered: false, items: [] };
    case "spacer":
      return { height: "2rem" };
    case "divider":
      return { style: "solid", thickness: "1px", width: "100%", color: "currentColor", alignment: "center" };
    case "html":
      return { raw_html: "" };
    case "form":
      return { form_id: "", form_slug: "", display_style: "embedded" };
    case "columns":
      return { columnCount: 2, gap: "1.5rem", ratios: ["50%", "50%"] };
    case "column":
      return { width: "50%" };
    default:
      return {};
  }
}

function createColumnChild(width: string): Block {
  return {
    id: createBlockId(),
    type: "column",
    props: { width },
    children: [createBlock("paragraph")],
    style: {},
    plugin_source: null,
  };
}

export function createBlock(type: string): Block {
  const props = defaultBlockProps(type);
  const alignment = props.alignment;
  delete props.alignment;

  const block: Block = {
    id: createBlockId(),
    type,
    props,
    children: [],
    style: alignment ? { textAlign: alignment as BlockStyle["textAlign"] } : {},
    plugin_source: null,
  };

  if (type === "columns") {
    const count = Number(props.columnCount ?? 2);
    const ratios = Array.isArray(props.ratios)
      ? (props.ratios as string[])
      : Array.from({ length: count }, () => `${(100 / count).toFixed(0)}%`);
    block.children = ratios.slice(0, count).map((width) => createColumnChild(String(width)));
  }

  if (type === "form") {
    block.plugin_source = "forms-builder";
  }

  return block;
}

export function normalizeBlock(raw: Partial<Block>): Block {
  const type = String(raw.type ?? "paragraph");
  const defaults = defaultBlockProps(type);
  const props = { ...defaults, ...(raw.props ?? {}) };
  const alignment = props.alignment;
  if ("alignment" in props) {
    delete props.alignment;
  }

  let children = Array.isArray(raw.children)
    ? raw.children.map((child) => normalizeBlock(child as Partial<Block>))
    : [];

  if (type === "columns" && children.length === 0) {
    const count = Number(props.columnCount ?? 2);
    children = Array.from({ length: count }, () => createColumnChild(`${(100 / count).toFixed(0)}%`));
  }

  return {
    id: String(raw.id ?? createBlockId()),
    type,
    props,
    children,
    style: {
      ...(raw.style ?? {}),
      ...(alignment ? { textAlign: alignment as BlockStyle["textAlign"] } : {}),
    },
    plugin_source: raw.plugin_source ?? (type === "form" ? "forms-builder" : null),
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

export function cloneBlock(source: Block): Block {
  return normalizeBlock({
    ...source,
    id: createBlockId(),
    props: { ...source.props },
    style: { ...(source.style ?? {}) },
    children: (source.children ?? []).map((child) => cloneBlock(child)),
  });
}

export const EDITOR_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "image",
  "button",
  "divider",
  "columns",
  "quote",
  "list",
  "spacer",
  "html",
] as const;
