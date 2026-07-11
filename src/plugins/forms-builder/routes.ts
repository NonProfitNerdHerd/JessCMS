import { isAuthUser, requirePermission } from "../../auth";
import { getClientIp, writeAuditLog } from "../../db/audit";
import {
  badRequest,
  conflict,
  created,
  notFound,
  ok,
  serverError,
} from "../../lib/response";
import { flattenDefinitionFields } from "./definition";
import { getFieldTypeDefinitions } from "./field-registry";
import {
  dispatchAdminNotifications,
  resolveConfirmation,
} from "./notifications";
import {
  ConflictError,
  createForm,
  createFormField,
  createSubmission,
  deleteForm,
  deleteFormField,
  deleteSubmission,
  duplicateForm,
  getFormWithFields,
  getSubmissionWithValues,
  listFormSubmissions,
  listFormVersions,
  listForms,
  NotFoundError,
  publishForm,
  readJsonBody,
  reorderFormFields,
  restoreFormVersion,
  saveFormDraft,
  serializePublicForm,
  updateForm,
  updateFormField,
  updateSubmissionStatus,
  ValidationError,
} from "./repository";
import { checkSubmissionSpam, getSubmissionIp, hashIpAddress } from "./security";
import type { FormDefinition, FormDefinitionField } from "./definition";
import { validateSubmissionValues } from "./validation";

function handleError(error: unknown): Response {
  if (error instanceof ValidationError) {
    return badRequest("Validation failed", error.errors);
  }
  if (error instanceof ConflictError) {
    return conflict(error.message);
  }
  if (error instanceof NotFoundError) {
    return notFound(error.message);
  }
  console.error(error);
  return serverError();
}

export async function handleListForms(request: Request, env: Env): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:read");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const url = new URL(request.url);
    const result = await listForms(env.DB, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 25),
      offset: Number(url.searchParams.get("offset") ?? 0),
    });
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleGetForm(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:read");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const form = await getFormWithFields(env.DB, { id: params.id });
    if (!form) return notFound();
    return ok(form);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleCreateForm(request: Request, env: Env): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:create");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = await readJsonBody(request);
    const form = await createForm(
      env.DB,
      {
        title: String(body.title ?? ""),
        slug: body.slug ? String(body.slug) : undefined,
        description: body.description ? String(body.description) : null,
        status: body.status ? String(body.status) : undefined,
        settings: body.settings as Record<string, unknown> | undefined,
        template: body.template ? String(body.template) : undefined,
      },
      authResult.id,
    );

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "create",
      entityType: "form",
      entityId: form.id,
      ipAddress: getClientIp(request),
    });

    return created(form);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleUpdateForm(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:update");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = await readJsonBody(request);
    const form = await updateForm(
      env.DB,
      params.id,
      {
        title: body.title !== undefined ? String(body.title) : undefined,
        slug: body.slug !== undefined ? String(body.slug) : undefined,
        description:
          body.description !== undefined
            ? body.description
              ? String(body.description)
              : null
            : undefined,
        status: body.status !== undefined ? String(body.status) : undefined,
        settings: body.settings as Record<string, unknown> | undefined,
      },
      authResult.id,
    );

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "update",
      entityType: "form",
      entityId: form.id,
      ipAddress: getClientIp(request),
    });

    return ok(form);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleSaveFormDraft(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:update");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = await readJsonBody(request);
    if (!body.definition || typeof body.definition !== "object") {
      return badRequest("definition is required");
    }

    const form = await saveFormDraft(
      env.DB,
      params.id,
      {
        definition: body.definition as FormDefinition,
        title: body.title !== undefined ? String(body.title) : undefined,
        slug: body.slug !== undefined ? String(body.slug) : undefined,
        description:
          body.description !== undefined
            ? body.description
              ? String(body.description)
              : null
            : undefined,
        expected_draft_version:
          body.expected_draft_version !== undefined
            ? Number(body.expected_draft_version)
            : undefined,
        change_note: body.change_note ? String(body.change_note) : undefined,
      },
      authResult.id,
    );

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "update",
      entityType: "form_draft",
      entityId: form.id,
      metadata: { draft_version: form.draft_version },
      ipAddress: getClientIp(request),
    });

    return ok(form);
  } catch (error) {
    return handleError(error);
  }
}

