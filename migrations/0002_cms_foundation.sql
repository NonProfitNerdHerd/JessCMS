-- JessCMS Phase 2: CMS foundation schema
-- Adds WordPress-like content fields, events, menus, RBAC, plugins, theme, audit.
-- Does NOT modify 0001_initial_schema.sql (already applied).

-- ---------------------------------------------------------------------------
-- Extend pages
-- ---------------------------------------------------------------------------

ALTER TABLE pages ADD COLUMN excerpt TEXT;
ALTER TABLE pages ADD COLUMN content_json TEXT;
ALTER TABLE pages ADD COLUMN content_html TEXT;
ALTER TABLE pages ADD COLUMN featured_image_id TEXT REFERENCES media_items(id);
ALTER TABLE pages ADD COLUMN parent_id TEXT REFERENCES pages(id);
ALTER TABLE pages ADD COLUMN template TEXT;
ALTER TABLE pages ADD COLUMN seo_title TEXT;
ALTER TABLE pages ADD COLUMN seo_description TEXT;

UPDATE pages SET content_html = content WHERE content IS NOT NULL AND content != '';

CREATE INDEX idx_pages_parent_id ON pages(parent_id);
CREATE INDEX idx_pages_featured_image_id ON pages(featured_image_id);

-- ---------------------------------------------------------------------------
-- Extend posts
-- ---------------------------------------------------------------------------

ALTER TABLE posts ADD COLUMN content_json TEXT;
ALTER TABLE posts ADD COLUMN content_html TEXT;
ALTER TABLE posts ADD COLUMN featured_image_id TEXT REFERENCES media_items(id);
ALTER TABLE posts ADD COLUMN parent_id TEXT REFERENCES posts(id);
ALTER TABLE posts ADD COLUMN template TEXT;
ALTER TABLE posts ADD COLUMN seo_title TEXT;
ALTER TABLE posts ADD COLUMN seo_description TEXT;

UPDATE posts SET content_html = content WHERE content IS NOT NULL AND content != '';

CREATE INDEX idx_posts_parent_id ON posts(parent_id);
CREATE INDEX idx_posts_featured_image_id ON posts(featured_image_id);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
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
  start_datetime TEXT NOT NULL,
  end_datetime TEXT,
  location_name TEXT,
  location_address TEXT,
  latitude REAL,
  longitude REAL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  event_status TEXT NOT NULL DEFAULT 'scheduled',
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_datetime ON events(start_datetime);
CREATE INDEX idx_events_event_status ON events(event_status);
CREATE INDEX idx_events_author_id ON events(author_id);

-- ---------------------------------------------------------------------------
-- Menus
-- ---------------------------------------------------------------------------

CREATE TABLE menus (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES menu_items(id),
  label TEXT NOT NULL,
  url TEXT,
  content_type TEXT,
  content_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  open_in_new_tab INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX idx_menu_items_parent_id ON menu_items(parent_id);
CREATE INDEX idx_menu_items_sort_order ON menu_items(menu_id, sort_order);

-- ---------------------------------------------------------------------------
-- Roles and permissions
-- ---------------------------------------------------------------------------

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- Seed default roles
INSERT INTO roles (id, slug, name, description) VALUES
  ('role_admin', 'admin', 'Administrator', 'Full access to all CMS features'),
  ('role_editor', 'editor', 'Editor', 'Create and publish content'),
  ('role_viewer', 'viewer', 'Viewer', 'Read-only access');

-- Seed core permissions
INSERT INTO permissions (id, slug, name, description) VALUES
  ('perm_content_read', 'content.read', 'Read content', 'View pages, posts, and events'),
  ('perm_content_write', 'content.write', 'Write content', 'Create and edit content'),
  ('perm_content_publish', 'content.publish', 'Publish content', 'Publish and schedule content'),
  ('perm_plugins_manage', 'plugins.manage', 'Manage plugins', 'Enable and configure plugins'),
  ('perm_theme_manage', 'theme.manage', 'Manage theme', 'Edit theme and design settings'),
  ('perm_users_manage', 'users.manage', 'Manage users', 'Create and manage user accounts');

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('role_admin', 'perm_content_read'),
  ('role_admin', 'perm_content_write'),
  ('role_admin', 'perm_content_publish'),
  ('role_admin', 'perm_plugins_manage'),
  ('role_admin', 'perm_theme_manage'),
  ('role_admin', 'perm_users_manage'),
  ('role_editor', 'perm_content_read'),
  ('role_editor', 'perm_content_write'),
  ('role_editor', 'perm_content_publish'),
  ('role_viewer', 'perm_content_read');

-- ---------------------------------------------------------------------------
-- Theme settings
-- ---------------------------------------------------------------------------

CREATE TABLE theme_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO theme_settings (key, value) VALUES
  ('site_name', '"JessCMS Site"'),
  ('logo_url', 'null'),
  ('favicon_url', 'null'),
  ('primary_color', '"#2563eb"'),
  ('secondary_color', '"#64748b"'),
  ('background_color', '"#ffffff"'),
  ('text_color', '"#1e293b"'),
  ('heading_font', '"system-ui, sans-serif"'),
  ('body_font', '"system-ui, sans-serif"'),
  ('button_style', '{"variant":"solid","radius":"0.375rem","size":"md"}'),
  ('layout_width', '"1200px"'),
  ('custom_css', '""');

-- ---------------------------------------------------------------------------
-- Plugins
-- ---------------------------------------------------------------------------

CREATE TABLE plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  manifest_json TEXT NOT NULL,
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE plugin_settings (
  plugin_id TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (plugin_id, key)
);

CREATE INDEX idx_plugins_enabled ON plugins(enabled);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
