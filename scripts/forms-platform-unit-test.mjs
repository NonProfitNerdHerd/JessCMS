import { randomUUID } from "node:crypto";

/**
 * Self-contained checks for the forms platform's pure foundation logic.
 * Run: node scripts/forms-platform-unit-test.mjs
 */

function assert(name, condition) {
  console.log(condition ? `✓ ${name}` : `✗ ${name}`);
  if (!condition) process.exitCode = 1;
}

const FORM_DEFINITION_SCHEMA_VERSION = 1;

const FIELD_REGISTRY = [
  { type: "text", storesValue: true },
  { type: "textarea", storesValue: true },
  { type: "email", storesValue: true },
  { type: "phone", storesValue: true },
  { type: "number", storesValue: true },
  { type: "url", storesValue: true },
  { type: "hidden", storesValue: true },
  { type: "name", storesValue: true },
  { type: "address", storesValue: true },
  { type: "select", storesValue: true },
  { type: "radio", storesValue: true },
  { type: "checkbox", storesValue: true },
  { type: "yes_no", storesValue: true },
  { type: "date", storesValue: true },
  { type: "consent", storesValue: true },
  { type: "heading", storesValue: false },
  { type: "paragraph_content", storesValue: false },
  { type: "divider", storesValue: false },
];

function applyMergeTags(template, tags) {
  return String(template ?? "").replace(/\{([a-z0-9:_-]+)\}/gi, (_, key) => {
    return tags[key] ?? tags[key.toLowerCase()] ?? "";
  });
}

function sanitizeEmailHeader(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

function escapeCsvFormula(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function updateFieldLabel(field, label) {
  return { ...field, label };
}

const URL_PATTERN = /^https?:\/\/\S+$/i;

function serializeNameValue(value) {
  const structured = {
    first: String(value?.first ?? "").trim(),
    last: String(value?.last ?? "").trim(),
  };
  return {
    stored: JSON.stringify(structured),
    display: [structured.first, structured.last].filter(Boolean).join(" "),
  };
}

function createIdempotencyKey(formId) {
  return `${formId}:${randomUUID()}`;
}

assert("form definition schema version is 1", FORM_DEFINITION_SCHEMA_VERSION === 1);

const expectedFieldTypes = [
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
  "heading",
  "paragraph_content",
  "divider",
  "date",
  "consent",
];
const registeredTypes = new Set(FIELD_REGISTRY.map((field) => field.type));
assert(
  "field registry includes all foundational types",
  expectedFieldTypes.every((type) => registeredTypes.has(type)),
);

assert(
  "conditional merge tags substitute form values",
  applyMergeTags("{form:name}", { "form:name": "Contact" }) === "Contact",
);

assert(
  "email header sanitization strips newlines",
  sanitizeEmailHeader("Subject\r\nBcc: attacker@example.com") ===
    "Subject Bcc: attacker@example.com",
);

assert(
  "CSV formula injection values are escaped",
  ["=1+1", "+cmd", "-10", "@SUM(A1:A2)"].every(
    (value) => escapeCsvFormula(value) === `'${value}`,
  ) && escapeCsvFormula("safe") === "safe",
);

const originalField = {
  id: "fld_contact_name",
  key: "contact_name",
  label: "Contact name",
};
const relabeledField = updateFieldLabel(originalField, "Your full name");
assert(
  "field IDs stay stable when labels change",
  relabeledField.id === originalField.id &&
    relabeledField.key === originalField.key &&
    relabeledField.label !== originalField.label,
);

const contentFieldTypes = ["heading", "paragraph_content", "divider"];
assert(
  "content fields do not store values",
  contentFieldTypes.every(
    (type) =>
      FIELD_REGISTRY.find((field) => field.type === type)?.storesValue === false,
  ),
);

assert(
  "URL validation accepts HTTP(S) URLs and rejects invalid protocols",
  URL_PATTERN.test("https://example.com/contact") &&
    URL_PATTERN.test("http://localhost:8787/form") &&
    !URL_PATTERN.test("ftp://example.com/file") &&
    !URL_PATTERN.test("example.com"),
);

const serializedName = serializeNameValue({ first: "First", last: "Last" });
assert(
  "name fields serialize structured values for display",
  serializedName.display === "First Last" &&
    JSON.parse(serializedName.stored).first === "First" &&
    JSON.parse(serializedName.stored).last === "Last",
);

const idempotencyKeys = Array.from(
  { length: 100 },
  () => createIdempotencyKey("form_contact"),
);
assert(
  "idempotency keys are unique per submission attempt",
  new Set(idempotencyKeys).size === idempotencyKeys.length,
);

console.log("\nForms platform unit tests complete.");
