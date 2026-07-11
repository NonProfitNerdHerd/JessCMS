import { generateId } from "../../lib/crypto";
import {
  removeContentIndexEntry,
  syncFormToContentIndex,
} from "../../content-index/repository";
import { registerPluginResource } from "../../plugins/resources";
import {
  definitionFromFields,
  definitionToFieldRows,
  emptyDefinition,
  ensureDefinitionSynced,
  flattenDefinitionFields,
  parseDefinition,
  type FormDefinition,
} from "./definition";
import { createDefaultFieldProps, getFieldTypeDefinition, isValidFieldType } from "./field-registry";
import { defaultConfirmations, defaultNotifications, recordSubmissionEvent } from "./notifications";
import { normalizeSubmissionValue } from "./validation";
import {
  FIELD_TYPES,
  FORM_STATUSES,
  parseFieldOptions,
  parseFieldSettings,
  parseFieldValidation,
  parseFormSettings,
  type FieldType,
  type FormFieldRecord,
  type FormRecord,
  type FormSettings,
  type FormStatus,
  type FormSubmissionRecord,
  type FormSubmissionValueRecord,
  type FormVersionRecord,
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

export class ConflictError extends Error {
  constructor(message = "Conflict") {
    super(message);
  }
}

const FORM_COLUMNS = `
  id, slug, title, description, status, settings_json,
  draft_definition_json, published_definition_json, draft_version, published_version,
  schema_version, submission_count, last_submission_at, published_at, archived_at,
  created_by, updated_by, created_at, updated_at
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
  if (FIELD_TYPES.includes(value as FieldType) || isValidFieldType(value)) {
    return value as FieldType;
  }
  return "text";
}

function mergeDefaultSettings(settings?: FormSettings | null): FormSettings {
  const base = parseFormSettings(null);
  return {
    ...base,
    ...(settings ?? {}),
    notifications: settings?.notifications ?? defaultNotifications(),
    confirmations: settings?.confirmations ?? defaultConfirmations(),
  };
}

async function hydrateForm(db: D1Database, form: FormRecord): Promise<FormWithFields> {
  const fields = await listFormFields(db, form.id);
  const settings = parseFormSettings(form.settings_json);
  const definition = ensureDefinitionSynced(
    form.id,
    fields,
    form.settings_json,
    form.draft_definition_json ?? null,
  );

  return {
    ...form,
    fields,
    settings: {
      ...settings,
      ...definition.settings,
    },
    definition,
  };
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

  return hydrateForm(db, form);
}

export async function createForm(
  db: D1Database,
  input: {
    title: string;
    slug?: string;
    description?: string | null;
    status?: string;
    settings?: FormSettings;
    template?: string;
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
  const settings = mergeDefaultSettings(input.settings);
  const definition = buildTemplateDefinition(id, title, input.template, settings);

  await db
    .prepare(
      `
        INSERT INTO forms (
          id, slug, title, description, status, settings_json,
          draft_definition_json, draft_version, schema_version,
          created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)
      `,
    )
    .bind(
      id,
      slug,
      title,
      input.description?.trim() || null,
      normalizeStatus(input.status, "draft"),
      JSON.stringify(settings),
      JSON.stringify(definition),
      createdBy,
      createdBy,
      now,
      now,
    )
    .run();

  await replaceFormFieldsFromDefinition(db, id, definition);

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

function buildTemplateDefinition(
  formId: string,
  title: string,
  template: string | undefined,
  settings: FormSettings,
): FormDefinition {
  const def = emptyDefinition(formId);
  def.settings = { ...def.settings, ...settings };
  def.pages[0].title = title;

  const add = (type: string, label: string, required = false, extra: Partial<import("./definition").FormDefinitionField> = {}) => {
    const defaults = createDefaultFieldProps(type);
    def.pages[0].fields.push({
      id: generateId("fld"),
      key: slugify(label).replace(/-/g, "_") || type,
      type,
      version: 1,
      label,
      required,
      width: "100",
      options: defaults.options,
      validation: defaults.validation,
      settings: defaults.settings,
      conditions: [],
      ...extra,
    });
  };

  switch (template) {
    case "contact":
      add("name", "Name", true);
      add("email", "Email", true);
      add("textarea", "Message", true);
      break;
    case "newsletter":
      add("email", "Email", true);
      add("text", "First name");
      break;
    case "feedback":
      add("name", "Name");
      add("email", "Email");
      add("select", "Rating", true, {
        options: {
          choices: [
            { label: "Excellent", value: "5" },
            { label: "Good", value: "4" },
            { label: "Average", value: "3" },
            { label: "Poor", value: "2" },
          ],
        },
      });
      add("textarea", "Comments");
      break;
    case "support":
      add("name", "Name", true);
      add("email", "Email", true);
      add("text", "Subject", true);
      add("textarea", "Description", true);
      break;
    case "blank":
    default:
      break;
  }

  return def;
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
  updatedBy?: string | null,
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
      ? mergeDefaultSettings(input.settings)
      : parseFormSettings(existing.settings_json);

  const status =
    input.status !== undefined ? normalizeStatus(input.status, existing.status) : existing.status;
  const archivedAt =
    status === "archived" ? existing.archived_at || new Date().toISOString() : null;

  let draftDefinition = existing.draft_definition_json;
  if (input.settings !== undefined || input.title !== undefined) {
    const def = ensureDefinitionSynced(
      id,
      await listFormFields(db, id),
      existing.settings_json,
      existing.draft_definition_json ?? null,
    );
    def.settings = { ...def.settings, ...settings };
    draftDefinition = JSON.stringify(def);
  }

  await db
    .prepare(
      `
        UPDATE forms SET
          slug = ?,
          title = ?,
          description = ?,
          status = ?,
          settings_json = ?,
          draft_definition_json = ?,
          archived_at = ?,
          updated_by = ?,
          updated_at = ?
        WHERE id = ?
      `,
    )
    .bind(
      slug,
      input.title?.trim() || existing.title,
      input.description !== undefined ? input.description?.trim() || null : existing.description,
      status,
      JSON.stringify(settings),
      draftDefinition,
      archivedAt,
      updatedBy ?? existing.updated_by ?? null,
      new Date().toISOString(),
      id,
    )
    .run();

  const updated = await getFormWithFields(db, { id });
  if (!updated) throw new NotFoundError();

  await syncFormToContentIndex(db, updated);
  return updated;
}

export async function saveFormDraft(
  db: D1Database,
  id: string,
  input: {
    definition: FormDefinition;
    title?: string;
    slug?: string;
    description?: string | null;
    expected_draft_version?: number;
    change_note?: string;
  },
  updatedBy: string | null,
): Promise<FormWithFields> {
  const existing = await getFormById(db, id);
  if (!existing) throw new NotFoundError();

  if (
    input.expected_draft_version !== undefined &&
    Number(existing.draft_version ?? 1) !== Number(input.expected_draft_version)
  ) {
    throw new ConflictError("Draft was updated by another editor. Reload and try again.");
  }

  const slug =
    input.slug !== undefined ? slugify(input.slug.trim()) : existing.slug;
  if (!slug) throw new ValidationError({ slug: "Slug is required" });
  if (slug !== existing.slug) {
    const conflict = await getFormBySlug(db, slug);
    if (conflict && conflict.id !== id) {
      throw new ValidationError({ slug: "Slug already exists" });
    }
  }

  const definition = parseDefinition(JSON.stringify(input.definition), id);
  definition.formId = id;
  const settings = mergeDefaultSettings(definition.settings);
  definition.settings = settings;
  const nextVersion = Number(existing.draft_version ?? 1) + 1;
  const now = new Date().toISOString();

  await replaceFormFieldsFromDefinition(db, id, definition);

  await db
    .prepare(
      `
        UPDATE forms SET
          title = ?,
          slug = ?,
          description = ?,
          settings_json = ?,
          draft_definition_json = ?,
          draft_version = ?,
          schema_version = ?,
          updated_by = ?,
          updated_at = ?
        WHERE id = ?
      `,
    )
    .bind(
      input.title?.trim() || existing.title,
      slug,
      input.description !== undefined
        ? input.description?.trim() || null
        : existing.description,
      JSON.stringify(settings),
      JSON.stringify(definition),
      nextVersion,
      definition.schemaVersion,
      updatedBy,
      now,
      id,
    )
    .run();

  await db
    .prepare(
      `
        INSERT INTO form_versions (
          id, form_id, version_number, definition_json, schema_version,
          change_note, is_published, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
      `,
    )
    .bind(
      generateId("fver"),
      id,
      nextVersion,
      JSON.stringify(definition),
      definition.schemaVersion,
      input.change_note ?? "Draft save",
      updatedBy,
      now,
    )
    .run();

  const updated = await getFormWithFields(db, { id });
  if (!updated) throw new NotFoundError();
  await syncFormToContentIndex(db, updated);
  return updated;
}

export async function publishForm(
  db: D1Database,
  id: string,
  updatedBy: string | null,
  changeNote?: string,
): Promise<FormWithFields> {
  const existing = await getFormWithFields(db, { id });
  if (!existing) throw new NotFoundError();

  const definition =
    existing.definition ??
    definitionFromFields(id, existing.fields, existing.settings);
  const publishedVersion = Number(existing.draft_version ?? 1);
  const now = new Date().toISOString();

  const existingVersion = await db
    .prepare(
      `SELECT id FROM form_versions WHERE form_id = ? AND version_number = ? LIMIT 1`,
    )
    .bind(id, publishedVersion)
    .first<{ id: string }>();

  if (existingVersion) {
    await db
      .prepare(
        `
          UPDATE form_versions SET
            definition_json = ?,
            schema_version = ?,
            change_note = ?,
            is_published = 1,
            created_by = COALESCE(created_by, ?)
          WHERE id = ?
        `,
      )
      .bind(
        JSON.stringify(definition),
        definition.schemaVersion,
        changeNote ?? "Published",
        updatedBy,
        existingVersion.id,
      )
      .run();
  } else {
    await db
      .prepare(
        `
          INSERT INTO form_versions (
            id, form_id, version_number, definition_json, schema_version,
            change_note, is_published, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        `,
      )
      .bind(
        generateId("fver"),
        id,
        publishedVersion,
        JSON.stringify(definition),
        definition.schemaVersion,
        changeNote ?? "Published",
        updatedBy,
        now,
      )
      .run();
  }

  await db
    .prepare(
      `
        UPDATE form_versions
        SET is_published = 0
        WHERE form_id = ? AND version_number != ? AND is_published = 1
      `,
    )
    .bind(id, publishedVersion)
    .run();

  await db
    .prepare(
      `
        UPDATE forms SET
          status = 'active',
          published_definition_json = ?,
          published_version = ?,
          published_at = ?,
          archived_at = NULL,
          updated_by = ?,
          updated_at = ?
        WHERE id = ?
      `,
    )
    .bind(JSON.stringify(definition), publishedVersion, now, updatedBy, now, id)
    .run();

  const updated = await getFormWithFields(db, { id });
  if (!updated) throw new NotFoundError();
  await syncFormToContentIndex(db, updated);
  return updated;
}

export async function duplicateForm(
  db: D1Database,
  id: string,
  createdBy: string | null,
): Promise<FormWithFields> {
  const source = await getFormWithFields(db, { id });
  if (!source) throw new NotFoundError();

  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let attempt = 1;
  while (await getFormBySlug(db, slug)) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const definition = parseDefinition(JSON.stringify(source.definition), undefined);
  const idMap = new Map<string, string>();
  for (const field of flattenDefinitionFields(definition)) {
    const newId = generateId("fld");
    idMap.set(field.id, newId);
    field.id = newId;
    field.key = `${field.key}_${attempt}`.slice(0, 40);
  }

  const created = await createForm(
    db,
    {
      title: `${source.title} (Copy)`,
      slug,
      description: source.description,
      status: "draft",
      settings: {
        ...source.settings,
        notifications: (source.settings.notifications ?? []).map((n) => ({
          ...n,
          enabled: false,
        })),
      },
    },
    createdBy,
  );

  definition.formId = created.id;
  await saveFormDraft(
    db,
    created.id,
    {
      definition,
      title: `${source.title} (Copy)`,
      slug,
      description: source.description,
      change_note: `Duplicated from ${source.id}`,
    },
    createdBy,
  );

  return (await getFormWithFields(db, { id: created.id }))!;
}

export async function listFormVersions(
  db: D1Database,
  formId: string,
): Promise<FormVersionRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT id, form_id, version_number, definition_json, schema_version,
               change_note, is_published, created_by, created_at
        FROM form_versions
        WHERE form_id = ?
        ORDER BY version_number DESC
      `,
    )
    .bind(formId)
    .all<FormVersionRecord>();
  return result.results ?? [];
}

export async function restoreFormVersion(
  db: D1Database,
  formId: string,
  versionId: string,
  updatedBy: string | null,
): Promise<FormWithFields> {
  const version = await db
    .prepare(
      `
        SELECT id, form_id, version_number, definition_json, schema_version,
               change_note, is_published, created_by, created_at
        FROM form_versions
        WHERE id = ? AND form_id = ?
      `,
    )
    .bind(versionId, formId)
    .first<FormVersionRecord>();

  if (!version) throw new NotFoundError("Version not found");

  const definition = parseDefinition(version.definition_json, formId);
  return saveFormDraft(
    db,
    formId,
    {
      definition,
      change_note: `Restored version ${version.version_number}`,
    },
    updatedBy,
  );
}

async function replaceFormFieldsFromDefinition(
  db: D1Database,
  formId: string,
  definition: FormDefinition,
): Promise<void> {
  const rows = definitionToFieldRows(formId, definition);
  await db.prepare("DELETE FROM form_fields WHERE form_id = ?").bind(formId).run();

  if (!rows.length) return;

  const statements = rows.map((row) =>
    db
      .prepare(
        `
          INSERT INTO form_fields (
            id, form_id, field_key, label, field_type, placeholder, help_text, required,
            sort_order, options_json, validation_json, settings_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        row.id,
        row.form_id,
        row.field_key,
        row.label,
        normalizeFieldType(row.field_type),
        row.placeholder,
        row.help_text,
        row.required,
        row.sort_order,
        row.options_json,
        row.validation_json,
        row.settings_json,
        new Date().toISOString(),
        new Date().toISOString(),
      ),
  );

  await db.batch(statements);
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
    settings?: Record<string, unknown>;
  },
): Promise<FormFieldRecord> {
  const form = await getFormWithFields(db, { id: formId });
  if (!form) throw new NotFoundError();

  const defaults = createDefaultFieldProps(input.field_type);
  const label = input.label?.trim() || defaults.label;
  const fieldKey = slugify(input.field_key?.trim() || label).replace(/-/g, "_");
  if (!fieldKey) {
    throw new ValidationError({ field_key: "Field key is required" });
  }

  const definition = form.definition ?? emptyDefinition(formId);
  definition.pages[0].fields.push({
    id: generateId("fld"),
    key: fieldKey,
    type: normalizeFieldType(input.field_type),
    version: 1,
    label,
    description: input.help_text ?? undefined,
    placeholder: input.placeholder ?? undefined,
    required: Boolean(input.required),
    width: "100",
    options: input.options ?? defaults.options,
    validation: input.validation ?? defaults.validation,
    settings: input.settings ?? defaults.settings,
    conditions: [],
  });

  await saveFormDraft(db, formId, { definition }, form.updated_by ?? null);
  const fields = await listFormFields(db, formId);
  const created = fields.find((field) => field.field_key === fieldKey);
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
    settings?: Record<string, unknown>;
  },
): Promise<FormFieldRecord> {
  const form = await getFormWithFields(db, { id: formId });
  if (!form?.definition) throw new NotFoundError();

  let found = false;
  for (const page of form.definition.pages) {
    const field = page.fields.find((item) => item.id === fieldId);
    if (!field) continue;
    found = true;
    if (input.label !== undefined) field.label = input.label.trim() || field.label;
    if (input.field_key !== undefined) {
      field.key = slugify(input.field_key.trim()).replace(/-/g, "_") || field.key;
    }
    if (input.field_type !== undefined) field.type = normalizeFieldType(input.field_type);
    if (input.placeholder !== undefined) field.placeholder = input.placeholder ?? undefined;
    if (input.help_text !== undefined) field.description = input.help_text ?? undefined;
    if (input.required !== undefined) field.required = Boolean(input.required);
    if (input.options !== undefined) field.options = input.options;
    if (input.validation !== undefined) field.validation = input.validation;
    if (input.settings !== undefined) field.settings = input.settings;
  }

  if (!found) throw new NotFoundError();

  if (input.sort_order !== undefined) {
    const all = flattenDefinitionFields(form.definition);
    const current = all.find((item) => item.id === fieldId);
    if (current) {
      const without = all.filter((item) => item.id !== fieldId);
      without.splice(input.sort_order, 0, current);
      form.definition.pages = [
        {
          ...form.definition.pages[0],
          fields: without,
        },
      ];
    }
  }

  await saveFormDraft(db, formId, { definition: form.definition }, form.updated_by ?? null);
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
  const form = await getFormWithFields(db, { id: formId });
  if (!form?.definition) throw new NotFoundError();

  let removed = false;
  for (const page of form.definition.pages) {
    const before = page.fields.length;
    page.fields = page.fields.filter((field) => field.id !== fieldId);
    if (page.fields.length !== before) removed = true;
  }
  if (!removed) throw new NotFoundError();

  await saveFormDraft(db, formId, { definition: form.definition }, form.updated_by ?? null);
}

export async function reorderFormFields(
  db: D1Database,
  formId: string,
  fieldIds: string[],
): Promise<FormFieldRecord[]> {
  const form = await getFormWithFields(db, { id: formId });
  if (!form?.definition) throw new NotFoundError();

  const map = new Map(
    flattenDefinitionFields(form.definition).map((field) => [field.id, field]),
  );
  const ordered = fieldIds.map((id) => map.get(id)).filter(Boolean) as typeof form.definition.pages[0]["fields"];
  for (const field of map.values()) {
    if (!fieldIds.includes(field.id)) ordered.push(field);
  }
  form.definition.pages[0].fields = ordered;
  await saveFormDraft(db, formId, { definition: form.definition }, form.updated_by ?? null);
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
        SELECT id, form_id, status, ip_hash, user_agent, turnstile_verified, metadata_json, created_at,
               form_version_id, sequence_number, updated_at, referrer, page_url, user_id,
               spam_score, spam_reason, idempotency_key, completion_ms
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
        SELECT id, form_id, status, ip_hash, user_agent, turnstile_verified, metadata_json, created_at,
               form_version_id, sequence_number, updated_at, referrer, page_url, user_id,
               spam_score, spam_reason, idempotency_key, completion_ms
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
      `SELECT id, form_id, status, ip_hash, user_agent, turnstile_verified, metadata_json, created_at,
              form_version_id, sequence_number, updated_at, referrer, page_url, user_id,
              spam_score, spam_reason, idempotency_key, completion_ms
       FROM form_submissions WHERE id = ?`,
    )
    .bind(submissionId)
    .first<FormSubmissionRecord>();

  if (!existing) throw new NotFoundError();

  await db
    .prepare("UPDATE form_submissions SET status = ?, updated_at = ? WHERE id = ?")
    .bind(normalized, new Date().toISOString(), submissionId)
    .run();

  await recordSubmissionEvent(db, {
    submissionId,
    formId: existing.form_id,
    eventType: "status_changed",
    message: `Status changed to ${normalized}`,
  });

  return { ...existing, status: normalized };
}

export async function deleteSubmission(db: D1Database, submissionId: string): Promise<void> {
  const existing = await db
    .prepare("SELECT id, form_id FROM form_submissions WHERE id = ?")
    .bind(submissionId)
    .first<{ id: string; form_id: string }>();

  if (!existing) throw new NotFoundError();

  await recordSubmissionEvent(db, {
    submissionId,
    formId: existing.form_id,
    eventType: "deleted",
    message: "Submission deleted",
  });

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
    formVersionId?: string | null;
    referrer?: string | null;
    pageUrl?: string | null;
    userId?: string | null;
    spamScore?: number | null;
    spamReason?: string | null;
    idempotencyKey?: string | null;
    completionMs?: number | null;
  },
  fields: FormFieldRecord[],
): Promise<{ submissionId: string; sequenceNumber: number }> {
  if (input.idempotencyKey) {
    const existing = await db
      .prepare(
        "SELECT id, sequence_number FROM form_submissions WHERE form_id = ? AND idempotency_key = ?",
      )
      .bind(formId, input.idempotencyKey)
      .first<{ id: string; sequence_number: number | null }>();
    if (existing) {
      return {
        submissionId: existing.id,
        sequenceNumber: existing.sequence_number ?? 0,
      };
    }
  }

  const submissionId = generateId("sub");
  const now = new Date().toISOString();
  const countRow = await db
    .prepare("SELECT COALESCE(MAX(sequence_number), 0) AS max_seq FROM form_submissions WHERE form_id = ?")
    .bind(formId)
    .first<{ max_seq: number }>();
  const sequenceNumber = Number(countRow?.max_seq ?? 0) + 1;

  await db
    .prepare(
      `
        INSERT INTO form_submissions (
          id, form_id, status, ip_hash, user_agent, turnstile_verified, metadata_json, created_at,
          form_version_id, sequence_number, updated_at, referrer, page_url, user_id,
          spam_score, spam_reason, idempotency_key, completion_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      input.formVersionId ?? null,
      sequenceNumber,
      now,
      input.referrer ?? null,
      input.pageUrl ?? null,
      input.userId ?? null,
      input.spamScore ?? null,
      input.spamReason ?? null,
      input.idempotencyKey ?? null,
      input.completionMs ?? null,
    )
    .run();

  const valueStatements = fields
    .filter((field) => getFieldTypeDefinition(field.field_type)?.storesValue !== false)
    .map((field) => {
      const value = normalizeSubmissionValue(field.field_type, input.values[field.field_key]);
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

  await db
    .prepare(
      `
        UPDATE forms SET
          submission_count = COALESCE(submission_count, 0) + 1,
          last_submission_at = ?,
          updated_at = ?
        WHERE id = ?
      `,
    )
    .bind(now, now, formId)
    .run();

  await recordSubmissionEvent(db, {
    submissionId,
    formId,
    eventType: "submission_received",
    message: `Submission #${sequenceNumber} received`,
  });

  return { submissionId, sequenceNumber };
}

export function serializePublicForm(form: FormWithFields) {
  const published =
    form.status === "active" && form.published_definition_json
      ? parseDefinition(form.published_definition_json, form.id)
      : form.definition ?? definitionFromFields(form.id, form.fields, form.settings);

  const settings = published.settings;
  const fields = flattenDefinitionFields(published);

  return {
    id: form.id,
    slug: form.slug,
    title: form.title,
    description: form.description,
    published_version: form.published_version ?? null,
    settings: {
      success_message: settings.success_message,
      submit_label: settings.submit_label,
      turnstile_enabled: settings.turnstile_enabled ?? false,
      turnstile_site_key: settings.turnstile_site_key ?? null,
      ajax: settings.ajax !== false,
      confirmations: settings.confirmations ?? defaultConfirmations(),
    },
    fields: fields.map((field) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      type: field.type,
      placeholder: field.placeholder ?? null,
      help_text: field.description ?? null,
      required: Boolean(field.required),
      width: field.width ?? "100",
      options: field.options ?? {},
      validation: field.validation ?? {},
      settings: field.settings ?? {},
    })),
  };
}

export async function readJsonBody<T = Record<string, unknown>>(
  request: Request,
): Promise<T> {
  return (await request.json()) as T;
}
