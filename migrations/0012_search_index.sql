-- Phase 12: Global search index expansion

ALTER TABLE content_index ADD COLUMN excerpt TEXT;
ALTER TABLE content_index ADD COLUMN featured_image_id TEXT;
ALTER TABLE content_index ADD COLUMN search_weight REAL DEFAULT 1.0;
ALTER TABLE content_index ADD COLUMN indexed_at TEXT;

ALTER TABLE content_types ADD COLUMN supports_search INTEGER DEFAULT 1;
ALTER TABLE content_types ADD COLUMN search_weight REAL DEFAULT 1.0;
ALTER TABLE content_types ADD COLUMN search_fields_json TEXT;

CREATE INDEX IF NOT EXISTS idx_content_index_excerpt ON content_index(excerpt);
CREATE INDEX IF NOT EXISTS idx_content_index_published_at ON content_index(published_at);
