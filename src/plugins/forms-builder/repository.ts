import { generateId } from "../../lib/crypto";
import {
  removeContentIndexEntry,
  syncFormToContentIndex,
} from "../../content-index/repository";
import { registerPluginResource } from "../../plugins/resources";
import {
  FIELD_TYPES,
  FORM_STATUSES,
  parseFieldOptions,
  parseFieldValidation,
  parseFormSettings,
  type FieldType,
  type FormFieldRecord,
  type FormRecord,
  type FormSettings,
  type FormStatus,
  type FormSubmissionRecord,
  type FormSubmissionValueRecord,
  type FormWithFields,
  type SubmissionStatus,
} from "./types";

export class ValidationError extends Error {
  constructor(public readonly errors: Record<string, string>) {
    super("Validation failed");
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
  }
}

const FORM_COLUMNS = `
  id, slug, title, description, status, settings_json, created_by, created_at, updated_at
`;

const FIELD_COLUMNS = `
  id, form_id, field_key, label, field_type, placeholder, help_text, required,
  sort_order, options_json, validation_json, settings_json, created_at, updated_at
`;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeStatus(value: string | undefined, fallback: FormStatus = "draft"): FormStatus {
  if (value && FORM_STATUSES.includes(value as FormStatus)) {
    return value as FormStatus;
  }
  return fallback;
}

function normalizeFieldType(value: string): FieldType {
  if (FIELD_TYPES.includes(value as FieldType)) {
    return value as FieldType;
  }
  return "text";
}

export async function listForms(
  db: D1Database,
  options: { q?: string; status?: string; limit?: number; offset?: number } = {},
): Promise<{ items: FormRecord[]; count: number }> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.q?.trim()) {
    conditions.push("(title LIKE ? OR slug LIKE ? OR description LIKE ?)");
    const term = `%${options.q.trim()}%`;
    params.push(term, term, term);
  }

  if (options.status?.trim()) {
    conditions.push("status = ?");
    params.push(options.status.trim());
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db
    .prepare(`SELECT COUNT(*) AS count FROM forms ${where}`)
    .bind(...params)
    .first<{ count: number }>();

  const result = await db
    .prepare(
      `
        SELECT ${FORM_COLUMNS}
        FROM forms
        ${where}
        ORDER BY updated_at DESC, created_at DESC
        LIMIT ? OFFSET ?
      `,
    )
    .bind(...params, limit, offset)
    .all<FormRecord>();

  return { items: result.results ?? [], count: countResult?.count ?? 0 };
}

export async function getFormById(db: D1Database, id: string): Promise<FormRecord | null> {
  return db.prepare(`SELECT ${FORM_COLUMNS} FROM forms WHERE id = ?`).bind(id).first<FormRecord>();
}

export async function getFormBySlug(db: D1Database, slug: string): Promise<FormRecord | null> {
  return db
    .prepare(`SELECT ${FORM_COLUMNS} FROM forms WHERE slug = ?`)
    .bind(slug)
    .first<FormRecord>();
}

export async function listFormFields(db: D1Database, formId: string): Promise<FormFieldRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT ${FIELD_COLUMNS}
        FROM form_fields
        WHERE form_id = ?
        ORDER BY sort_order ASC, created_at ASC
      `,
    )
    .bind(formId)
    .all<FormFieldRecord>();

  return result.results ?? [];
}

export async function getFormWithFields(
  db: D1Database,
  idOrSlug: { id?: string; slug?: string },
  activeOnly = false,
): Promise<FormWithFields | null> {
  const form = idOrSlug.id
    ? await getFormById(db, idOrSlug.id)
    : idOrSlug.slug
      ? await getFormBySlug(db, idOrSlug.slug)
      : null;

  if (!form) return null;
  if (activeOnly && form.status !== "active") return null;

  const fields = await listFormFields(db, form.id);

  return {
    ...form,
    fields,
    settings: parseFormSettings(form.settings_json),
  };
}

export async function createForm(
  db: D1Database,
  input: {
    title: string;
    slug?: string;
    description?: string | null;
    status?: string;
    settings?: FormSettings;
  },
  createdBy: string | null,
): Promise<FormWithFields> {
  const title = input.title?.trim();
  if (!title) {
    throw new ValidationError({ title: "Title is required" });
  }

  const slug = slugify(input.slug?.trim() || title);
  if (!slug) {
    throw new ValidationError({ slug: "Slug is required" });
  }

  const existing = await getFormBySlug(db, slug);
  if (existing) {
    throw new ValidationError({ slug: "Slug already exists" });
  }

  const id = generateId("frm");
  const now = new Date().toISOString();
  const settings = input.settings ?? parseFormSettings(null);

  await db
    .prepare(
      `
        INSERT INTO forms (
          id, slug, title, description, status, settings_json, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      id,
      slug,
      title,
      input.description?.trim() || null,
      normalizeStatus(input.status, "draft"),
      JSON.stringify(settings),
      createdBy,
      now,
      now,
    )
    .run();

  const created = await getFormWithFields(db, { id });
  if (!created) throw new Error("Failed to create form");

  await syncFormToContentIndex(db, created);
  await registerPluginResource(db, "forms-builder", {
    resource_type: "entity",
    resource_name: "form",
    table_name: "forms",
    entity_id: id,
    ownership_type: "owns",
    cleanup_policy: "retain",
  });

  return created;
}

