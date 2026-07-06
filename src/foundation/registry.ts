import coreEvents from "../../plugins/core-events/manifest.json";
import coreMedia from "../../plugins/core-media/manifest.json";
import coreSeo from "../../plugins/core-seo/manifest.json";
import stormChaserExample from "../../plugins/storm-chaser-example/manifest.json";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  admin_routes?: Array<{ path: string; label: string; icon: string }>;
  api_routes?: Array<{ method: string; path: string; handler: string }>;
  blocks?: Array<{ type: string; label: string; category: string; block_type?: string }>;
  settings_schema?: Record<string, unknown>;
  permissions?: string[];
}

export const PLUGIN_MANIFESTS: PluginManifest[] = [
  coreEvents as PluginManifest,
  coreMedia as PluginManifest,
  coreSeo as PluginManifest,
  stormChaserExample as PluginManifest,
];

export const CONTENT_TYPES = [
  {
    id: "page",
    label: "Page",
    table: "pages",
    hierarchical: true,
    supports: [
      "title",
      "slug",
      "status",
      "excerpt",
      "content_json",
      "content_html",
      "author_id",
      "featured_image_id",
      "parent_id",
      "template",
      "seo_title",
      "seo_description",
      "published_at",
    ],
    statuses: ["draft", "scheduled", "published", "archived"],
  },
  {
    id: "post",
    label: "Post",
    table: "posts",
    hierarchical: false,
    supports: [
      "title",
      "slug",
      "status",
      "excerpt",
      "content_json",
      "content_html",
      "author_id",
      "featured_image_id",
      "parent_id",
      "template",
      "seo_title",
      "seo_description",
      "published_at",
      "category_id",
    ],
    statuses: ["draft", "scheduled", "published", "archived"],
  },
  {
    id: "event",
    label: "Event",
    table: "events",
    hierarchical: false,
    supports: [
      "title",
      "slug",
      "status",
      "excerpt",
      "content_json",
      "content_html",
      "author_id",
      "featured_image_id",
      "parent_id",
      "template",
      "seo_title",
      "seo_description",
      "published_at",
      "start_datetime",
      "end_datetime",
      "location_name",
      "location_address",
      "latitude",
      "longitude",
      "timezone",
      "event_status",
    ],
    statuses: ["draft", "scheduled", "published", "archived"],
    event_statuses: ["scheduled", "cancelled", "postponed", "completed"],
  },
] as const;

export const BLOCK_TYPES = [
  {
    type: "paragraph",
    label: "Paragraph",
    category: "text",
    source: "core",
    props_schema: { text: { type: "string" } },
  },
  {
    type: "heading",
    label: "Heading",
    category: "text",
    source: "core",
    props_schema: { level: { type: "number", default: 2 }, text: { type: "string" } },
  },
  {
    type: "image",
    label: "Image",
    category: "media",
    source: "core-media",
    props_schema: {
      media_id: { type: "string" },
      url: { type: "string" },
      alt: { type: "string" },
      caption: { type: "string" },
    },
  },
  {
    type: "button",
    label: "Button",
    category: "design",
    source: "core",
    props_schema: {
      text: { type: "string" },
      url: { type: "string" },
      variant: { type: "string", default: "primary" },
    },
  },
  {
    type: "columns",
    label: "Columns",
    category: "layout",
    source: "core",
    props_schema: { columnCount: { type: "number", default: 2 } },
    allows_children: true,
  },
  {
    type: "spacer",
    label: "Spacer",
    category: "layout",
    source: "core",
    props_schema: { height: { type: "string", default: "2rem" } },
  },
  {
    type: "quote",
    label: "Quote",
    category: "text",
    source: "core",
    props_schema: { text: { type: "string" }, citation: { type: "string" } },
  },
  {
    type: "embed",
    label: "Embed",
    category: "media",
    source: "core",
    props_schema: {
      provider: { type: "string" },
      url: { type: "string" },
      aspectRatio: { type: "string", default: "16/9" },
    },
  },
  {
    type: "list",
    label: "List",
    category: "text",
    source: "core",
    props_schema: {
      ordered: { type: "boolean", default: false },
      items: { type: "array" },
    },
  },
  {
    type: "html",
    label: "Custom HTML",
    category: "advanced",
    source: "core",
    props_schema: { raw: { type: "string" } },
  },
  {
    type: "event_list",
    label: "Event List",
    category: "content",
    source: "core-events",
    props_schema: {
      limit: { type: "number", default: 5 },
      filter: { type: "string", default: "upcoming" },
      showLocation: { type: "boolean", default: true },
    },
  },
  {
    type: "post_list",
    label: "Post List",
    category: "content",
    source: "core",
    props_schema: {
      limit: { type: "number", default: 10 },
      category_slug: { type: "string", nullable: true },
      layout: { type: "string", default: "card" },
    },
  },
  {
    type: "alert_banner",
    label: "Alert Banner",
    category: "storm",
    source: "storm-chaser-example",
    props_schema: {
      severity: { type: "string", default: "warning" },
      title: { type: "string" },
      message: { type: "string" },
      dismissible: { type: "boolean", default: true },
    },
  },
  {
    type: "plugin_block",
    label: "Plugin Block",
    category: "plugins",
    source: "core",
    props_schema: {
      block_type: { type: "string" },
      settings: { type: "object" },
    },
    requires_plugin_source: true,
  },
] as const;

export const DEFAULT_THEME_SETTINGS = {
  site_name: "JessCMS Site",
  logo_url: null,
  favicon_url: null,
  primary_color: "#2563eb",
  secondary_color: "#64748b",
  background_color: "#ffffff",
  text_color: "#1e293b",
  heading_font: "system-ui, sans-serif",
  body_font: "system-ui, sans-serif",
  button_style: { variant: "solid", radius: "0.375rem", size: "md" },
  layout_width: "1200px",
  custom_css: "",
} as const;

export function getEnabledPlugins(): PluginManifest[] {
  return PLUGIN_MANIFESTS.filter((plugin) => plugin.enabled);
}

export function getRegisteredBlocks() {
  const pluginBlocks = PLUGIN_MANIFESTS.flatMap((plugin) =>
    (plugin.blocks ?? []).map((block) => ({
      ...block,
      source: plugin.id,
      enabled: plugin.enabled,
    })),
  );

  return {
    core: BLOCK_TYPES,
    from_plugins: pluginBlocks,
    all: [
      ...BLOCK_TYPES,
      ...pluginBlocks.filter(
        (block) =>
          !BLOCK_TYPES.some((coreBlock) => coreBlock.type === block.type),
      ),
    ],
  };
}
