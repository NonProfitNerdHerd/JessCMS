-- Phase 13: Users/Roles/Audit permissions and user active flag

ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

UPDATE users SET is_active = 1 WHERE is_active IS NULL;

INSERT INTO permissions (id, slug, name, description) VALUES
  ('perm_users_read', 'users:read', 'Read users', 'View user accounts'),
  ('perm_users_create', 'users:create', 'Create users', 'Create user accounts'),
  ('perm_users_update', 'users:update', 'Update users', 'Edit user accounts and roles'),
  ('perm_users_disable', 'users:disable', 'Disable users', 'Enable or disable user accounts'),
  ('perm_users_reset_password', 'users:reset_password', 'Reset passwords', 'Set temporary passwords for users'),
  ('perm_roles_read', 'roles:read', 'Read roles', 'View roles and their permissions'),
  ('perm_roles_create', 'roles:create', 'Create roles', 'Create custom roles'),
  ('perm_roles_update', 'roles:update', 'Update roles', 'Edit role permissions'),
  ('perm_permissions_read', 'permissions:read', 'Read permissions', 'View all permission definitions'),
  ('perm_audit_read', 'audit:read', 'Read audit log', 'View system audit log');

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('role_admin', 'perm_users_read'),
  ('role_admin', 'perm_users_create'),
  ('role_admin', 'perm_users_update'),
  ('role_admin', 'perm_users_disable'),
  ('role_admin', 'perm_users_reset_password'),
  ('role_admin', 'perm_roles_read'),
  ('role_admin', 'perm_roles_create'),
  ('role_admin', 'perm_roles_update'),
  ('role_admin', 'perm_permissions_read'),
  ('role_admin', 'perm_audit_read');

CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
