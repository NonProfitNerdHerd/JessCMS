-- Phase 14: draft block documents for published content editing

ALTER TABLE pages ADD COLUMN draft_content_json TEXT;
ALTER TABLE posts ADD COLUMN draft_content_json TEXT;
ALTER TABLE events ADD COLUMN draft_content_json TEXT;
ALTER TABLE content_entries ADD COLUMN draft_content_json TEXT;
