import { parseFieldOptions, parseFieldValidation, type FormFieldRecord } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+]?[\d\s().-]{7,}$/;

export function validateSubmissionValues(
  fields: FormFieldRecord[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (field.field_type === "hidden") {
      continue;
    }

    const key = field.field_key;
    const raw = values[key];
    const validation = parseFieldValidation(field.validation_json);
    const options = parseFieldOptions(field.options_json);
    const isEmpty =
      raw === undefined ||
      raw === null ||
      (typeof raw === "string" && raw.trim() === "") ||
      (Array.isArray(raw) && raw.length === 0);

    if (field.required === 1 && field.field_type !== "consent") {
      if (isEmpty) {
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

    if (isEmpty) {
      continue;
    }

    const text = Array.isArray(raw) ? raw.map(String).join(", ") : String(raw);

    switch (field.field_type) {
      case "email":
        if (!EMAIL_PATTERN.test(text)) {
          errors[key] = "Enter a valid email address";
        }
        break;
      case "phone":
        if (!PHONE_PATTERN.test(text)) {
          errors[key] = "Enter a valid phone number";
        }
        break;
      case "number": {
        const num = Number(text);
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
        const date = Date.parse(text);
        if (Number.isNaN(date)) {
          errors[key] = "Enter a valid date";
        }
        break;
      }
      case "select":
      case "radio": {
        const allowed = (options.choices ?? []).map((choice) => choice.value);
        if (allowed.length && !allowed.includes(text)) {
          errors[key] = "Select a valid option";
        }
        break;
      }
      default: {
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
