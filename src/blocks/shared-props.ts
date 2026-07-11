/**
 * Shared prop shapes and helpers for layout/marketing blocks.
 * Nested objects live under `props` (not WordPress `attributes`).
 */

export type ColorValue =
  | { type: "token"; value: string }
  | { type: "custom"; value: string }
  | string
  | null
  | undefined;

export type ResponsiveValue<T = string> = {
  desktop?: T;
  tablet?: T;
  mobile?: T;
};

export interface BlockAction {
  label: string;
  url: string;
  contentId?: string;
  target?: "_self" | "_blank";
  style?: "primary" | "secondary" | "outline";
}

export interface MediaRef {
  type?: "none" | "image";
  imageId?: string;
  imageUrl?: string;
  alt?: string;
  focalPoint?: { x: number; y: number };
}

export interface BackgroundSettings {
  color?: ColorValue;
  image?: MediaRef | null;
  position?: string;
  size?: string;
  repeat?: string;
}

export interface OverlaySettings {
  enabled?: boolean;
  color?: ColorValue;
  opacity?: number;
}

export interface BorderSettings {
  color?: ColorValue;
  width?: string;
  radius?: string;
  style?: string;
}

export interface SpacingSettings {
  margin?: string;
  padding?: string;
}

export function createItemId(): string {
  return `item_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export function emptyAction(): BlockAction {
  return { label: "", url: "", target: "_self", style: "primary" };
}

export function emptyMedia(): MediaRef {
  return { type: "none", imageId: "", imageUrl: "", alt: "", focalPoint: { x: 50, y: 50 } };
}

export function emptyBackground(): BackgroundSettings {
  return {
    color: null,
    image: emptyMedia(),
    position: "center center",
    size: "cover",
    repeat: "no-repeat",
  };
}

export function emptyOverlay(): OverlaySettings {
  return { enabled: false, color: { type: "custom", value: "#000000" }, opacity: 0.4 };
}

export function emptyBorder(): BorderSettings {
  return { color: null, width: "0", radius: "", style: "solid" };
}

export function emptySpacing(): SpacingSettings {
  return { margin: "", padding: "" };
}

export function resolveColor(value: ColorValue): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.type === "token") {
    const map: Record<string, string> = {
      "color.primary": "var(--jess-primary, #2563eb)",
      "color.secondary": "var(--jess-secondary, #64748b)",
      "color.background": "var(--jess-bg, #ffffff)",
      "color.text": "var(--jess-text, #1e293b)",
    };
    return map[value.value] ?? value.value;
  }
  return value.value ?? "";
}

export function resolveResponsive<T>(
  value: ResponsiveValue<T> | T | undefined,
  device: "desktop" | "tablet" | "mobile" = "desktop",
): T | undefined {
  if (value == null) return undefined;
  if (typeof value !== "object" || Array.isArray(value) || !("desktop" in (value as object) || "tablet" in (value as object) || "mobile" in (value as object))) {
    return value as T;
  }
  const v = value as ResponsiveValue<T>;
  if (device === "mobile") return v.mobile ?? v.tablet ?? v.desktop;
  if (device === "tablet") return v.tablet ?? v.desktop;
  return v.desktop;
}

export function normalizeAction(raw: unknown): BlockAction | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const label = String(a.label ?? "").trim();
  const url = String(a.url ?? "").trim();
  if (!label && !url) return null;
  return {
    label,
    url,
    contentId: a.contentId ? String(a.contentId) : undefined,
    target: a.target === "_blank" ? "_blank" : "_self",
    style:
      a.style === "secondary" || a.style === "outline" ? a.style : "primary",
  };
}

export function normalizeMedia(raw: unknown): MediaRef {
  if (!raw || typeof raw !== "object") return emptyMedia();
  const m = raw as Record<string, unknown>;
  const fp = m.focalPoint && typeof m.focalPoint === "object" ? (m.focalPoint as Record<string, unknown>) : {};
  return {
    type: m.type === "image" || m.imageUrl || m.imageId ? "image" : "none",
    imageId: String(m.imageId ?? m.media_id ?? ""),
    imageUrl: String(m.imageUrl ?? m.url ?? ""),
    alt: String(m.alt ?? ""),
    focalPoint: {
      x: Number(fp.x ?? 50),
      y: Number(fp.y ?? 50),
    },
  };
}

export function normalizeBackground(raw: unknown): BackgroundSettings {
  if (!raw || typeof raw !== "object") return emptyBackground();
  const b = raw as Record<string, unknown>;
  return {
    color: (b.color as ColorValue) ?? null,
    image: b.image ? normalizeMedia(b.image) : emptyMedia(),
    position: String(b.position ?? "center center"),
    size: String(b.size ?? "cover"),
    repeat: String(b.repeat ?? "no-repeat"),
  };
}

export function normalizeOverlay(raw: unknown): OverlaySettings {
  if (!raw || typeof raw !== "object") return emptyOverlay();
  const o = raw as Record<string, unknown>;
  const opacity = Number(o.opacity ?? 0.4);
  return {
    enabled: Boolean(o.enabled),
    color: (o.color as ColorValue) ?? { type: "custom", value: "#000000" },
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 0.4,
  };
}

export function normalizeBorder(raw: unknown): BorderSettings {
  if (!raw || typeof raw !== "object") return emptyBorder();
  const b = raw as Record<string, unknown>;
  return {
    color: (b.color as ColorValue) ?? null,
    width: String(b.width ?? "0"),
    radius: String(b.radius ?? ""),
    style: String(b.style ?? "solid"),
  };
}

export function normalizeSpacing(raw: unknown): SpacingSettings {
  if (!raw || typeof raw !== "object") return emptySpacing();
  const s = raw as Record<string, unknown>;
  return {
    margin: String(s.margin ?? ""),
    padding: String(s.padding ?? ""),
  };
}

export function isValidUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:")) {
    return true;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function actionIsComplete(action: BlockAction | null | undefined): boolean {
  if (!action) return false;
  return Boolean(action.label.trim() && action.url.trim() && isValidUrl(action.url));
}

export function actionIsPartial(action: BlockAction | null | undefined): boolean {
  if (!action) return false;
  const hasLabel = Boolean(action.label.trim());
  const hasUrl = Boolean(action.url.trim());
  return (hasLabel && !hasUrl) || (!hasLabel && hasUrl) || (hasLabel && hasUrl && !isValidUrl(action.url));
}