export async function handlePublishForm(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:publish");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = await readJsonBody(request).catch(() => ({} as Record<string, unknown>));
    const form = await publishForm(
      env.DB,
      params.id,
      authResult.id,
      body.change_note ? String(body.change_note) : undefined,
    );

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "publish",
      entityType: "form",
      entityId: form.id,
      metadata: { published_version: form.published_version },
      ipAddress: getClientIp(request),
    });

    return ok(form);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleDuplicateForm(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:create");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const form = await duplicateForm(env.DB, params.id, authResult.id);
    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "duplicate",
      entityType: "form",
      entityId: form.id,
      metadata: { source_id: params.id },
      ipAddress: getClientIp(request),
    });
    return created(form);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleListFormVersions(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:read");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const versions = await listFormVersions(env.DB, params.id);
    return ok({ items: versions });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleRestoreFormVersion(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:update");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const form = await restoreFormVersion(
      env.DB,
      params.id,
      params.versionId,
      authResult.id,
    );
    return ok(form);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleExportFormDefinition(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:read");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const form = await getFormWithFields(env.DB, { id: params.id });
    if (!form?.definition) return notFound();

    const exported = {
      schemaVersion: form.definition.schemaVersion,
      title: form.title,
      description: form.description,
      definition: {
        ...form.definition,
        settings: {
          ...form.definition.settings,
          notifications: (form.definition.settings.notifications ?? []).map((n) => ({
            ...n,
            recipient: n.recipient ? "[redacted]" : "",
            reply_to: n.reply_to ? "[redacted]" : undefined,
          })),
        },
      },
    };

    return ok(exported);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleListFieldTypes(
  request: Request,
  env: Env,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:read");
  if (!isAuthUser(authResult)) return authResult;
  return ok({ items: getFieldTypeDefinitions() });
}

export async function handleDeleteForm(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:delete");
  if (!isAuthUser(authResult)) return authResult;

  try {
    await deleteForm(env.DB, params.id);
    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "delete",
      entityType: "form",
      entityId: params.id,
      ipAddress: getClientIp(request),
    });
    return ok({ deleted: true, id: params.id });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleCreateFormField(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:update");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = await readJsonBody(request);
    const field = await createFormField(env.DB, params.id, {
      field_key: body.field_key ? String(body.field_key) : undefined,
      label: String(body.label ?? ""),
      field_type: String(body.field_type ?? "text"),
      placeholder: body.placeholder ? String(body.placeholder) : null,
      help_text: body.help_text ? String(body.help_text) : null,
      required: Boolean(body.required),
      sort_order: body.sort_order !== undefined ? Number(body.sort_order) : undefined,
      options: body.options as { choices?: Array<{ label: string; value: string }> },
      validation: body.validation as Record<string, unknown>,
      settings: body.settings as Record<string, unknown>,
    });
    return created(field);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleUpdateFormField(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:update");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = await readJsonBody(request);
    const field = await updateFormField(env.DB, params.id, params.fieldId, {
      field_key: body.field_key !== undefined ? String(body.field_key) : undefined,
      label: body.label !== undefined ? String(body.label) : undefined,
      field_type: body.field_type !== undefined ? String(body.field_type) : undefined,
      placeholder:
        body.placeholder !== undefined
          ? body.placeholder
            ? String(body.placeholder)
            : null
          : undefined,
      help_text:
        body.help_text !== undefined
          ? body.help_text
            ? String(body.help_text)
            : null
          : undefined,
      required: body.required !== undefined ? Boolean(body.required) : undefined,
      sort_order: body.sort_order !== undefined ? Number(body.sort_order) : undefined,
      options: body.options as { choices?: Array<{ label: string; value: string }> },
      validation: body.validation as Record<string, unknown>,
      settings: body.settings as Record<string, unknown>,
    });
    return ok(field);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleDeleteFormField(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:update");
  if (!isAuthUser(authResult)) return authResult;

  try {
    await deleteFormField(env.DB, params.id, params.fieldId);
    return ok({ deleted: true, id: params.fieldId });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleReorderFormFields(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:update");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = await readJsonBody<{ field_ids?: string[] }>(request);
    const fieldIds = Array.isArray(body.field_ids) ? body.field_ids.map(String) : [];
    const fields = await reorderFormFields(env.DB, params.id, fieldIds);
    return ok({ fields });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleListFormSubmissions(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:submissions:read");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const url = new URL(request.url);
    const result = await listFormSubmissions(env.DB, params.id, {
      status: url.searchParams.get("status") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 25),
      offset: Number(url.searchParams.get("offset") ?? 0),
    });
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleGetSubmission(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:submissions:read");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const result = await getSubmissionWithValues(env.DB, params.submissionId);
    if (!result) return notFound();
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleUpdateSubmission(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:submissions:update");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = await readJsonBody(request);
    const submission = await updateSubmissionStatus(
      env.DB,
      params.submissionId,
      String(body.status ?? "read"),
    );
    return ok(submission);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleDeleteSubmission(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "forms:submissions:update");
  if (!isAuthUser(authResult)) return authResult;

  try {
    await deleteSubmission(env.DB, params.submissionId);
    return ok({ deleted: true, id: params.submissionId });
  } catch (error) {
    return handleError(error);
  }
}

export async function handlePublicGetForm(
  _request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const form = await getFormWithFields(env.DB, { slug: params.slug }, true);
    if (!form) return notFound("Form not found");
    return ok(serializePublicForm(form), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function handlePublicSubmitForm(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  if (request.method !== "POST") {
    return badRequest("Method not allowed");
  }

  try {
    const form = await getFormWithFields(env.DB, { slug: params.slug }, true);
    if (!form) return notFound("Form not found");

    const body = await readJsonBody<Record<string, unknown>>(request);
    const values = (body.values as Record<string, unknown> | undefined) ?? body;
    const idempotencyKey =
      typeof body.idempotency_key === "string"
        ? body.idempotency_key
        : request.headers.get("Idempotency-Key");

    const spam = checkSubmissionSpam({
      honeypotValue: body._jess_hp ?? values._jess_hp,
      honeypotEnabled: form.settings.honeypot_enabled !== false,
      turnstileToken:
        typeof body.turnstile_token === "string" ? body.turnstile_token : null,
      turnstileEnabled: Boolean(form.settings.turnstile_enabled),
    });

    const confirmation = resolveConfirmation(form.settings);

    if (spam.isSpam) {
      return ok({
        success: true,
        message: confirmation.message,
        confirmation,
      });
    }

    const errors = validateSubmissionValues(form.fields, values);
    if (Object.keys(errors).length > 0) {
      return badRequest("Validation failed", errors);
    }

    const ip = getSubmissionIp(request);
    const ipHash = await hashIpAddress(
      ip,
      (env as Env & { FORMS_IP_PEPPER?: string }).FORMS_IP_PEPPER,
    );

    const publishedVersionId = form.published_version
      ? (
          await env.DB.prepare(
            `SELECT id FROM form_versions WHERE form_id = ? AND version_number = ? AND is_published = 1 LIMIT 1`,
          )
            .bind(form.id, form.published_version)
            .first<{ id: string }>()
        )?.id ?? null
      : null;

    const { submissionId } = await createSubmission(
      env.DB,
      form.id,
      {
        values,
        ipHash,
        userAgent: request.headers.get("User-Agent"),
        turnstileVerified: spam.turnstileVerified,
        metadata: spam.reason ? { spam_check: spam.reason } : undefined,
        status: "new",
        formVersionId: publishedVersionId,
        referrer: typeof body.referrer === "string" ? body.referrer : request.headers.get("Referer"),
        pageUrl: typeof body.page_url === "string" ? body.page_url : null,
        idempotencyKey,
        completionMs:
          typeof body.completion_ms === "number" ? body.completion_ms : null,
      },
      form.fields,
    );

    const definitionFields = form.definition
      ? flattenDefinitionFields(form.definition)
      : form.fields.map((field) => ({
          id: field.id,
          key: field.field_key,
          type: field.field_type,
          version: 1,
          label: field.label,
          required: Boolean(field.required),
        }));

    try {
      await dispatchAdminNotifications(
        env.DB,
        form,
        submissionId,
        values,
        definitionFields as FormDefinitionField[],
      );
    } catch (notifyError) {
      console.error("Form notification failed", notifyError);
    }

    await writeAuditLog(env.DB, {
      actorId: null,
      action: "create",
      entityType: "form_submission",
      entityId: submissionId,
      metadata: { form_id: form.id, form_slug: form.slug },
      ipAddress: getClientIp(request),
    });

    return created({
      success: true,
      submission_id: submissionId,
      message: confirmation.message,
      confirmation,
    });
  } catch (error) {
    return handleError(error);
  }
}
