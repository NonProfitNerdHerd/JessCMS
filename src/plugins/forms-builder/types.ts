export const FORM_STATUSES = ["draft", "active", "disabled", "archived"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "url",
  "hidden",
  "name",
  "address",
  "select",
  "radio",
  "checkbox",
  "yes_no",
  "date",
  "consent",
  "heading",
  "paragraph_content",
  "divider",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const SUBMISSION_STATUSES = ["new", "read", "spam", "archived"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export interface FormNotificationConfig {
  key: string;
  name: string;
  enabled: boolean;
  recipient: string;
  reply_to?: string;
  subject: string;
  message: string;
  include_field_summary?: boolean;
  format?: "html" | "text";
}

export interface FormConfirmationConfig {
  key: string;
  type: "message" | "redirect";
  message?: string;
  redirect_url?: string;
  enabled?: boolean;
}

export interface FormSettings {
  success_message?: string;
  submit_label?: string;
  honeypot_enabled?: boolean;
  turnstile_enabled?: boolean;
  turnstile_site_key?: string | null;
  ajax?: boolean;
  require_login?: boolean;
  notifications?: FormNotificationConfig[];
  confirmations?: FormConfirmationConfig[];
}

export interface FieldOptions {
  choices?: Array<{ label: string; value: string; disabled?: boolean }>;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  allowedProtocols?: string[];
}

export interface FormRecord {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: FormStatus;
  settings_json: string | null;
  draft_definition_json?: string | null;
  published_definition_json?: string | null;
  draft_version?: number;
  published_version?: number | null;
  schema_version?: number;
  submission_count?: number;
  last_submission_at?: string | null;
  published_at?: string | null;
  archived_at?: string | null;
  created_by: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormFieldRecord {
  id: string;
  form_id: string;
  field_key: string;
  label: string;
  field_type: FieldType | string;
  placeholder: string | null;
  help_text: string | null;
  required: number;
  sort_order: number;
  options_json: string | null;
  validation_json: string | null;
  settings_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormSubmissionRecord {
  id: string;
  form_id: string;
  status: SubmissionStatus;
  ip_hash: string | null;
  user_agent: string | null;
  turnstile_verified: number;
  metadata_json: string | null;
  created_at: string;
  form_version_id?: string | null;
  sequence_number?: number | null;
  updated_at?: string | null;
  referrer?: string | null;
  page_url?: string | null;
  user_id?: string | null;
  spam_score?: number | null;
  spam_reason?: string | null;
  idempotency_key?: string | null;
  completion_ms?: number | null;
}

export interface FormSubmissionValueRecord {
  id: string;
  submission_id: string;
  field_id: string | null;
  field_key: string;
  value: string | null;
  created_at: string;
}

export interface FormVersionRecord {
  id: string;
  form_id: string;
  version_number: number;
  definition_json: string;
  schema_version: number;
  change_note: string | null;
  is_published: number;
  created_by: string | null;
  created_at: string;
}

export interface FormWithFields extends FormRecord {
  fields: FormFieldRecord[];
  settings: FormSettings;
  definition?: import("./definition").FormDefinition;
}

export function parseFormSettings(raw: string | null | undefined): FormSettings {
  if (!raw?.trim()) {
    return {
      success_message: "Thank you for your submission.",
      submit_label: "Submit",
      honeypot_enabled: true,
      turnstile_enabled: false,
      ajax: true,
    };
  }

  try {
    return JSON.parse(raw) as FormSettings;
  } catch {
    return {};
  }
}

export function parseFieldOptions(raw: string | null | undefined): FieldOptions {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as FieldOptions;
  } catch {
    return {};
  }
}

export function parseFieldValidation(raw: string | null | undefined): FieldValidation {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as FieldValidation;
  } catch {
    return {};
  }
}

export function parseFieldSettings(raw: string | null | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
