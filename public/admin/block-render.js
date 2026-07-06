(function (global) {
  const EDITOR_BLOCK_TYPES = [
    "paragraph",
    "heading",
    "image",
    "button",
    "quote",
    "list",
    "spacer",
    "html",
  ];

  const BLOCK_LABELS = {
    paragraph: "Paragraph",
    heading: "Heading",
    image: "Image",
    button: "Button",
    quote: "Quote",
    list: "List",
    spacer: "Spacer",
    html: "Custom HTML",
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getAlignment(block) {
    const fromStyle = block.style?.textAlign;
    if (fromStyle === "center" || fromStyle === "right") return fromStyle;
    const fromProps = block.props?.alignment;
    if (fromProps === "center" || fromProps === "right") return fromProps;
    return "left";
  }

  function alignClass(block) {
    return `align-${getAlignment(block)}`;
  }

  function blockClass(type, block) {
    const extra = block.style?.className ? ` ${block.style.className}` : "";
    return `jess-block jess-${type} ${alignClass(block)}${extra}`.trim();
  }

  function buttonVariant(block) {
    const style = block.props.style ?? block.props.variant ?? "primary";
    if (style === "secondary" || style === "outline") return style;
    return "primary";
  }

  function headingTag(block) {
    const level = Number(block.props.level ?? 2);
    if (level >= 1 && level <= 4) return `h${level}`;
    return "h2";
  }

  function listItems(block) {
    const items = block.props.items;
    if (Array.isArray(items)) {
      return items.map((item) => String(item)).filter(Boolean);
    }
    if (typeof items === "string") {
      return items.split("\n").map((line) => line.trim()).filter(Boolean);
    }
    return [];
  }

  function renderBlock(block) {
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
        if (!url) return `<figure class="${classes}"></figure>`;
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

  function renderBlocksToHtml(blocks) {
    return (blocks ?? []).map((block) => renderBlock(block)).join("\n");
  }

  function renderDocument(doc) {
    return renderBlocksToHtml(doc.blocks ?? []);
  }

  function createBlockId() {
    if (global.crypto?.randomUUID) {
      return `blk_${global.crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    }
    return `blk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  function defaultBlockProps(type) {
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

  function createBlock(type) {
    const props = defaultBlockProps(type);
    const alignment = props.alignment;
    delete props.alignment;

    return {
      id: createBlockId(),
      type,
      props,
      children: [],
      style: alignment ? { textAlign: alignment } : {},
      plugin_source: null,
    };
  }

  function normalizeBlock(raw) {
    const type = String(raw.type ?? "paragraph");
    const defaults = defaultBlockProps(type);
    const props = { ...defaults, ...(raw.props ?? {}) };
    const alignment = props.alignment;
    if ("alignment" in props) delete props.alignment;

    return {
      id: String(raw.id ?? createBlockId()),
      type,
      props,
      children: Array.isArray(raw.children) ? raw.children.map(normalizeBlock) : [],
      style: {
        ...(raw.style ?? {}),
        ...(alignment ? { textAlign: alignment } : {}),
      },
      plugin_source: raw.plugin_source ?? null,
    };
  }

  function parseContentDocument(contentJson, contentHtml) {
    if (contentJson?.trim()) {
      try {
        const parsed = JSON.parse(contentJson);
        if (Array.isArray(parsed.blocks)) {
          return {
            version: Number(parsed.version ?? 1),
            blocks: parsed.blocks.map((block) => normalizeBlock(block)),
          };
        }
      } catch {
        // fall through
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

  global.JessBlockRender = {
    EDITOR_BLOCK_TYPES,
    BLOCK_LABELS,
    escapeHtml,
    renderBlock,
    renderBlocksToHtml,
    renderDocument,
    createBlockId,
    createBlock,
    normalizeBlock,
    parseContentDocument,
    getAlignment,
  };
})(window);
