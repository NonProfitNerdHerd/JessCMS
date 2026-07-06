-- Phase 7C: Publishing workflow and revision history

CREATE TABLE content_revisions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  change_summary TEXT,
  author_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity_type, entity_id, revision_number)
);

CREATE INDEX idx_content_revisions_entity ON content_revisions(entity_type, entity_id);
CREATE INDEX idx_content_revisions_created_at ON content_revisions(created_at DESC);

CREATE TABLE workflow_states (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  assigned_reviewer_id TEXT REFERENCES users(id),
  notes TEXT,
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX idx_workflow_states_state ON workflow_states(state);
CREATE INDEX idx_workflow_states_scheduled_at ON workflow_states(scheduled_at);

CREATE TABLE workflow_history (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  action TEXT NOT NULL,
  comment TEXT,
  actor_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_workflow_history_entity ON workflow_history(entity_type, entity_id);
CREATE INDEX idx_workflow_history_created_at ON workflow_history(created_at DESC);

INSERT OR IGNORE INTO permissions (id, slug, name, description) VALUES
  ('perm_workflow_submit', 'workflow:submit', 'Submit for review', 'Submit content for editorial review'),
  ('perm_workflow_approve', 'workflow:approve', 'Approve content', 'Approve or reject content in review'),
  ('perm_workflow_publish', 'workflow:publish', 'Publish content', 'Publish, schedule, or archive content'),
  ('perm_revisions_read', 'revisions:read', 'Read revisions', 'View content revision history'),
  ('perm_revisions_restore', 'revisions:restore', 'Restore revisions', 'Restore content from a previous revision');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('role_admin', 'perm_workflow_submit'),
  ('role_admin', 'perm_workflow_approve'),
  ('role_admin', 'perm_workflow_publish'),
  ('role_admin', 'perm_revisions_read'),
  ('role_admin', 'perm_revisions_restore'),
  ('role_editor', 'perm_workflow_submit'),
  ('role_editor', 'perm_revisions_read'),
  ('role_viewer', 'perm_revisions_read');

-- Backfill workflow states from existing content
INSERT OR IGNORE INTO workflow_states (id, entity_type, entity_id, state, scheduled_at, updated_at)
SELECT
  'wfs_' || substr(hex(randomblob(8)), 1, 16),
  'page',
  id,
  CASE status
    WHEN 'published' THEN 'published'
    WHEN 'scheduled' THEN 'scheduled'
    WHEN 'archived' THEN 'archived'
    ELSE 'draft'
  END,
  CASE WHEN status = 'scheduled' THEN published_at ELSE NULL END,
  updated_at
FROM pages;

INSERT OR IGNORE INTO workflow_states (id, entity_type, entity_id, state, scheduled_at, updated_at)
SELECT
  'wfs_' || substr(hex(randomblob(8)), 1, 16),
  'post',
  id,
  CASE status
    WHEN 'published' THEN 'published'
    WHEN 'scheduled' THEN 'scheduled'
    WHEN 'archived' THEN 'archived'
    ELSE 'draft'
  END,
  CASE WHEN status = 'scheduled' THEN published_at ELSE NULL END,
  updated_at
FROM posts;

INSERT OR IGNORE INTO workflow_states (id, entity_type, entity_id, state, scheduled_at, updated_at)
SELECT
  'wfs_' || substr(hex(randomblob(8)), 1, 16),
  'event',
  id,
  CASE status
    WHEN 'published' THEN 'published'
    WHEN 'scheduled' THEN 'scheduled'
    WHEN 'archived' THEN 'archived'
    ELSE 'draft'
  END,
  CASE WHEN status = 'scheduled' THEN published_at ELSE NULL END,
  updated_at
FROM events;