export async function updateForm(
  db: D1Database,
  id: string,
  input: {
    title?: string;
    slug?: string;
    description?: string | null;
    status?: string;
    settings?: FormSettings;
  },
): Promise<FormWithFields> {
  const existing = await getFormById(db, id);
  if (!existing) throw new NotFoundError();

  const slug = input.slug !== undefined ? slugify(input.slug.trim()) : existing.slug;
  if (!slug) {
    throw new ValidationError({ slug: "Slug is required" });
  }

  if (slug !== existing.slug) {
    const conflict = await getFormBySlug(db, slug);
    if (conflict && conflict.id !== id) {
      throw new ValidationError({ slug: "Slug already exists" });
    }
  }

  const settings =
    input.settings !== undefined
      ? input.settings
      : parseFormSettings(existing.settings_json);

  await db
    .prepare(
      `
        UPDATE forms SET
          slug = ?,
          title = ?,
          description = ?,
          status = ?,
          settings_json = ?,
          updated_at = ?
        WHERE id = ?
      `,
    )
    .bind(
      slug,
      input.title?.trim() || existing.title,
      input.description !== undefined ? input.description?.trim() || null : existing.description,
      input.status !== undefined ? normalizeStatus(input.status, existing.status) : existing.status,
      JSON.stringify(settings),
      new Date().toISOString(),
      id,
    )
    .run();

  const updated = await getFormWithFields(db, { id });
  if (!updated) throw new NotFoundError();

  await syncFormToContentIndex(db, updated);
  return updated;
}

export async function deleteForm(db: D1Database, id: string): Promise<void> {
  const existing = await getFormById(db, id);
  if (!existing) throw new NotFoundError();
  await db.prepare("DELETE FROM forms WHERE id = ?").bind(id).run();
  await removeContentIndexEntry(db, "form", id);
}

