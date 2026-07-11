import type { Block } from "./types";
import {
  type BlockAction,
  type MediaRef,
  emptyAction,
  emptyBackground,
  emptyBorder,
  emptyMedia,
  emptyOverlay,
  emptySpacing,
  normalizeAction,
  normalizeBackground,
  normalizeBorder,
  normalizeMedia,
  normalizeOverlay,
  normalizeSpacing,
  resolveColor,
  resolveResponsive,
  createItemId,
} from "./shared-props";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function headingTagFrom(level: unknown, fallback = 2): string {
  const n = Number(level ?? fallback);
  if (n >= 1 && n <= 6) return `h${n}`;
  return `h${fallback}`;
}

function renderAction(action: BlockAction | null, className = ""): string {
  if (!action || !action.label.trim()) return "";
  const href = action.url.trim() || "#";
  const target = action.target === "_blank" ? ` target="_blank" rel="noopener noreferrer"` : "";
  const variant = action.style === "secondary" || action.style === "outline" ? action.style : "primary";
  return `<a class="jess-button ${variant}${className ? ` ${className}` : ""}" href="${escapeHtml(href)}"${target}>${escapeHtml(action.label)}</a>`;
}

function renderActions(primary: BlockAction | null, secondary: BlockAction | null): string {
  const parts = [renderAction(primary), renderAction(secondary)].filter(Boolean);
  if (!parts.length) return "";
  return `<div class="jess-actions">${parts.join("")}</div>`;
}

function mediaUrl(media: MediaRef): string {
  return media.imageUrl || "";
}

function focalStyle(media: MediaRef): string {
  const x = media.focalPoint?.x ?? 50;
  const y = media.focalPoint?.y ?? 50;
  return `object-position:${x}% ${y}%`;
}

function backgroundCss(bg: ReturnType<typeof normalizeBackground>, overlay: ReturnType<typeof normalizeOverlay>): string {
  const parts: string[] = [];
  const color = resolveColor(bg.color);
  if (color) parts.push(`background-color:${color}`);
  const url = bg.image?.type === "image" ? mediaUrl(bg.image) : "";
  if (url) {
    parts.push(`background-image:url('${escapeHtml(url).replace(/'/g, "\\'")}')`);
    parts.push(`background-position:${escapeHtml(bg.position || "center center")}`);
    parts.push(`background-size:${escapeHtml(bg.size || "cover")}`);
    parts.push(`background-repeat:${escapeHtml(bg.repeat || "no-repeat")}`);
  }
  return parts.join(";");
}

function overlayHtml(overlay: ReturnType<typeof normalizeOverlay>): string {
  if (!overlay.enabled) return "";
  const color = resolveColor(overlay.color) || "#000";
  const opacity = overlay.opacity ?? 0.4;
  return `<div class="jess-overlay" style="background:${escapeHtml(color)};opacity:${opacity}" aria-hidden="true"></div>`;
}

