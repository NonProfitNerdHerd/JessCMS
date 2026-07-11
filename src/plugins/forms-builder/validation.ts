import {
  parseFieldOptions,
  parseFieldSettings,
  parseFieldValidation,
  type FormFieldRecord,
} from "./types";
import { getFieldTypeDefinition } from "./field-registry";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+]?[\d\s().-]{7,}$/;
const URL_PATTERN = /^https?:\/\/\S+$/i;

function isEmpty(raw: unknown): boolean {
  return (
    raw === undefined ||
    raw === null ||
    (typeof raw === "string" && raw.trim() === "") ||
    (Array.isArray(raw) && raw.length === 0) ||
    (typeof raw === "object" &&
      !Array.isArray(raw) &&
      Object.values(raw as Record<string, unknown>).every(
        (value) => value === undefined || value === null || String(value).trim() === "",
      ))
  );
}

function asText(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map(String).join(", ");
  if (typeof raw === "object" && raw !== null) return JSON.stringify(raw);
  return String(raw);
}

export function validateSubmissionValues(
  fields: FormFieldRecord[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const typeDef = getFieldTypeDefinition(field.field_type);
    if (typeDef && !typeDef.storesValue) {
      continue;
    }

    if (field.field_type === "hidden") {
      continue;
    }

    const key = field.field_key;
    const raw = values[key];
    const validation = parseFieldValidation(field.validation_json);
    const options = parseFieldOptions(field.options_json);
    const settings = parseFieldSettings(field.settings_json);
    const empty = isEmpty(raw);

    if (field.required === 1 && field.field_type !== "consent") {
      if (empty) {
        errors[key] = `${field.label} is required`;
        continue;
      }
    }

    if (field.field_type === "consent") {
      const accepted = raw === true || raw === "true" || raw === "1" || raw === 1;
      if (field.required === 1 && !accepted) {
        errors[key] = "You must accept to continue";
      }
      continue;
    }

    if (empty) {
      continue;
    }

    switch (field.field_type) {
      case "email":
        if (!EMAIL_PATTERN.test(asText(raw))) {
          errors[key] = "Enter a valid email address";
        }
        break;
      case "phone":
        if (!PHONE_PATTERN.test(asText(raw))) {
          errors[key] = "Enter a valid phone number";
        }
        break;
      case "url":
        if (!URL_PATTERN.test(asText(raw).trim())) {
          errors[key] = "Enter a valid URL (http or https)";
        }
        break;
      case "number": {
        const num = Number(asText(raw));
        if (Number.isNaN(num)) {
          errors[key] = "Enter a valid number";
          break;
        }
        if (validation.min !== undefined && num < validation.min) {
          errors[key] = `Minimum value is ${validation.min}`;
        }
        if (validation.max !== undefined && num > validation.max) {
          errors[key] = `Maximum value is ${validation.max}`;
        }
        break;
      }
      case "date": {
        const date = Date.parse(asText(raw));
        if (Number.isNaN(date)) {
          errors[key] = "Enter a valid date";
        }
        break;
      }
      case "name": {
        const obj = typeof raw === "object" && raw && !Array.isArray(raw)
          ? (raw as Record<string, string>)
          : { first: asText(raw) };
        const showFirst = settings.show_first !== false;
        const showLast = settings.show_last !== false;
        if (field.required === 1) {
          if (showFirst && !String(obj.first ?? "").trim()) {
            errors[key] = "First name is required";
          } else if (showLast && !String(obj.last ?? "").trim()) {
            errors[key] = "Last name is required";
          }
        }
        break;
      }
      case "address": {
        const obj = typeof raw === "object" && raw && !Array.isArray(raw)
          ? (raw as Record<string, string>)
          : {};
        if (field.required === 1 && !String(obj.line1 ?? "").trim()) {
          errors[key] = "Address line 1 is required";
        }
        break;
      }
      case "yes_no": {
        const allowed = ["yes", "no", "true", "false", "1", "0"];
        if (!allowed.includes(String(raw).toLowerCase()) && typeof raw !== "boolean") {
          errors[key] = "Select Yes or No";
        }
        break;
      }
      case "select":
      case "radio": {
        const allowed = (options.choices ?? []).map((choice) => choice.value);
        if (allowed.length && !allowed.includes(asText(raw))) {
          errors[key] = "Select a valid option";
        }
        break;
      }
      case "checkbox": {
        const selected = Array.isArray(raw)
          ? raw.map(String)
          : typeof raw === "boolean"
            ? raw
              ? ["1"]
              : []
            : [String(raw)];
        const allowed = (options.choices ?? []).map((choice) => choice.value);
        if (allowed.length && selected.some((value) => !allowed.includes(value) && value !== "1")) {
          // single checkbox without choices is ok with "1"
          if ((options.choices ?? []).length > 0) {
            errors[key] = "Select valid options";
          }
        }
        break;
      }
      default: {
        const text = asText(raw);
        if (validation.minLength !== undefined && text.length < validation.minLength) {
          errors[key] = `Minimum length is ${validation.minLength}`;
        }
        if (validation.maxLength !== undefined && text.length > validation.maxLength) {
          errors[key] = `Maximum length is ${validation.maxLength}`;
        }
        if (validation.pattern) {
          try {
            const regex = new RegExp(validation.pattern);
            if (!regex.test(text)) {
              errors[key] = "Invalid format";
            }
          } catch {
            // ignore invalid admin pattern
          }
        }
      }
    }
  }

  return errors;
}

export function normalizeSubmissionValue(
  fieldType: string,
  raw: unknown,
): string | null {
  if (raw === undefined || raw === null) return null;

  if (fieldType === "name" || fieldType === "address") {
    if (typeof raw === "object" && !Array.isArray(raw)) {
      return JSON.stringify(raw);
    }
  }

  if (Array.isArray(raw)) {
    return raw.map(String).join(", ");
  }

  if (typeof raw === "boolean") {
    return raw ? "true" : "false";
  }

  if (typeof raw === "object") {
    return JSON.stringify(raw);
  }

  return String(raw);
}
