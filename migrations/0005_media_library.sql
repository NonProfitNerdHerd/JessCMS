-- Phase 7A: Media Library

ALTER TABLE media_items ADD COLUMN original_filename TEXT;
ALTER TABLE media_items ADD COLUMN title TEXT;
ALTER TABLE media_items ADD COLUMN caption TEXT;
ALTER TABLE media_items ADD COLUMN description TEXT;
ALTER TABLE media_items ADD COLUMN width INTEGER;
ALTER TABLE media_items ADD COLUMN height INTEGER;
ALTER TABLE media_items ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'url';
ALTER TABLE media_items ADD COLUMN storage_key TEXT;
ALTER TABLE media_items ADD COLUMN public_url TEXT;
ALTER TABLE media_items ADD COLUMN folder TEXT;
ALTER TABLE media_items ADD COLUMN file_size INTEGER;
ALTER TABLE media_items ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));

UPDATE media_items SET public_url = url WHERE public_url IS NULL AND url IS NOT NULL;
UPDATE media_items SET original_filename = filename WHERE original_filename IS NULL;
UPDATE media_items SET title = filename WHERE title IS NULL;
UPDATE media_items SET file_size = size_bytes WHERE file_size IS NULL;
UPDATE media_items SET storage_provider = 'url' WHERE storage_provider IS NULL OR storage_provider = '';

CREATE INDEX IF NOT EXISTS idx_media_items_folder ON media_items(folder);
CREATE INDEX IF NOT EXISTS idx_media_items_mime_type ON media_items(mime_type);
CREATE INDEX IF NOT EXISTS idx_media_items_created_at ON media_items(created_at DESC);

INSERT OR IGNORE INTO permissions (id, slug, name, description) VALUES
  ('perm_media_read', 'media:read', 'Read media', 'View media library items'),
  ('perm_media_create', 'media:create', 'Create media', 'Add media library items'),
  ('perm_media_update', 'media:update', 'Update media', 'Edit media metadata'),
  ('perm_media_delete', 'media:delete', 'Delete media', 'Remove media library items');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('role_admin', 'perm_media_read'),
  ('role_admin', 'perm_media_create'),
  ('role_admin', 'perm_media_update'),
  ('role_admin', 'perm_media_delete'),
  ('role_editor', 'perm_media_read'),
  ('role_editor', 'perm_media_create'),
  ('role_editor', 'perm_media_update');
