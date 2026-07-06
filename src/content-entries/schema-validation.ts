import type { ContentTypeSchema, SchemaFieldDefinition } from "./types";

const FIELD_TYPES = new Set([
  "text",
  "textarea",
  "number",
  "boolean",
  "date",
  "datetime",
  "select",
  "url",
  "email",
  "image",
  "json",
]);

const URL_PATTERN = /^https?:\/\/.+/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseContentTypeSchema(
  schemaJson: Record<string, unknown> | null | undefined,
): ContentTypeSchema {
  if (!schemaJson || typeof schemaJson !== "object") {
    return { fields: [] };
  }

  const fields = Array.isArray(schemaJson.fields)
    ? (schemaJson.fields as SchemaFieldDefinition[])
    : [];

  return { fields };
}

function validateFieldValue(
  field: SchemaFieldDefinition,
  value: unknown,
): string | null {
  const isEmpty =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "");

  if (field.required && isEmpty) {
    return `${field.label} is required`;
  }

  if (isEmpty) {
    return null;
  }

  switch (field.type) {
    case "text":
    case "textarea":
    case "image":
      if (typeof value !== "string") {
        return `${field.label} must be text`;
      }
      return null;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        return `${field.label} must be a number`;
      }
      return null;
    case "boolean":
      if (typeof value !== "boolean") {
        return `${field.label} must be true or false`;
      }
      return null;
    case "date":
    case "datetime":
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        return `${field.label} must be a valid date`;
      }
      return null;
    case "select": {
      if (typeof value !== "string") {
        return `${field.label} must be a string`;
      }
      const options = field.options ?? [];
      if (options.length > 0 && !options.includes(value)) {
        return `${field.label} must be one of: ${options.join(", ")}`;
      }
      return null;
    }
    case "url":
      if (typeof value !== "string" || !URL_PATTERN.test(value)) {
        return `${field.label} must be a valid URL`;
      }
      return null;
    case "email":
      if (typeof value !== "string" || !EMAIL_PATTERN.test(value)) {
        return `${field.label} must be a valid email`;
      }
      return null;
    case "json":
      if (typeof value === "string") {
        try {
          JSON.parse(value);
          return null;
        } catch {
          return `${field.label} must be valid JSON`;
        }
      }
      try {
        JSON.stringify(value);
        return null;
      } catch {
        return `${field.label} must be valid JSON`;
      }
    default:
      return `${field.label} has unsupported field type`;
  }
}

export function validateMetadataAgainstSchema(
  schema: ContentTypeSchema,
  metadata: Record<string, unknown> | null | undefined,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const data = metadata ?? {};
  const fields = schema.fields ?? [];

  for (const field of fields) {
    if (!field.key || !FIELD_TYPES.has(field.type)) {
      errors.push(`Invalid schema field definition: ${field.key ?? "unknown"}`);
      continue;
    }

    const error = validateFieldValue(field, data[field.key]);
    if (error) {
      errors.push(error);
    }
  }

  for (const key of Object.keys(data)) {
    if (!fields.some((field) => field.key === key)) {
      errors.push(`Unknown metadata field: ${key}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