export async function createFormField(
  db: D1Database,
  formId: string,
  input: {
    field_key?: string;
    label: string;
    field_type: string;
    placeholder?: string | null;
    help_text?: string | null;
    required?: boolean;
    sort_order?: number;
    options?: { choices?: Array<{ label: string; value: string }> };
    validation?: Record<string, unknown>;
  },
): Promise<FormFieldRecord> {
  const form = await getFormById(db, formId);
  if (!form) throw new NotFoundError();

  const label = input.label?.trim();
  if (!label) {
    throw new ValidationError({ label: "Label is required" });
  }

  const fieldKey = slugify(input.field_key?.trim() || label).replace(/-/g, "_");
  if (!fieldKey) {
    throw new ValidationError({ field_key: "Field key is required" });
  }

  const id = generateId("fld");
  const fields = await listFormFields(db, formId);
  const sortOrder = input.sort_order ?? fields.length;

  try {
    await db
      .prepare(
        `
          INSERT INTO form_fields (
            id, form_id, field_key, label, field_type, placeholder, help_text, required,
            sort_order, options_json, validation_json, settings_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        id,
        formId,
        fieldKey,
        label,
        normalizeFieldType(input.field_type),
        input.placeholder?.trim() || null,
        input.help_text?.trim() || null,
        input.required ? 1 : 0,
        sortOrder,
        input.options ? JSON.stringify(input.options) : null,
        input.validation ? JSON.stringify(input.validation) : null,
        null,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
  } catch {
    throw new ValidationError({ field_key: "Field key must be unique within the form" });
  }

  const created = await db
    .prepare(`SELECT ${FIELD_COLUMNS} FROM form_fields WHERE id = ?`)
    .bind(id)
    .first<FormFieldRecord>();

  if (!created) throw new Error("Failed to create field");
  return created;
}

export async function updateFormField(
  db: D1Database,
  formId: string,
  fieldId: string,
  input: {
    field_key?: string;
    label?: string;
    field_type?: string;
    placeholder?: string | null;
    help_text?: string | null;
    required?: boolean;
    sort_order?: number;
    options?: { choices?: Array<{ label: string; value: string }> };
    validation?: Record<string, unknown>;
  },
): Promise<FormFieldRecord> {
  const existing = await db
    .prepare(`SELECT ${FIELD_COLUMNS} FROM form_fields WHERE id = ? AND form_id = ?`)
    .bind(fieldId, formId)
    .first<FormFieldRecord>();

  if (!existing) throw new NotFoundError();

  const fieldKey =
    input.field_key !== undefined
      ? slugify(input.field_key.trim()).replace(/-/g, "_")
      : existing.field_key;

  await db
    .prepare(
      `
        UPDATE form_fields SET
          field_key = ?,
          label = ?,
          field_type = ?,
          placeholder = ?,
          help_text = ?,
          required = ?,
          sort_order = ?,
          options_json = ?,
          validation_json = ?,
          updated_at = ?
        WHERE id = ? AND form_id = ?
      `,
    )
    .bind(
      fieldKey,
      input.label?.trim() || existing.label,
      input.field_type ? normalizeFieldType(input.field_type) : existing.field_type,
      input.placeholder !== undefined ? input.placeholder?.trim() || null : existing.placeholder,
      input.help_text !== undefined ? input.help_text?.trim() || null : existing.help_text,
      input.required !== undefined ? (input.required ? 1 : 0) : existing.required,
      input.sort_order ?? existing.sort_order,
      input.options !== undefined ? JSON.stringify(input.options) : existing.options_json,
      input.validation !== undefined ? JSON.stringify(input.validation) : existing.validation_json,
      new Date().toISOString(),
      fieldId,
      formId,
    )
    .run();

  const updated = await db
    .prepare(`SELECT ${FIELD_COLUMNS} FROM form_fields WHERE id = ?`)
    .bind(fieldId)
    .first<FormFieldRecord>();

  if (!updated) throw new NotFoundError();
  return updated;
}

export async function deleteFormField(
  db: D1Database,
  formId: string,
  fieldId: string,
): Promise<void> {
  const result = await db
    .prepare("DELETE FROM form_fields WHERE id = ? AND form_id = ?")
    .bind(fieldId, formId)
    .run();

  if (!result.meta.changes) {
    throw new NotFoundError();
  }
}

export async function reorderFormFields(
  db: D1Database,
  formId: string,
  fieldIds: string[],
): Promise<FormFieldRecord[]> {
  const statements = fieldIds.map((fieldId, index) =>
    db
      .prepare(
        "UPDATE form_fields SET sort_order = ?, updated_at = ? WHERE id = ? AND form_id = ?",
      )
      .bind(index, new Date().toISOString(), fieldId, formId),
  );

  if (statements.length) {
    await db.batch(statements);
  }

  return listFormFields(db, formId);
}

export async function listFormSubmissions(
  db: D1Database,
  formId: string,
  options: { status?: string; limit?: number; offset?: number } = {},
): Promise<{ items: FormSubmissionRecord[]; count: number }> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const params: unknown[] = [formId];
  let extra = "";

  if (options.status?.trim()) {
    extra = " AND status = ?";
    params.push(options.status.trim());
  }

  const countResult = await db
    .prepare(`SELECT COUNT(*) AS count FROM form_submissions WHERE form_id = ?${extra}`)
    .bind(...params)
    .first<{ count: number }>();

  const result = await db
    .prepare(
      `
        SELECT id, form_id, status, ip_hash, user_agent, turnstile_verified, metadata_json, created_at
        FROM form_submissions
        WHERE form_id = ?${extra}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
    )
    .bind(...params, limit, offset)
    .all<FormSubmissionRecord>();

  return { items: result.results ?? [], count: countResult?.count ?? 0 };
}

export async function getSubmissionWithValues(
  db: D1Database,
  submissionId: string,
): Promise<{
  submission: FormSubmissionRecord;
  values: FormSubmissionValueRecord[];
  form: FormRecord | null;
} | null> {
  const submission = await db
    .prepare(
      `
        SELECT id, form_id, status, ip_hash, user_agent, turnstile_verified, metadata_json, created_at
        FROM form_submissions
        WHERE id = ?
      `,
    )
    .bind(submissionId)
    .first<FormSubmissionRecord>();

  if (!submission) return null;

  const values = await db
    .prepare(
      `
        SELECT id, submission_id, field_id, field_key, value, created_at
        FROM form_submission_values
        WHERE submission_id = ?
        ORDER BY created_at ASC
      `,
    )
    .bind(submissionId)
    .all<FormSubmissionValueRecord>();

  const form = await getFormById(db, submission.form_id);

  return {
    submission,
    values: values.results ?? [],
    form,
  };
}

export async function updateSubmissionStatus(
  db: D1Database,
  submissionId: string,
  status: string,
): Promise<FormSubmissionRecord> {
  const normalized = ["new", "read", "spam", "archived"].includes(status)
    ? (status as SubmissionStatus)
    : "read";

  const existing = await db
    .prepare(
      "SELECT id, form_id, status, ip_hash, user_agent, turnstile_verified, metadata_json, created_at FROM form_submissions WHERE id = ?",
    )
    .bind(submissionId)
    .first<FormSubmissionRecord>();

  if (!existing) throw new NotFoundError();

  await db
    .prepare("UPDATE form_submissions SET status = ? WHERE id = ?")
    .bind(normalized, submissionId)
    .run();

  return { ...existing, status: normalized };
}

export async function deleteSubmission(db: D1Database, submissionId: string): Promise<void> {
  const result = await db
    .prepare("DELETE FROM form_submissions WHERE id = ?")
    .bind(submissionId)
    .run();

  if (!result.meta.changes) {
    throw new NotFoundError();
  }
}

export async function createSubmission(
  db: D1Database,
  formId: string,
  input: {
    values: Record<string, unknown>;
    ipHash: string | null;
    userAgent: string | null;
    turnstileVerified: boolean;
    metadata?: Record<string, unknown>;
    status?: SubmissionStatus;
  },
  fields: FormFieldRecord[],
): Promise<{ submissionId: string }> {
  const submissionId = generateId("sub");
  const now = new Date().toISOString();

  await db
    .prepare(
      `
        INSERT INTO form_submissions (
          id, form_id, status, ip_hash, user_agent, turnstile_verified, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      submissionId,
      formId,
      input.status ?? "new",
      input.ipHash,
      input.userAgent,
      input.turnstileVerified ? 1 : 0,
      input.metadata ? JSON.stringify(input.metadata) : null,
      now,
    )
    .run();

  const valueStatements = fields.map((field) => {
    const raw = input.values[field.field_key];
    let value: string | null = null;

    if (Array.isArray(raw)) {
      value = raw.map(String).join(", ");
    } else if (raw !== undefined && raw !== null) {
      value = String(raw);
    }

    return db
      .prepare(
        `
          INSERT INTO form_submission_values (
            id, submission_id, field_id, field_key, value, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(generateId("fsv"), submissionId, field.id, field.field_key, value, now);
  });

  if (valueStatements.length) {
    await db.batch(valueStatements);
  }

  return { submissionId };
}

export function serializePublicForm(form: FormWithFields) {
  return {
    id: form.id,
    slug: form.slug,
    title: form.title,
    description: form.description,
    settings: {
      success_message: form.settings.success_message,
      submit_label: form.settings.submit_label,
      turnstile_enabled: form.settings.turnstile_enabled ?? false,
      turnstile_site_key: form.settings.turnstile_site_key ?? null,
    },
    fields: form.fields.map((field) => ({
      id: field.id,
      key: field.field_key,
      label: field.label,
      type: field.field_type,
      placeholder: field.placeholder,
      help_text: field.help_text,
      required: field.required === 1,
      options: parseFieldOptions(field.options_json),
      validation: parseFieldValidation(field.validation_json),
    })),
  };
}

export async function readJsonBody<T = Record<string, unknown>>(
  request: Request,
): Promise<T> {
  return (await request.json()) as T;
}
