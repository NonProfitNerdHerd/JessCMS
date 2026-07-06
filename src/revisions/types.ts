import type { ContentEntityType } from "../workflow/types";

export interface ContentRevisionRecord {
  id: string;
  entity_type: ContentEntityType;
  entity_id: string;
  revision_number: number;
  snapshot_json: string;
  change_summary: string | null;
  author_id: string | null;
  created_at: string;
  author_name?: string | null;
  author_email?: string | null;
}

export interface RevisionSnapshot {
  [key: string]: unknown;
}

export interface RevisionCompareResult {
  from_revision: number;
  to_revision: number;
  changed_fields: Array<{
    field: string;
    from: unknown;
    to: unknown;
  }>;
}
