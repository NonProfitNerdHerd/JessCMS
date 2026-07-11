-- Forms platform Phase 1–4: versioning, definition JSON, events, notes, notifications

ALTER TABLE forms ADD COLUMN draft_definition_json TEXT;
ALTER TABLE forms ADD COLUMN published_definition_json TEXT;
ALTER TABLE forms ADD COLUMN draft_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE forms ADD COLUMN published_version INTEGER;
ALTER TABLE forms ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE forms ADD COLUMN submission_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE forms ADD COLUMN last_submission_at TEXT;
ALTER TABLE forms ADD COLUMN published_at TEXT;
ALTER TABLE forms ADD COLUMN archived_at TEXT;
ALTER TABLE forms ADD COLUMN updated_by TEXT REFERENCES users(id);

CREATE TABLE IF NOT EXISTS form_versions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  definition_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  change_note TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(form_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_form_versions_form_id ON form_versions(form_id);

CREATE TABLE IF NOT EXISTS form_submission_notes (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_form_submission_notes_submission ON form_submission_notes(submission_id);

CREATE TABLE IF NOT EXISTS form_submission_events (
  id TEXT PRIMARY KEY,
  submission_id TEXT REFERENCES form_submissions(id) ON DELETE CASCADE,
  form_id TEXT REFERENCES forms(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT,
  metadata_json TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_form_submission_events_submission ON form_submission_events(submission_id);
CREATE INDEX IF NOT EXISTS idx_form_submission_events_form ON form_submission_events(form_id);

CREATE TABLE IF NOT EXISTS form_notification_log (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submission_id TEXT REFERENCES form_submissions(id) ON DELETE SET NULL,
  notification_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  recipient TEXT,
  subject TEXT,
  error_message TEXT,
  provider_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_form_notification_log_form ON form_notification_log(form_id);
CREATE INDEX IF NOT EXISTS idx_form_notification_log_submission ON form_notification_log(submission_id);

ALTER TABLE form_submissions ADD COLUMN form_version_id TEXT REFERENCES form_versions(id);
ALTER TABLE form_submissions ADD COLUMN sequence_number INTEGER;
ALTER TABLE form_submissions ADD COLUMN updated_at TEXT;
ALTER TABLE form_submissions ADD COLUMN referrer TEXT;
ALTER TABLE form_submissions ADD COLUMN page_url TEXT;
ALTER TABLE form_submissions ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE form_submissions ADD COLUMN spam_score REAL;
ALTER TABLE form_submissions ADD COLUMN spam_reason TEXT;
ALTER TABLE form_submissions ADD COLUMN idempotency_key TEXT;
ALTER TABLE form_submissions ADD COLUMN completion_ms INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_form_submissions_idempotency
  ON form_submissions(form_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

INSERT OR IGNORE INTO permissions (id, slug, name, description) VALUES
  ('perm_forms_publish', 'forms:publish', 'Publish forms', 'Publish form drafts'),
  ('perm_forms_export', 'forms:export', 'Export form submissions', 'Export submission data'),
  ('perm_forms_notifications', 'forms:notifications', 'Manage form notifications', 'Configure form email notifications');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('role_admin', 'perm_forms_publish'),
  ('role_admin', 'perm_forms_export'),
  ('role_admin', 'perm_forms_notifications'),
  ('role_editor', 'perm_forms_publish'),
  ('role_editor', 'perm_forms_export');
