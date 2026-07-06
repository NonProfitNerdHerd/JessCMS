-- Phase 7B: Forms Builder plugin

CREATE TABLE forms (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  settings_json TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_forms_status ON forms(status);
CREATE INDEX idx_forms_slug ON forms(slug);

CREATE TABLE form_fields (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  placeholder TEXT,
  help_text TEXT,
  required INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  options_json TEXT,
  validation_json TEXT,
  settings_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(form_id, field_key)
);

CREATE INDEX idx_form_fields_form_id ON form_fields(form_id);

CREATE TABLE form_submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new',
  ip_hash TEXT,
  user_agent TEXT,
  turnstile_verified INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);

CREATE TABLE form_submission_values (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  field_id TEXT REFERENCES form_fields(id) ON DELETE SET NULL,
  field_key TEXT NOT NULL,
  value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_form_submission_values_submission_id ON form_submission_values(submission_id);

INSERT OR IGNORE INTO permissions (id, slug, name, description) VALUES
  ('perm_forms_read', 'forms:read', 'Read forms', 'View forms and builder'),
  ('perm_forms_create', 'forms:create', 'Create forms', 'Create new forms'),
  ('perm_forms_update', 'forms:update', 'Update forms', 'Edit forms and fields'),
  ('perm_forms_delete', 'forms:delete', 'Delete forms', 'Delete forms'),
  ('perm_forms_submissions_read', 'forms:submissions:read', 'Read form submissions', 'View form submissions'),
  ('perm_forms_submissions_update', 'forms:submissions:update', 'Update form submissions', 'Update submission status');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('role_admin', 'perm_forms_read'),
  ('role_admin', 'perm_forms_create'),
  ('role_admin', 'perm_forms_update'),
  ('role_admin', 'perm_forms_delete'),
  ('role_admin', 'perm_forms_submissions_read'),
  ('role_admin', 'perm_forms_submissions_update'),
  ('role_editor', 'perm_forms_read'),
  ('role_editor', 'perm_forms_create'),
  ('role_editor', 'perm_forms_update'),
  ('role_editor', 'perm_forms_submissions_read'),
  ('role_editor', 'perm_forms_submissions_update');
