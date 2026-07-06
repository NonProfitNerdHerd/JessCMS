export const FORM_STATUSES = ["draft", "active", "archived"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "select",
  "radio",
  "checkbox",
  "date",
  "hidden",
  "consent",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const SUBMISSION_STATUSES = ["new", "read", "spam", "archived"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export interface FormSettings {
  success_message?: string;
  submit_label?: string;
  honeypot_enabled?: boolean;
  turnstile_enabled?: boolean;
  turnstile_site_key?: string | null;
}

export interface FieldOptions {
  choices?: Array<{ label: string; value: string }>;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface FormRecord {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: FormStatus;
  settings_json: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormFieldRecord {
  id: string;
  form_id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
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
}

export interface FormSubmissionValueRecord {
  id: string;
  submission_id: string;
  field_id: string | null;
  field_key: string;
  value: string | null;
  created_at: string;
}

export interface FormWithFields extends FormRecord {
  fields: FormFieldRecord[];
  settings: FormSettings;
}

export function parseFormSettings(raw: string | null | undefined): FormSettings {
  if (!raw?.trim()) {
    return {
      success_message: "Thank you for your submission.",
      submit_label: "Submit",
      honeypot_enabled: true,
      turnstile_enabled: false,
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