function sectionStyle(block: Block, extra: string[] = []): string {
  const parts = [...extra];
  if (block.style?.backgroundColor) parts.push(`background-color:${escapeHtml(String(block.style.backgroundColor))}`);
  if (block.style?.textColor) parts.push(`color:${escapeHtml(String(block.style.textColor))}`);
  if (block.style?.margin) parts.push(`margin:${escapeHtml(String(block.style.margin))}`);
  if (block.style?.padding) parts.push(`padding:${escapeHtml(String(block.style.padding))}`);
  const spacing = normalizeSpacing(block.props.spacing);
  if (spacing.margin) parts.push(`margin:${escapeHtml(spacing.margin)}`);
  if (spacing.padding) parts.push(`padding:${escapeHtml(spacing.padding)}`);
  const border = normalizeBorder(block.props.border);
  if (border.width && border.width !== "0") {
    const bc = resolveColor(border.color) || "currentColor";
    parts.push(`border:${escapeHtml(border.width)} ${escapeHtml(border.style || "solid")} ${escapeHtml(bc)}`);
  }
  if (border.radius) parts.push(`border-radius:${escapeHtml(border.radius)}`);
  if (block.props.boxShadow) parts.push(`box-shadow:${escapeHtml(String(block.props.boxShadow))}`);
  if (block.props.minHeight) {
    const mh = resolveResponsive(block.props.minHeight as string | { desktop?: string });
    if (mh) parts.push(`min-height:${escapeHtml(String(mh))}`);
  }
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

function textBlock(eyebrow: string, heading: string, level: unknown, description: string, fallbackLevel = 2): string {
  const parts: string[] = [];
  if (eyebrow.trim()) parts.push(`<p class="jess-eyebrow">${escapeHtml(eyebrow)}</p>`);
  if (heading.trim()) {
    const tag = headingTagFrom(level, fallbackLevel);
    parts.push(`<${tag} class="jess-section-heading">${escapeHtml(heading)}</${tag}>`);
  }
  if (description.trim()) parts.push(`<div class="jess-section-desc">${escapeHtml(description)}</div>`);
  return parts.join("");
}

export function defaultMarketingProps(type: string): Record<string, unknown> | null {
  switch (type) {
    case "hero":
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
    case "call_to_action":
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
    case "card":
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
    case "image_box":
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
    case "feature_grid":
      return {
        version: 1,
        eyebrow: "",
        heading: "",
        headingLevel: 2,
        description: "",
        items: [
          {
            id: createItemId(),
            icon: "",
            image: emptyMedia(),
            heading: "",
            description: "",
            linkUrl: "",
            linkLabel: "",
          },
          {
            id: createItemId(),
            icon: "",
            image: emptyMedia(),
            heading: "",
            description: "",
            linkUrl: "",
            linkLabel: "",
          },
          {
            id: createItemId(),
            icon: "",
            image: emptyMedia(),
            heading: "",
            description: "",
            linkUrl: "",
            linkLabel: "",
          },
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
    default:
      return null;
  }
}

function normalizeFeatureItems(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      id: String(row.id ?? createItemId()),
      icon: String(row.icon ?? ""),
      image: normalizeMedia(row.image),
      heading: String(row.heading ?? ""),
      description: String(row.description ?? ""),
      linkUrl: String(row.linkUrl ?? row.link ?? ""),
      linkLabel: String(row.linkLabel ?? ""),
    };
  });
}

export function normalizeMarketingProps(type: string, props: Record<string, unknown>): Record<string, unknown> {
  const defaults = defaultMarketingProps(type);
  if (!defaults) return props;
  const merged = { ...defaults, ...props };

  if ("primaryAction" in defaults) merged.primaryAction = normalizeAction(merged.primaryAction) ?? emptyAction();
  if ("secondaryAction" in defaults) merged.secondaryAction = normalizeAction(merged.secondaryAction) ?? emptyAction();
  if ("media" in defaults) merged.media = normalizeMedia(merged.media);
  if ("background" in defaults) merged.background = normalizeBackground(merged.background);
  if ("overlay" in defaults) merged.overlay = normalizeOverlay(merged.overlay);
  if ("border" in defaults) merged.border = normalizeBorder(merged.border);
  if ("spacing" in defaults) merged.spacing = normalizeSpacing(merged.spacing);
  if ("itemBackground" in defaults) merged.itemBackground = normalizeBackground(merged.itemBackground);
  if ("itemBorder" in defaults) merged.itemBorder = normalizeBorder(merged.itemBorder);
  if (type === "feature_grid") merged.items = normalizeFeatureItems(merged.items);

  return merged;
}

export function remintFeatureItemIds(props: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(props.items)) return props;
  return {
    ...props,
    items: props.items.map((item) => {
      const row = item && typeof item === "object" ? { ...(item as Record<string, unknown>) } : {};
      row.id = createItemId();
      return row;
    }),
  };
}

