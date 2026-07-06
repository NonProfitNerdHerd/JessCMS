import type {
  CleanupPolicy,
  ContentTypeDefinition,
  PluginManifest as BasePluginManifest,
  PluginResourceDefinition,
} from "../foundation/types";

export type PluginKind = "core" | "required" | "plugin" | "optional";

export interface VersionConstraint {
  plugin_id: string;
  version?: string;
}

export interface PluginRouteDefinition {
  method?: string;
  path: string;
  handler?: string;
  type?: "public" | "admin" | "api";
  permission?: string | null;
}

export interface PluginAdminPageDefinition {
  path: string;
  label: string;
  icon?: string;
  permission?: string | null;
  sort_order?: number;
}

export interface PluginSettingsPageDefinition {
  slug: string;
  label: string;
  icon?: string;
  permission?: string | null;
  schema?: Record<string, unknown>;
}

export interface PluginNavigationSection {
  id: string;
  label: string;
  icon?: string;
  sort_order?: number;
  permission?: string | null;
}

export interface PluginNavigationItem {
  section_id?: string;
  label: string;
  href: string;
  icon?: string;
  permission?: string | null;
  sort_order?: number;
}

export interface PluginNavigationDefinition {
  sections?: PluginNavigationSection[];
  items?: PluginNavigationItem[];
}

export interface PluginScheduledJobDefinition {
  id: string;
  schedule: string;
  handler: string;
  description?: string;
}

export interface PluginWidgetDefinition {
  id: string;
  label: string;
  description?: string;
  permission?: string | null;
}

export interface PluginDatabaseDefinition {
  tables?: string[];
  migrations_dir?: string;
}

export interface PluginAssetsDefinition {
  public?: string[];
  admin?: string[];
}

export interface PluginManifest extends BasePluginManifest {
  author?: string;
  homepage?: string;
  minimum_jesscms_version?: string;
  kind?: PluginKind;
  dependencies?: VersionConstraint[];
  optional_dependencies?: VersionConstraint[];
  routes?: PluginRouteDefinition[];
  admin_pages?: PluginAdminPageDefinition[];
  settings_pages?: PluginSettingsPageDefinition[];
  scheduled_jobs?: PluginScheduledJobDefinition[];
  widgets?: PluginWidgetDefinition[];
  navigation?: PluginNavigationDefinition;
  cleanup_policy?: CleanupPolicy;
  database?: PluginDatabaseDefinition;
  assets?: PluginAssetsDefinition;
}

export interface RegisteredPlugin {
  manifest: PluginManifest;
  enabled: boolean;
  lifecycle_state: string;
  kind: PluginKind;
  missing_dependencies: string[];
  optional_missing: string[];
  needs_migration: boolean;
  upgrade_available: boolean;
  resource_count: number;
}

export interface RuntimeSnapshot {
  version: string;
  loaded_at: string;
  plugins: RegisteredPlugin[];
  content_types: Array<ContentTypeDefinition & { plugin_id: string; key: string }>;
  blocks: RuntimeBlockDefinition[];
  routes: RuntimeRouteDefinition[];
  permissions: RuntimePermissionDefinition[];
  navigation: RuntimeNavigationItem[];
  settings_pages: RuntimeSettingsPageDefinition[];
  schedulers: PluginScheduledJobDefinition[];
  notifications: unknown[];
  widgets: PluginWidgetDefinition[];
  errors: string[];
}

export interface RuntimeBlockDefinition {
  type: string;
  label: string;
  category: string;
  source: string;
  plugin_id: string;
  enabled: boolean;
  block_type?: string;
  props_schema?: Record<string, unknown>;
}

export interface RuntimeRouteDefinition {
  key: string;
  method: string;
  path: string;
  type: "public" | "admin" | "api";
  plugin_id: string;
  handler?: string;
  permission?: string | null;
}

export interface RuntimePermissionDefinition {
  slug: string;
  name: string;
  description?: string;
  plugin_id: string;
}

export interface RuntimeNavigationItem {
  key: string;
  label: string;
  href: string;
  icon: string;
  plugin_id: string;
  section_id?: string;
  permission?: string | null;
  sort_order: number;
}

export interface RuntimeSettingsPageDefinition {
  key: string;
  slug: string;
  label: string;
  icon?: string;
  plugin_id: string;
  permission?: string | null;
  schema?: Record<string, unknown>;
}

export type RuntimeHookName =
  | "beforeCreate"
  | "afterCreate"
  | "beforeUpdate"
  | "afterUpdate"
  | "beforeDelete"
  | "afterDelete"
  | "beforeRender"
  | "afterRender";

export type RuntimeEventName =
  | "PluginEnabled"
  | "PluginDisabled"
  | "PluginInstalled"
  | "PluginUninstalled"
  | "ContentCreated"
  | "ContentUpdated"
  | "ContentDeleted"
  | "MediaUploaded"
  | "FormSubmitted"
  | "WorkflowChanged"
  | "RevisionRestored";

export interface RuntimeHookHandler {
  pluginId: string;
  hook: RuntimeHookName;
  handlerId: string;
}

export interface RuntimeEventPayload {
  [key: string]: unknown;
}
