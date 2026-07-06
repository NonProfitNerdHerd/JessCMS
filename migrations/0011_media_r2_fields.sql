-- Phase 11: R2 media upload fields (safe additive migration)

ALTER TABLE media_items ADD COLUMN checksum TEXT;
ALTER TABLE media_items ADD COLUMN metadata_json TEXT;