export function renderMarketingBlock(block: Block, classes: string, idAttr: string): string | null {
  const type = block.type;
  if (!["hero", "call_to_action", "card", "image_box", "feature_grid"].includes(type)) {
    return null;
  }

  const props = normalizeMarketingProps(type, { ...block.props });
  const primary = normalizeAction(props.primaryAction);
  const secondary = normalizeAction(props.secondaryAction);
  const media = normalizeMedia(props.media);
  const background = normalizeBackground(props.background);
  const overlay = normalizeOverlay(props.overlay);
  const contentAlign = String(props.contentAlignment ?? props.textAlignment ?? "left");
  const layout = String(props.layout ?? "centered");

  if (type === "hero") {
    const minH = resolveResponsive(props.minHeight as { desktop?: string }) || "28rem";
    const bgCss = backgroundCss(background, overlay);
    const hasMedia = media.type === "image" && mediaUrl(media);
    const isOverlay = layout === "overlay" || (hasMedia && layout === "centered" && background.image?.type === "image");
    const split = layout === "split-left" || layout === "split-right";
    const content = `
      <div class="jess-hero-content align-${escapeHtml(contentAlign)}">
        ${textBlock(String(props.eyebrow ?? ""), String(props.heading ?? ""), props.headingLevel, String(props.description ?? ""), 1)}
        ${renderActions(primary, secondary)}
      </div>`;
    const image = hasMedia
      ? `<div class="jess-hero-media"><img src="${escapeHtml(mediaUrl(media))}" alt="${escapeHtml(media.alt || "")}" loading="lazy" style="${focalStyle(media)}"></div>`
      : "";
    const order =
      layout === "split-right"
        ? `${image}${content}`
        : `${content}${image}`;
    return `<section class="${classes} jess-hero layout-${escapeHtml(layout)} v-align-${escapeHtml(String(props.verticalAlignment ?? "center"))}"${idAttr}${sectionStyle(block, [`min-height:${escapeHtml(String(minH))}`, bgCss].filter(Boolean))}>
      ${overlayHtml(overlay)}
      <div class="jess-hero-inner${split ? " is-split" : ""}${isOverlay ? " is-overlay" : ""}" style="max-width:${escapeHtml(String(props.contentWidth || "42rem"))}">
        ${split ? order : `${content}${!isOverlay ? image : ""}`}
      </div>
    </section>`;
  }

  if (type === "call_to_action") {
    const bgCss = backgroundCss(background, overlay);
    const hasMedia = media.type === "image" && mediaUrl(media);
    return `<section class="${classes} jess-cta layout-${escapeHtml(layout)} align-${escapeHtml(contentAlign)}${props.stackOnMobile ? " stack-mobile" : ""}"${idAttr}${sectionStyle(block, [bgCss].filter(Boolean))}>
      ${overlayHtml(overlay)}
      <div class="jess-cta-inner">
        <div class="jess-cta-copy">${textBlock(String(props.eyebrow ?? ""), String(props.heading ?? ""), props.headingLevel, String(props.description ?? ""))}</div>
        ${hasMedia && (layout === "split" || layout === "banner") ? `<div class="jess-cta-media"><img src="${escapeHtml(mediaUrl(media))}" alt="${escapeHtml(media.alt || "")}" loading="lazy" style="${focalStyle(media)}"></div>` : ""}
        <div class="jess-cta-actions">${renderActions(primary, secondary)}</div>
      </div>
    </section>`;
  }

  if (type === "card") {
    const orientation = String(props.orientation ?? "vertical");
    const linkMode = String(props.linkMode ?? "button");
    const linkUrl = String(props.linkUrl ?? "").trim();
    const hasMedia = media.type === "image" && mediaUrl(media);
    const buttonLabel = String(props.buttonLabel ?? "").trim();
    const buttonStyle = props.buttonStyle === "secondary" || props.buttonStyle === "outline" ? props.buttonStyle : "primary";
    const imageHtml = hasMedia
      ? `<div class="jess-card-media ratio-${escapeHtml(String(props.aspectRatio ?? "16/9").replace("/", "-"))}"><img src="${escapeHtml(mediaUrl(media))}" alt="${escapeHtml(media.alt || "")}" loading="lazy" style="${focalStyle(media)}"></div>`
      : "";
    const body = `
      <div class="jess-card-body align-${escapeHtml(String(props.textAlignment ?? "left"))}">
        ${textBlock(String(props.eyebrow ?? ""), String(props.heading ?? ""), props.headingLevel, String(props.description ?? ""), 3)}
        ${
          buttonLabel
            ? linkMode === "card" && linkUrl
              ? `<span class="jess-button ${buttonStyle} is-visual">${escapeHtml(buttonLabel)}</span>`
              : linkUrl
                ? `<a class="jess-button ${buttonStyle}" href="${escapeHtml(linkUrl)}"${props.linkTarget === "_blank" ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(buttonLabel)}</a>`
                : `<span class="jess-button ${buttonStyle} is-visual">${escapeHtml(buttonLabel)}</span>`
            : ""
        }
      </div>`;
    const inner =
      orientation === "horizontal-right"
        ? `${body}${imageHtml}`
        : orientation === "text-only"
          ? body
          : `${imageHtml}${body}`;

    if (linkMode === "card" && linkUrl) {
      return `<a class="${classes} jess-card orientation-${escapeHtml(orientation)} is-linked hover-${escapeHtml(String(props.hoverStyle ?? "lift"))}" href="${escapeHtml(linkUrl)}"${idAttr}${sectionStyle(block)}>${inner}</a>`;
    }
    return `<article class="${classes} jess-card orientation-${escapeHtml(orientation)} hover-${escapeHtml(String(props.hoverStyle ?? "lift"))}"${idAttr}${sectionStyle(block)}>${inner}</article>`;
  }

  if (type === "image_box") {
    const hasMedia = media.type === "image" && mediaUrl(media);
    const width = Math.min(80, Math.max(20, Number(props.imageWidth ?? 50)));
    const imageHtml = hasMedia
      ? `<div class="jess-image-box-media" style="flex-basis:${width}%"><img src="${escapeHtml(mediaUrl(media))}" alt="${escapeHtml(media.alt || "")}" loading="lazy" style="${focalStyle(media)}"></div>`
      : "";
    const content = `<div class="jess-image-box-content">
      ${textBlock(String(props.eyebrow ?? ""), String(props.heading ?? ""), props.headingLevel, String(props.description ?? ""))}
      ${renderActions(primary, secondary)}
    </div>`;
    const order =
      layout === "image-right" || layout === "content-above"
        ? `${content}${imageHtml}`
        : `${imageHtml}${content}`;
    const bgCss = layout === "overlay" ? backgroundCss({ ...background, image: media }, overlay) : backgroundCss(background, overlay);
    return `<section class="${classes} jess-image-box layout-${escapeHtml(layout)} v-align-${escapeHtml(String(props.verticalAlignment ?? "center"))}${props.stackOnMobile ? " stack-mobile" : ""}${props.reverseOnMobile ? " reverse-mobile" : ""}"${idAttr}${sectionStyle(block, [bgCss].filter(Boolean))}>
      ${layout === "overlay" ? overlayHtml(overlay) : ""}
      <div class="jess-image-box-inner">${layout === "overlay" ? content : order}</div>
    </section>`;
  }

  if (type === "feature_grid") {
    const items = normalizeFeatureItems(props.items);
    const cols = (props.columns as { desktop?: number; tablet?: number; mobile?: number }) ?? {};
    const desktop = Math.min(6, Math.max(1, Number(cols.desktop ?? 3)));
    const tablet = Math.min(6, Math.max(1, Number(cols.tablet ?? 2)));
    const mobile = Math.min(6, Math.max(1, Number(cols.mobile ?? 1)));
    const gap = resolveResponsive(props.gap as { desktop?: string }) || "1.5rem";
    const displayStyle = String(props.displayStyle ?? "cards");
    const itemHtml = items
      .map((item) => {
        const img = normalizeMedia(item.image);
        const hasImg = img.type === "image" && mediaUrl(img);
        const linkUrl = String(item.linkUrl ?? "").trim();
        const linkLabel = String(item.linkLabel ?? "").trim();
        const body = `
          ${item.icon ? `<div class="jess-feature-icon" aria-hidden="true">${escapeHtml(String(item.icon))}</div>` : ""}
          ${hasImg && (displayStyle === "images" || displayStyle === "cards") ? `<div class="jess-feature-media"><img src="${escapeHtml(mediaUrl(img))}" alt="${escapeHtml(img.alt || "")}" loading="lazy"></div>` : ""}
          ${item.heading ? `<h3 class="jess-feature-heading">${escapeHtml(String(item.heading))}</h3>` : ""}
          ${item.description ? `<p class="jess-feature-desc">${escapeHtml(String(item.description))}</p>` : ""}
          ${linkUrl && linkLabel ? `<a class="jess-feature-link" href="${escapeHtml(linkUrl)}">${escapeHtml(linkLabel)}</a>` : ""}
        `;
        return `<li class="jess-feature-item align-${escapeHtml(String(props.itemAlignment ?? "left"))}" data-item-id="${escapeHtml(String(item.id))}">${body}</li>`;
      })
      .join("");

    return `<section class="${classes} jess-feature-grid style-${escapeHtml(displayStyle)}${props.equalHeight ? " equal-height" : ""}"${idAttr}${sectionStyle(block, [
      `--fg-cols-desktop:${desktop}`,
      `--fg-cols-tablet:${tablet}`,
      `--fg-cols-mobile:${mobile}`,
      `--fg-gap:${String(gap)}`,
    ])}>
      <div class="jess-feature-grid-header align-${escapeHtml(contentAlign)}">
        ${textBlock(String(props.eyebrow ?? ""), String(props.heading ?? ""), props.headingLevel, String(props.description ?? ""))}
      </div>
      <ul class="jess-feature-grid-list">${itemHtml}</ul>
    </section>`;
  }

  return null;
}
