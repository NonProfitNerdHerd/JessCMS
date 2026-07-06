import { BLOCK_TYPES, CONTENT_TYPES } from "../foundation/registry";
import type { PluginManifest } from "./types";
import { CORE_PLUGIN_ID } from "./constants";

export const CORE_MANIFEST: PluginManifest = {
  id: CORE_PLUGIN_ID,
  name: "JessCMS Core",
  version: "0.9.0",
  description: "Core CMS platform: pages, posts, events, blocks, theme, and admin.",
  author: "JessCMS",
  enabled: true,
  kind: "core",
  permissions: [
    "content:read",
    "content:create",
    "content:update",
    "content:delete",
    "content:publish",
    "settings:read",
    "settings:update",
    "plugins:read",
    "plugins:update",
    "media:read",
    "media:create",
    "media:update",
    "media:delete",
    "workflow:submit",
    "workflow:approve",
    "workflow:publish",
    "revisions:read",
    "revisions:restore",
  ],
  content_types: CONTENT_TYPES.map((type) => ({
    type_key: type.id,
    label: type.label,
    plural_label: `${type.label}s`,
    source: "core" as const,
    plugin_id: CORE_PLUGIN_ID,
    enabled: true,
    supports_json: type.supports.includes("content_json"),
    supports_html: type.supports.includes("content_html"),
    supports_revisions: true,
    supports_workflow: true,
    supports_seo: type.supports.includes("seo_title"),
    supports_featured_image: type.supports.includes("featured_image_id"),
    supports_author: type.supports.includes("author_id"),
    supports_parent: type.supports.includes("parent_id"),
    supports_archive: true,
    supports_public_routes: true,
    route_base:
      type.id === "post" ? "/blog" : type.id === "event" ? "/events" : null,
    admin_base: `/admin/${type.id === "page" ? "pages" : `${type.id}s`}`,
    icon:
      type.id === "page"
        ? "📄"
        : type.id === "post"
          ? "✎"
          : type.id === "event"
            ? "📅"
            : "📄",
  })),
  blocks: BLOCK_TYPES.map((block) => ({
    type: block.type,
    label: block.label,
    category: block.category,
  })),
  settings_pages: [
    {
      slug: "theme",
      label: "Theme",
      icon: "🎨",
      permission: "settings:read",
    },
  ],
};
