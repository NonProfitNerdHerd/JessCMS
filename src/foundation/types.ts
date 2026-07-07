export type PluginLifecycleState =
  | "installed"
  | "enabled"
  | "disabled"
  | "uninstall_pending"
  | "uninstalled";

export type CleanupPolicy = "retain" | "archive" | "delete";

export type OwnershipType = "owns" | "extends" | "references";

export type ContentTypeSource = "core" | "plugin";

export interface ContentTypeDefinition {
  type_key: string;
  label: string;
  plural_label: string;
  description?: string | null;
  source?: ContentTypeSource;
  plugin_id?: string | null;
  enabled?: boolean;
  supports_json?: boolean;
  supports_html?: boolean;
  supports_revisions?: boolean;
  supports_workflow?: boolean;
  supports_seo?: boolean;
  supports_featured_image?: boolean;
  supports_author?: boolean;
  supports_parent?: boolean;
  supports_archive?: boolean;
  supports_public_routes?: boolean;
  supports_search?: boolean;
  search_weight?: number;
  search_fields_json?: Record<string, unknown> | null;
  route_base?: string | null;
  admin_base?: string | null;
  icon?: string | null;
  schema_json?: Record<string, unknown> | null;
  settings_json?: Record<string, unknown> | null;
}

export interface PluginResourceDefinition {
  resource_type: string;
  resource_name: string;
  table_name?: string | null;
  entity_id?: string | null;
  ownership_type?: OwnershipType;
  cleanup_policy?: CleanupPolicy;
}

export interface PluginLifecycleHookContext {
  pluginId: string;
  db: D1Database;
  manifest: PluginManifest;
}

export interface PluginLifecycle {
  install?(ctx: PluginLifecycleHookContext): Promise<void>;
  enable?(ctx: PluginLifecycleHookContext): Promise<void>;
  disable?(ctx: PluginLifecycleHookContext): Promise<void>;
  uninstall?(ctx: PluginLifecycleHookContext): Promise<void>;
  migrate?(ctx: PluginLifecycleHookContext & { fromVersion: string; toVersion: string }): Promise<void>;
  rollback?(ctx: PluginLifecycleHookContext & { fromVersion: string; toVersion: string }): Promise<void>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  admin_routes?: Array<{ path: string; label: string; icon: string }>;
  api_routes?: Array<{ method: string; path: string; handler: string }>;
  blocks?: Array<{ type: string; label: string; category: string; block_type?: string }>;
  content_types?: ContentTypeDefinition[];
  resources?: PluginResourceDefinition[];
  settings_schema?: Record<string, unknown>;
  permissions?: string[];
}

export type UninstallMode =
  | "disable_only"
  | "uninstall_retain"
  | "uninstall_archive"
  | "uninstall_delete";

export interface UninstallPreview {
  plugin_id: string;
  plugin_name: string;
  lifecycle_state: PluginLifecycleState;
  resources: Array<{
    id: string;
    resource_type: string;
    resource_name: string;
    table_name: string | null;
    entity_id: string | null;
    ownership_type: OwnershipType;
    cleanup_policy: CleanupPolicy;
    affected_count: number | null;
  }>;
  content_types: string[];
  warnings: string[];
  options: UninstallMode[];
}

export interface ContentTypeRecord extends ContentTypeDefinition {
  id: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContentIndexRecord {
  id: string;
  content_type: string;
  source_table: string;
  source_id: string;
  slug: string;
  title: string;
  status: string;
  author_id: string | null;
  published_at: string | null;
  updated_at: string;
  plugin_id: string | null;
  route_path: string | null;
  searchable_text: string | null;
  metadata_json: string | null;
  excerpt: string | null;
  featured_image_id: string | null;
  search_weight: number | null;
  indexed_at: string | null;
}

export interface PluginResourceRecord {
  id: string;
  plugin_id: string;
  resource_type: string;
  resource_name: string;
  table_name: string | null;
  entity_id: string | null;
  ownership_type: OwnershipType;
  cleanup_policy: CleanupPolicy;
  created_at: string;
  updated_at: string;
}

export interface DbPluginRecord {
  id: string;
  name: string;
  version: string;
  enabled: number;
  manifest_json: string;
  lifecycle_state: PluginLifecycleState;
  installed_at: string;
  enabled_at: string | null;
  disabled_at: string | null;
  uninstalled_at: string | null;
  updated_at: string;
}
