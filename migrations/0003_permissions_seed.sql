-- Phase 3: granular permissions (colon-separated slugs)

INSERT INTO permissions (id, slug, name, description) VALUES
  ('perm_content_create', 'content:create', 'Create content', 'Create pages, posts, and events'),
  ('perm_content_update', 'content:update', 'Update content', 'Edit existing content'),
  ('perm_content_delete', 'content:delete', 'Delete content', 'Delete pages, posts, and events'),
  ('perm_settings_read', 'settings:read', 'Read settings', 'View site and theme settings'),
  ('perm_settings_update', 'settings:update', 'Update settings', 'Edit site and theme settings'),
  ('perm_plugins_read', 'plugins:read', 'Read plugins', 'View installed plugins'),
  ('perm_plugins_update', 'plugins:update', 'Update plugins', 'Enable and configure plugins');

-- Map legacy dot permissions to colon checks in code; grant new permissions to roles.

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('role_admin', 'perm_content_create'),
  ('role_admin', 'perm_content_update'),
  ('role_admin', 'perm_content_delete'),
  ('role_admin', 'perm_settings_read'),
  ('role_admin', 'perm_settings_update'),
  ('role_admin', 'perm_plugins_read'),
  ('role_admin', 'perm_plugins_update'),
  ('role_editor', 'perm_content_create'),
  ('role_editor', 'perm_content_update'),
  ('role_editor', 'perm_settings_read'),
  ('role_editor', 'perm_plugins_read'),
  ('role_viewer', 'perm_settings_read'),
  ('role_viewer', 'perm_plugins_read');

-- Aliases: map content.read -> content:read behavior in application code.
-- Existing perm_content_read (content.read) remains for backward compatibility.
