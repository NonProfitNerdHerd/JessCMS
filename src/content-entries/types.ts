export interface ContentEntryRecord {
  id: string;
  content_type: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string | null;
  content_json: string | null;
  content_html: string | null;
  author_id: string | null;
  featured_image_id: string | null;
  parent_id: string | null;
  template: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  metadata_json: string | null;
  metadata?: Record<string, unknown> | null;
  plugin_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentEntryInput {
  title?: string;
  slug?: string;
  status?: string;
  excerpt?: string | null;
  content_json?: string | null;
  content_html?: string | null;
  featured_image_id?: string | null;
  parent_id?: string | null;
  template?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  published_at?: string | null;
  metadata?: Record<string, unknown> | null;
  change_summary?: string | null;
}

export type SchemaFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "url"
  | "email"
  | "image"
  | "json";

export interface SchemaFieldDefinition {
  key: string;
  label: string;
  type: SchemaFieldType;
  required?: boolean;
  options?: string[];
}

export interface ContentTypeSchema {
  fields?: SchemaFieldDefinition[];
}
