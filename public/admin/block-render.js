(function (global) {
  const EDITOR_BLOCK_TYPES = [
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
    "form",
    "hero",
    "call_to_action",
    "card",
    "image_box",
    "feature_grid",
  ];

  const BLOCK_LABELS = {
    paragraph: "Paragraph",
    heading: "Heading",
    image: "Image",
    button: "Button",
    divider: "Divider",
    columns: "Columns",
    column: "Column",
    quote: "Quote",
    list: "List",
    spacer: "Spacer",
    html: "Custom HTML",
    form: "Form",
    hero: "Hero",
    call_to_action: "Call to Action",
    card: "Card",
    image_box: "Image Box",
    feature_grid: "Feature Grid",
  };

  const BLOCK_CATEGORIES = {
    paragraph: "text",
    heading: "text",
    quote: "text",
    list: "text",
    image: "media",
    button: "design",
    divider: "layout",
    columns: "layout",
    spacer: "layout",
    html: "advanced",
    form: "content",
    hero: "layout",
    call_to_action: "marketing",
    card: "marketing",
    image_box: "layout",
    feature_grid: "marketing",
  };

  function createItemId() {
    if (global.crypto?.randomUUID) {
      return `item_${global.crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    }
    return `item_${Math.random().toString(16).slice(2, 12)}`;
  }

  function emptyAction() {
    return { label: "", url: "", target: "_self", style: "primary" };
  }

  function emptyMedia() {
    return { type: "none", imageId: "", imageUrl: "", alt: "", focalPoint: { x: 50, y: 50 } };
  }

  function emptyBackground() {
    return { color: null, image: emptyMedia(), position: "center center", size: "cover", repeat: "no-repeat" };
  }

  function emptyOverlay() {
    return { enabled: false, color: { type: "custom", value: "#000000" }, opacity: 0.4 };
  }

  function emptyBorder() {
    return { color: null, width: "0", radius: "", style: "solid" };
  }

  function marketingDefaults(type) {
    if (type === "hero") {
      return {
        version: 1,
        eyebrow: "",
        heading: "",
        headingLevel: 1,
        description: "",
        primaryAction: emptyAction(),
        secondaryAction: emptyAction(),
        media: emptyMedia(),
        layout: "centered",
        contentAlignment: "center",
        verticalAlignment: "center",
        minHeight: { desktop: "28rem" },
        contentWidth: "42rem",
        background: emptyBackground(),
        overlay: emptyOverlay(),
        spacing: { margin: "", padding: "3rem 1.5rem" },
        border: emptyBorder(),
        boxShadow: "",
        stackOnMobile: true,
      };
    }
    if (type === "call_to_action") {
      return {
        version: 1,
        eyebrow: "",
        heading: "",
        headingLevel: 2,
        description: "",
        primaryAction: emptyAction(),
        secondaryAction: emptyAction(),
        media: emptyMedia(),
        layout: "centered",
        contentAlignment: "center",
        background: emptyBackground(),
        overlay: emptyOverlay(),
        border: emptyBorder(),
        boxShadow: "",
        spacing: { margin: "", padding: "2.5rem 1.5rem" },
        stackOnMobile: true,
      };
    }
    if (type === "card") {
      return {
        version: 1,
        eyebrow: "",
        heading: "",
        headingLevel: 3,
        description: "",
        media: emptyMedia(),
        imagePosition: "top",
        aspectRatio: "16/9",
        orientation: "vertical",
        linkMode: "button",
        linkUrl: "",
        linkTarget: "_self",
        buttonLabel: "",
        buttonStyle: "primary",
        textAlignment: "left",
        background: emptyBackground(),
        border: { color: { type: "custom", value: "#e2e8f0" }, width: "1px", radius: "0.75rem", style: "solid" },
        boxShadow: "",
        spacing: { margin: "", padding: "1.25rem" },
        hoverStyle: "lift",
        minHeight: "",
      };
    }
    if (type === "image_box") {
      return {
        version: 1,
        eyebrow: "",
        heading: "",
        headingLevel: 2,
        description: "",
        media: emptyMedia(),
        layout: "image-left",
        imageWidth: 50,
        verticalAlignment: "center",
        primaryAction: emptyAction(),
        secondaryAction: emptyAction(),
        background: emptyBackground(),
        overlay: emptyOverlay(),
        border: emptyBorder(),
        boxShadow: "",
        spacing: { margin: "", padding: "2rem 0" },
        minHeight: "",
        stackOnMobile: true,
        reverseOnMobile: false,
      };
    }
    if (type === "feature_grid") {
      return {
        version: 1,
        eyebrow: "",
        heading: "",
        headingLevel: 2,
        description: "",
        items: [
          { id: createItemId(), icon: "", image: emptyMedia(), heading: "", description: "", linkUrl: "", linkLabel: "" },
          { id: createItemId(), icon: "", image: emptyMedia(), heading: "", description: "", linkUrl: "", linkLabel: "" },
          { id: createItemId(), icon: "", image: emptyMedia(), heading: "", description: "", linkUrl: "", linkLabel: "" },
        ],
        displayStyle: "cards",
        columns: { desktop: 3, tablet: 2, mobile: 1 },
        gap: { desktop: "1.5rem" },
        itemAlignment: "left",
        equalHeight: true,
        background: emptyBackground(),
        itemBackground: emptyBackground(),
        itemBorder: emptyBorder(),
        itemRadius: "0.75rem",
        itemShadow: "",
        spacing: { margin: "", padding: "2rem 0" },
      };
    }
    return null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function createBlockId() {
    if (global.crypto?.randomUUID) {
      return `blk_${global.crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    }
    return `blk_${Math.random().toString(16).slice(2, 14)}`;
  }

  function getAlignment(block) {
    const fromStyle = block.style?.textAlign;
    if (fromStyle === "center" || fromStyle === "right") return fromStyle;
    const fromProps = block.props?.alignment;
    if (fromProps === "center" || fromProps === "right") return fromProps;
    return "left";
  }

  function widthClass(block) {
    const width = block.style?.width ?? block.props?.width;
    if (width === "wide") return " is-wide";
    if (width === "full") return " is-full";
    return "";
  }

  function blockClass(type, block) {
    const extra = block.style?.className ? ` ${block.style.className}` : "";
    return `jess-block jess-${type} align-${getAlignment(block)}${widthClass(block)}${extra}`.trim();
  }

  function buttonVariant(block) {
    const style = block.props.style ?? block.props.variant ?? "primary";
    if (style === "secondary" || style === "outline") return style;
    return "primary";
  }

  function headingTag(block) {
    const level = Number(block.props.level ?? 2);
    if (level >= 1 && level <= 6) return `h${level}`;
    return "h2";
  }

  function listItems(block) {
    const items = block.props.items;
    if (Array.isArray(items)) return items.map((item) => String(item)).filter(Boolean);
    if (typeof items === "string") {
      return items.split("\n").map((line) => line.trim()).filter(Boolean);
    }
    return [];
  }

  function defaultBlockProps(type) {
    const marketing = marketingDefaults(type);
    if (marketing) return marketing;
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

  function createColumnChild(width) {
    return {
      id: createBlockId(),
      type: "column",
      props: { width },
      children: [createBlock("paragraph")],
      style: {},
      plugin_source: null,
    };
  }

  function createBlock(type) {
    const props = defaultBlockProps(type);
    const alignment = props.alignment;
    delete props.alignment;
    const block = {
      id: createBlockId(),
      type,
      props,
      children: [],
      style: alignment ? { textAlign: alignment } : {},
      plugin_source: type === "form" ? "forms-builder" : null,
    };
    if (type === "columns") {
      const count = Number(props.columnCount ?? 2);
      const ratios = Array.isArray(props.ratios)
        ? props.ratios
        : Array.from({ length: count }, () => `${Math.round(100 / count)}%`);
      block.children = ratios.slice(0, count).map((width) => createColumnChild(String(width)));
    }
    return block;
  }

  function normalizeBlock(raw) {
    const type = String(raw?.type ?? "paragraph");
    const defaults = defaultBlockProps(type);
    const props = { ...defaults, ...(raw?.props ?? {}) };
    const alignment = props.alignment;
    if ("alignment" in props) delete props.alignment;
    let children = Array.isArray(raw?.children)
      ? raw.children.map((child) => normalizeBlock(child))
      : [];
    if (type === "columns" && children.length === 0) {
      const count = Number(props.columnCount ?? 2);
      children = Array.from({ length: count }, () =>
        createColumnChild(`${Math.round(100 / count)}%`),
      );
    }
    return {
      id: String(raw?.id ?? createBlockId()),
      type,
      props,
      children,
      style: {
        ...(raw?.style ?? {}),
        ...(alignment ? { textAlign: alignment } : {}),
      },
      plugin_source: raw?.plugin_source ?? (type === "form" ? "forms-builder" : null),
    };
  }

  function cloneBlock(source) {
    const props = { ...source.props };
    if (source.type === "feature_grid" && Array.isArray(props.items)) {
      props.items = props.items.map((item) => ({
        ...(item && typeof item === "object" ? item : {}),
        id: createItemId(),
      }));
    }
    return normalizeBlock({
      ...source,
      id: createBlockId(),
      props,
      style: { ...(source.style ?? {}) },
      children: (source.children ?? []).map((child) => cloneBlock(child)),
    });
  }

  function renderBlocksToHtml(blocks) {
    return (blocks ?? []).map((block) => renderBlock(block)).join("\n");
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
        if (!url) return `<figure class="${classes} is-empty"><span class="muted">Select an image</span></figure>`;
        return `<figure class="${classes}"><img src="${url}" alt="${alt}" loading="lazy">${caption}</figure>`;
      }
      case "button": {
        const text = escapeHtml(block.props.text);
        const url = escapeHtml(block.props.url ?? "#");
        return `<p class="${classes} jess-button-wrap"><a class="jess-button ${buttonVariant(block)}" href="${url}">${text}</a></p>`;
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
      case "divider": {
        const thickness = escapeHtml(block.props.thickness ?? "1px");
        const color = escapeHtml(block.props.color ?? "currentColor");
        const width = escapeHtml(block.props.width ?? "100%");
        const borderStyle = escapeHtml(block.props.style ?? "solid");
        return `<hr class="${classes}" style="border:0;border-top:${thickness} ${borderStyle} ${color};width:${width};margin-inline:auto" />`;
      }
      case "html": {
        const raw = String(block.props.raw_html ?? block.props.raw ?? "");
        return `<div class="${classes}">${raw || '<span class="muted">Empty HTML</span>'}</div>`;
      }
      case "form": {
        const slug = escapeHtml(block.props.form_slug || "form");
        return `<div class="${classes} jess-form-placeholder">Form: ${slug}</div>`;
      }
      case "columns": {
        const gap = escapeHtml(block.props.gap ?? "1.5rem");
        const cols = (block.children ?? [])
          .map((child) => {
            const width = escapeHtml(child.props?.width ?? "50%");
            return `<div class="jess-column" style="flex:1 1 ${width};max-width:${width}">${renderBlocksToHtml(child.children ?? [])}</div>`;
          })
          .join("");
        return `<div class="${classes} jess-columns" style="display:flex;flex-wrap:wrap;gap:${gap}">${cols}</div>`;
      }
      case "column":
        return `<div class="${classes}">${renderBlocksToHtml(block.children ?? [])}</div>`;
      case "hero":
      case "call_to_action":
      case "card":
      case "image_box":
      case "feature_grid":
        return renderMarketingPreview(block, classes);
      default:
        return `<div class="${classes} jess-unknown-block">Unknown block: ${escapeHtml(block.type)}</div>`;
    }
  }

  function actionHtml(action) {
    if (!action || !String(action.label ?? "").trim()) return "";
    const style = action.style === "secondary" || action.style === "outline" ? action.style : "primary";
    return `<a class="jess-button ${style}" href="${escapeHtml(action.url || "#")}">${escapeHtml(action.label)}</a>`;
  }

  function mediaUrl(media) {
    return media?.imageUrl || media?.url || "";
  }

  function renderMarketingPreview(block, classes) {
    const p = block.props ?? {};
    const heading = String(p.heading ?? "");
    const eyebrow = String(p.eyebrow ?? "");
    const description = String(p.description ?? "");
    const layout = String(p.layout || p.orientation || "centered");
    const media = p.media || {};
    const url = mediaUrl(media);
    const header = `
      ${eyebrow ? `<p class="jess-eyebrow">${escapeHtml(eyebrow)}</p>` : `<p class="jess-eyebrow muted" data-ph>Eyebrow</p>`}
      <h2 class="jess-section-heading">${escapeHtml(heading) || `<span class="muted">Add heading…</span>`}</h2>
      ${description ? `<div class="jess-section-desc">${escapeHtml(description)}</div>` : `<div class="jess-section-desc muted" data-ph>Add description…</div>`}
    `;
    const actions = `<div class="jess-actions">${actionHtml(p.primaryAction)}${actionHtml(p.secondaryAction)}</div>`;
    const image = url
      ? `<div class="jess-hero-media"><img src="${escapeHtml(url)}" alt="${escapeHtml(media.alt || "")}"></div>`
      : `<div class="jess-hero-media is-empty muted">Select image</div>`;

    if (block.type === "feature_grid") {
      const items = Array.isArray(p.items) ? p.items : [];
      const cols = p.columns || {};
      const list = items
        .map(
          (item) => `<li class="jess-feature-item" data-item-id="${escapeHtml(item.id || "")}">
            <h3>${escapeHtml(item.heading || "Feature")}</h3>
            <p>${escapeHtml(item.description || "")}</p>
          </li>`,
        )
        .join("");
      return `<section class="${classes} jess-feature-grid style-${escapeHtml(p.displayStyle || "cards")}" style="--fg-cols-desktop:${Number(cols.desktop || 3)};--fg-cols-tablet:${Number(cols.tablet || 2)};--fg-cols-mobile:${Number(cols.mobile || 1)}">
        <div class="jess-feature-grid-header">${header}</div>
        <ul class="jess-feature-grid-list">${list}</ul>
      </section>`;
    }

    if (block.type === "card") {
      return `<article class="${classes} jess-card orientation-${escapeHtml(layout)}">${url ? image : ""}${header}${p.buttonLabel ? `<span class="jess-button ${escapeHtml(p.buttonStyle || "primary")} is-visual">${escapeHtml(p.buttonLabel)}</span>` : ""}</article>`;
    }

    return `<section class="${classes} jess-${escapeHtml(block.type)} layout-${escapeHtml(layout)}">
      <div class="jess-hero-inner">${header}${actions}${block.type !== "call_to_action" ? image : ""}</div>
    </section>`;
  }

  function structureLabel(block) {
    const base = BLOCK_LABELS[block.type] ?? block.type;
    const heading = String(block.props?.heading ?? "").trim();
    const truncated = heading.length > 40 ? `${heading.slice(0, 37)}…` : heading;
    if (block.type === "feature_grid") {
      const count = Array.isArray(block.props?.items) ? block.props.items.length : 0;
      return truncated ? `${base}: ${truncated}, ${count} items` : `${base}, ${count} items`;
    }
    if (["hero", "call_to_action", "card", "image_box"].includes(block.type) && truncated) {
      return `${base}: ${truncated}`;
    }
    return base;
  }

  function parseContentDocument(contentJson, contentHtml) {
    if (contentJson && String(contentJson).trim()) {
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
    if (contentHtml && String(contentHtml).trim()) {
      return {
        version: 1,
        blocks: [normalizeBlock({ type: "html", props: { raw_html: contentHtml } })],
      };
    }
    return { version: 1, blocks: [createBlock("paragraph")] };
  }

  function renderDocument(doc) {
    return renderBlocksToHtml(doc?.blocks ?? []);
  }

  function findBlock(blocks, id, parent = null) {
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (block.id === id) return { block, index, parent, list: blocks };
      if (block.children?.length) {
        const nested = findBlock(block.children, id, block);
        if (nested) return nested;
      }
    }
    return null;
  }

  function flattenStructure(blocks, depth = 0, acc = []) {
    for (const block of blocks) {
      acc.push({ id: block.id, type: block.type, label: structureLabel(block), depth });
      if (block.children?.length) flattenStructure(block.children, depth + 1, acc);
    }
    return acc;
  }

  global.JessBlockRender = {
    EDITOR_BLOCK_TYPES,
    BLOCK_LABELS,
    BLOCK_CATEGORIES,
    escapeHtml,
    createBlockId,
    createItemId,
    createBlock,
    normalizeBlock,
    cloneBlock,
    getAlignment,
    renderBlock,
    renderDocument,
    parseContentDocument,
    findBlock,
    flattenStructure,
    structureLabel,
    emptyAction,
    emptyMedia,
  };
})(window);
