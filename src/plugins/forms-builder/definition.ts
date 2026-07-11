import { generateId } from "../../lib/crypto";
import { createDefaultFieldProps, getFieldTypeDefinition, isValidFieldType } from "./field-registry";
import type { FormFieldRecord, FormSettings } from "./types";
import { parseFieldOptions, parseFieldValidation, parseFormSettings } from "./types";
import type { FormNotificationConfig, FormConfirmationConfig } from "./types";

export const FORM_DEFINITION_SCHEMA_VERSION = 1;

export interface FormDefinitionField {
  id: string;
  key: string;
  type: string;
  version: number;
  label: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  required: boolean;
  width?: string;
  settings?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  options?: Record<string, unknown>;
  conditions?: unknown[];
}

export interface FormDefinitionPage {
  id: string;
  title: string;
  description?: string;
  fields: FormDefinitionField[];
}

export interface FormDefinition {
  schemaVersion: number;
  formId?: string;
  settings: FormSettings;
  pages: FormDefinitionPage[];
  design?: Record<string, unknown>;
  security?: Record<string, unknown>;
}

export function emptyDefinition(formId?: string): FormDefinition {
  return {
    schemaVersion: FORM_DEFINITION_SCHEMA_VERSION,
    formId,
    settings: {
      success_message: "Thank you for your submission.",
      submit_label: "Submit",
      honeypot_enabled: true,
      turnstile_enabled: false,
      ajax: true,
      notifications: [
        {
          key: "admin",
          name: "Administrator notification",
          enabled: false,
          recipient: "",
          subject: "New form submission: {form:name}",
          message: "A new submission was received for {form:name}.\n\n{submission:summary}",
          include_field_summary: true,
          format: "text",
        },
      ],
      confirmations: [
        {
          key: "default",
          type: "message",
          message: "Thank you for your submission.",
          enabled: true,
        },
      ],
    },
    pages: [
      {
        id: generateId("page"),
        title: "Page 1",
        fields: [],
      },
    ],
    design: {},
    security: {},
  };
}

export function definitionFromFields(
  formId: string,
  fields: FormFieldRecord[],
  settings: FormSettings,
): FormDefinition {
  const def = emptyDefinition(formId);
  def.settings = {
    ...def.settings,
    ...settings,
    notifications: (settings as FormSettings & { notifications?: FormNotificationConfig[] }).notifications
      ?? def.settings.notifications,
    confirmations: (settings as FormSettings & { confirmations?: FormConfirmationConfig[] }).confirmations
      ?? def.settings.confirmations,
  };
  def.pages[0].fields = fields.map((field) => {
    const typeDef = getFieldTypeDefinition(field.field_type);
    return {
      id: field.id,
      key: field.field_key,
      type: field.field_type,
      version: typeDef?.version ?? 1,
      label: field.label,
      description: field.help_text ?? undefined,
      placeholder: field.placeholder ?? undefined,
      required: Boolean(field.required),
      width: "100",
      options: parseFieldOptions(field.options_json),
      validation: parseFieldValidation(field.validation_json),
      settings: field.settings_json?.trim()
        ? (JSON.parse(field.settings_json) as Record<string, unknown>)
        : typeDef?.defaultSettings,
      conditions: [],
    };
  });
  return def;
}

export function parseDefinition(raw: string | null | undefined, formId?: string): FormDefinition {
  if (!raw?.trim()) return emptyDefinition(formId);
  try {
    const parsed = JSON.parse(raw) as FormDefinition;
    return migrateDefinition(parsed, formId);
  } catch {
    return emptyDefinition(formId);
  }
}

export function migrateDefinition(def: FormDefinition, formId?: string): FormDefinition {
  const base = emptyDefinition(formId ?? def.formId);
  const schemaVersion = Number(def.schemaVersion ?? 0);
  const pages = Array.isArray(def.pages) && def.pages.length ? def.pages : base.pages;
  return {
    ...base,
    ...def,
    schemaVersion: Math.max(schemaVersion, FORM_DEFINITION_SCHEMA_VERSION),
    formId: formId ?? def.formId ?? base.formId,
    settings: { ...base.settings, ...(def.settings ?? {}) },
    pages: pages.map((page) => ({
      id: page.id || generateId("page"),
      title: page.title || "Page",
      description: page.description,
      fields: (page.fields ?? []).map((field) => normalizeDefinitionField(field)),
    })),
    design: def.design ?? {},
    security: def.security ?? {},
  };
}

export function normalizeDefinitionField(field: Partial<FormDefinitionField>): FormDefinitionField {
  const type = isValidFieldType(String(field.type ?? "text")) ? String(field.type) : "text";
  const defaults = createDefaultFieldProps(type);
  return {
    id: field.id || generateId("fld"),
    key: field.key || slugKey(field.label || defaults.label),
    type,
    version: Number(field.version ?? 1),
    label: field.label || defaults.label,
    description: field.description,
    placeholder: field.placeholder,
    defaultValue: field.defaultValue,
    required: Boolean(field.required),
    width: field.width || "100",
    settings: field.settings ?? defaults.settings,
    validation: field.validation ?? defaults.validation,
    options: field.options ?? defaults.options,
    conditions: Array.isArray(field.conditions) ? field.conditions : [],
  };
}

function slugKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "field";
}

export function flattenDefinitionFields(def: FormDefinition): FormDefinitionField[] {
  return def.pages.flatMap((page) => page.fields);
}

export function definitionToFieldRows(
  formId: string,
  def: FormDefinition,
): Array<{
  id: string;
  form_id: string;
  field_key: string;
  label: string;
  field_type: string;
  placeholder: string | null;
  help_text: string | null;
  required: number;
  sort_order: number;
  options_json: string | null;
  validation_json: string | null;
  settings_json: string | null;
}> {
  return flattenDefinitionFields(def).map((field, index) => ({
    id: field.id,
    form_id: formId,
    field_key: field.key,
    label: field.label,
    field_type: field.type,
    placeholder: field.placeholder ?? null,
    help_text: field.description ?? null,
    required: field.required ? 1 : 0,
    sort_order: index,
    options_json: field.options ? JSON.stringify(field.options) : null,
    validation_json: field.validation ? JSON.stringify(field.validation) : null,
    settings_json: field.settings ? JSON.stringify(field.settings) : null,
  }));
}

export function ensureDefinitionSynced(
  formId: string,
  fields: FormFieldRecord[],
  settingsRaw: string | null,
  draftDefinitionRaw: string | null,
): FormDefinition {
  if (draftDefinitionRaw?.trim()) {
    return parseDefinition(draftDefinitionRaw, formId);
  }
  return definitionFromFields(formId, fields, parseFormSettings(settingsRaw));
}
