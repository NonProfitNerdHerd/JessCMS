-- Phase 9: Plugin runtime — seed new plugin rows for FK references

INSERT OR IGNORE INTO plugins (id, name, version, enabled, manifest_json, lifecycle_state, installed_at, updated_at)
VALUES
  ('storm-platform', 'Storm Platform', '0.1.0', 0, '{}', 'disabled', datetime('now'), datetime('now')),
  ('nonprofit-platform', 'Nonprofit Platform', '0.1.0', 0, '{}', 'disabled', datetime('now'), datetime('now'));
