-- Phase 10: Generic content storage for plugin-registered content types

CREATE TABLE content_entries (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  excerpt TEXT,
  content_json TEXT,
  content_html TEXT,
  author_id TEXT REFERENCES users(id),
  featured_image_id TEXT REFERENCES media_items(id),
  parent_id TEXT,
  template TEXT,
  seo_title TEXT,
  seo_description TEXT,
  published_at TEXT,
  metadata_json TEXT,
  plugin_id TEXT REFERENCES plugins(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_content_entries_content_type ON content_entries(content_type);
CREATE INDEX idx_content_entries_slug ON content_entries(slug);
CREATE INDEX idx_content_entries_status ON content_entries(status);
CREATE INDEX idx_content_entries_published_at ON content_entries(published_at);
CREATE INDEX idx_content_entries_author_id ON content_entries(author_id);
CREATE INDEX idx_content_entries_plugin_id ON content_entries(plugin_id);
CREATE UNIQUE INDEX idx_content_entries_type_slug ON content_entries(content_type, slug);

-- Shared generic content table (platform-owned, plugin rows reference via plugin_id)
INSERT OR IGNORE INTO plugins (id, name, version, enabled, manifest_json, lifecycle_state, installed_at, updated_at)
VALUES ('jesscms-core', 'JessCMS Core', '0.9.0', 1, '{}', 'enabled', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO plugin_resources (
  id, plugin_id, resource_type, resource_name, table_name,
  ownership_type, cleanup_policy
) VALUES (
  'pr_core_content_entries', 'jesscms-core', 'table', 'content_entries', 'content_entries',
  'owns', 'retain'
);
