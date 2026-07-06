-- Phase 8: Extensibility refactor (non-destructive)
-- Adds content type registry, unified index, plugin resource ownership, lifecycle states.

CREATE TABLE content_types (
  id TEXT PRIMARY KEY,
  type_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  plural_label TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'core',
  plugin_id TEXT REFERENCES plugins(id),
  enabled INTEGER NOT NULL DEFAULT 1,
  supports_json INTEGER NOT NULL DEFAULT 1,
  supports_html INTEGER NOT NULL DEFAULT 1,
  supports_revisions INTEGER NOT NULL DEFAULT 1,
  supports_workflow INTEGER NOT NULL DEFAULT 1,
  supports_seo INTEGER NOT NULL DEFAULT 1,
  supports_featured_image INTEGER NOT NULL DEFAULT 0,
  supports_author INTEGER NOT NULL DEFAULT 1,
  supports_parent INTEGER NOT NULL DEFAULT 0,
  supports_archive INTEGER NOT NULL DEFAULT 1,
  supports_public_routes INTEGER NOT NULL DEFAULT 1,
  route_base TEXT,
  admin_base TEXT,
  icon TEXT,
  schema_json TEXT,
  settings_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_content_types_enabled ON content_types(enabled);
CREATE INDEX idx_content_types_source ON content_types(source);
CREATE INDEX idx_content_types_plugin_id ON content_types(plugin_id);

CREATE TABLE content_index (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  author_id TEXT REFERENCES users(id),
  published_at TEXT,
  updated_at TEXT NOT NULL,
  plugin_id TEXT REFERENCES plugins(id),
  route_path TEXT,
  searchable_text TEXT,
  metadata_json TEXT,
  UNIQUE(content_type, source_id),
  UNIQUE(route_path)
);

CREATE INDEX idx_content_index_content_type ON content_index(content_type);
CREATE INDEX idx_content_index_slug ON content_index(slug);
CREATE INDEX idx_content_index_status ON content_index(status);
CREATE INDEX idx_content_index_route_path ON content_index(route_path);
CREATE INDEX idx_content_index_search ON content_index(searchable_text);

CREATE TABLE plugin_resources (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins(id),
  resource_type TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  table_name TEXT,
  entity_id TEXT,
  ownership_type TEXT NOT NULL DEFAULT 'owns',
  cleanup_policy TEXT NOT NULL DEFAULT 'retain',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_plugin_resources_plugin_id ON plugin_resources(plugin_id);
CREATE INDEX idx_plugin_resources_table ON plugin_resources(table_name, entity_id);
CREATE UNIQUE INDEX idx_plugin_resources_unique_entity ON plugin_resources(
  plugin_id, resource_type, resource_name, COALESCE(entity_id, '')
);

ALTER TABLE plugins ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'enabled';
ALTER TABLE plugins ADD COLUMN enabled_at TEXT;
ALTER TABLE plugins ADD COLUMN disabled_at TEXT;
ALTER TABLE plugins ADD COLUMN uninstalled_at TEXT;

UPDATE plugins
SET lifecycle_state = CASE WHEN enabled = 1 THEN 'enabled' ELSE 'disabled' END,
    enabled_at = CASE WHEN enabled = 1 THEN installed_at ELSE NULL END,
    disabled_at = CASE WHEN enabled = 0 THEN updated_at ELSE NULL END;

-- Ensure plugin rows exist for FK references (app sync fills manifest_json later)
INSERT OR IGNORE INTO plugins (id, name, version, enabled, manifest_json, lifecycle_state, installed_at, updated_at)
VALUES
  ('forms-builder', 'Forms Builder', '0.1.0', 1, '{}', 'enabled', datetime('now'), datetime('now')),
  ('core-events', 'Core Events', '0.1.0', 1, '{}', 'enabled', datetime('now'), datetime('now')),
  ('core-media', 'Core Media', '0.1.0', 1, '{}', 'enabled', datetime('now'), datetime('now')),
  ('core-seo', 'Core SEO', '0.1.0', 1, '{}', 'enabled', datetime('now'), datetime('now')),
  ('storm-chaser-example', 'Storm Chaser Example', '0.1.0', 0, '{}', 'disabled', datetime('now'), datetime('now'));

-- Core and plugin content types
INSERT INTO content_types (
  id, type_key, label, plural_label, description, source, plugin_id, enabled,
  supports_json, supports_html, supports_revisions, supports_workflow,
  supports_seo, supports_featured_image, supports_author, supports_parent,
  supports_archive, supports_public_routes, route_base, admin_base, icon
) VALUES
  (
    'ct_page', 'page', 'Page', 'Pages',
    'Static pages with hierarchical URLs',
    'core', NULL, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    NULL, '/admin/pages', '📄'
  ),
  (
    'ct_post', 'post', 'Post', 'Posts',
    'Blog posts under /blog',
    'core', NULL, 1,
    1, 1, 1, 1, 1, 1, 1, 0, 1, 1,
    '/blog', '/admin/posts', '✎'
  ),
  (
    'ct_event', 'event', 'Event', 'Events',
    'Events under /events',
    'core', NULL, 1,
    1, 1, 1, 1, 1, 1, 1, 0, 1, 1,
    '/events', '/admin/events', '📅'
  ),
  (
    'ct_form', 'form', 'Form', 'Forms',
    'Forms builder entries (admin-managed, embeddable)',
    'plugin', 'forms-builder', 1,
    0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
    NULL, '/admin/forms', '📋'
  );

-- Plugin table-level resource ownership
INSERT OR IGNORE INTO plugin_resources (
  id, plugin_id, resource_type, resource_name, table_name,
  ownership_type, cleanup_policy
) VALUES
  ('pr_forms_builder_forms', 'forms-builder', 'table', 'forms', 'forms', 'owns', 'retain'),
  ('pr_forms_builder_fields', 'forms-builder', 'table', 'form_fields', 'form_fields', 'owns', 'delete'),
  ('pr_forms_builder_submissions', 'forms-builder', 'table', 'form_submissions', 'form_submissions', 'owns', 'archive'),
  ('pr_core_events', 'core-events', 'content_type', 'event', 'events', 'extends', 'retain'),
  ('pr_core_media', 'core-media', 'table', 'media_items', 'media_items', 'extends', 'retain');

-- Backfill content_index from existing content
INSERT OR IGNORE INTO content_index (
  id, content_type, source_table, source_id, slug, title, status,
  author_id, published_at, updated_at, plugin_id, route_path, searchable_text
)
SELECT
  'cidx_page_' || id,
  'page',
  'pages',
  id,
  slug,
  title,
  status,
  author_id,
  published_at,
  updated_at,
  NULL,
  CASE WHEN slug = 'home' THEN '/' ELSE '/' || slug END,
  trim(coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content_html, ''))
FROM pages;

INSERT OR IGNORE INTO content_index (
  id, content_type, source_table, source_id, slug, title, status,
  author_id, published_at, updated_at, plugin_id, route_path, searchable_text
)
SELECT
  'cidx_post_' || id,
  'post',
  'posts',
  id,
  slug,
  title,
  status,
  author_id,
  published_at,
  updated_at,
  NULL,
  '/blog/' || slug,
  trim(coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content_html, ''))
FROM posts;

INSERT OR IGNORE INTO content_index (
  id, content_type, source_table, source_id, slug, title, status,
  author_id, published_at, updated_at, plugin_id, route_path, searchable_text
)
SELECT
  'cidx_event_' || id,
  'event',
  'events',
  id,
  slug,
  title,
  status,
  author_id,
  published_at,
  updated_at,
  NULL,
  '/events/' || slug,
  trim(coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content_html, ''))
FROM events;

INSERT OR IGNORE INTO content_index (
  id, content_type, source_table, source_id, slug, title, status,
  author_id, published_at, updated_at, plugin_id, route_path, searchable_text
)
SELECT
  'cidx_form_' || id,
  'form',
  'forms',
  id,
  slug,
  title,
  status,
  created_by,
  NULL,
  updated_at,
  'forms-builder',
  NULL,
  trim(coalesce(title, '') || ' ' || coalesce(description, ''))
FROM forms;
