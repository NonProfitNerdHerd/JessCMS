import {
  applyMergeTags,
  getEmailProvider,
  isValidEmailAddress,
  sanitizeEmailHeader,
} from "./email";
import type { FormConfirmationConfig, FormNotificationConfig, FormWithFields } from "./types";
import { generateId } from "../../lib/crypto";
import type { FormDefinitionField } from "./definition";
import { getFieldTypeDefinition } from "./field-registry";

export function resolveConfirmation(
  settings: FormWithFields["settings"],
): { type: "message" | "redirect"; message: string; redirect_url?: string } {
  const confirmations = settings.confirmations ?? [];
  const enabled = confirmations.find((item) => item.enabled !== false) ?? confirmations[0];

  if (enabled?.type === "redirect" && enabled.redirect_url) {
    const url = sanitizeRedirectUrl(enabled.redirect_url);
    if (url) {
      return { type: "redirect", message: "", redirect_url: url };
    }
  }

  return {
    type: "message",
    message:
      enabled?.message ||
      settings.success_message ||
      "Thank you for your submission.",
  };
}

export function sanitizeRedirectUrl(raw: string): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function formatFieldValueForDisplay(
  field: FormDefinitionField | { type: string; label: string; key?: string },
  raw: unknown,
): string {
  if (raw === undefined || raw === null || raw === "") return "";

  if (field.type === "name" && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, string>;
    return [obj.prefix, obj.first, obj.middle, obj.last, obj.suffix]
      .filter(Boolean)
      .join(" ");
  }

  if (field.type === "address" && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, string>;
    return [obj.line1, obj.line2, obj.city, obj.state, obj.postal, obj.country]
      .filter(Boolean)
      .join(", ");
  }

  if (field.type === "yes_no") {
    return raw === true || raw === "true" || raw === "yes" || raw === "1" ? "Yes" : "No";
  }

  if (Array.isArray(raw)) return raw.map(String).join(", ");
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

export function buildSubmissionSummary(
  fields: FormDefinitionField[],
  values: Record<string, unknown>,
): string {
  const lines: string[] = [];
  for (const field of fields) {
    const def = getFieldTypeDefinition(field.type);
    if (def && !def.storesValue) continue;
    const display = formatFieldValueForDisplay(field, values[field.key]);
    if (!display) continue;
    lines.push(`${field.label}: ${display}`);
  }
  return lines.join("\n");
}

export async function dispatchAdminNotifications(
  db: D1Database,
  form: FormWithFields,
  submissionId: string,
  values: Record<string, unknown>,
  fields: FormDefinitionField[],
): Promise<void> {
  const notifications = (form.settings.notifications ?? []).filter((n) => n.enabled);
  if (!notifications.length) return;

  const summary = buildSubmissionSummary(fields, values);
  const tags: Record<string, string> = {
    "form:name": form.title,
    "form:id": form.id,
    "form:slug": form.slug,
    "submission:id": submissionId,
    "submission:summary": summary,
    "site:name": "JessCMS",
  };

  for (const notification of notifications) {
    await sendNotification(db, form.id, submissionId, notification, tags, summary);
  }
}

async function sendNotification(
  db: D1Database,
  formId: string,
  submissionId: string,
  notification: FormNotificationConfig,
  tags: Record<string, string>,
  summary: string,
): Promise<void> {
  const logId = generateId("fnl");
  const now = new Date().toISOString();
  const recipient = sanitizeEmailHeader(
    applyMergeTags(notification.recipient || "", tags),
  );
  const subject = sanitizeEmailHeader(applyMergeTags(notification.subject || "", tags));
  let message = applyMergeTags(notification.message || "", tags);
  if (notification.include_field_summary !== false && !message.includes(summary)) {
    message = `${message}\n\n${summary}`.trim();
  }

  await db
    .prepare(
      `
        INSERT INTO form_notification_log (
          id, form_id, submission_id, notification_key, status, recipient, subject, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)
      `,
    )
    .bind(logId, formId, submissionId, notification.key, recipient, subject, now, now)
    .run();

  if (!recipient || !isValidEmailAddress(recipient)) {
    await db
      .prepare(
        `
          UPDATE form_notification_log
          SET status = 'failed', error_message = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .bind("Invalid or missing recipient", new Date().toISOString(), logId)
      .run();
    await recordSubmissionEvent(db, {
      submissionId,
      formId,
      eventType: "notification_failed",
      message: `Notification ${notification.key} failed: invalid recipient`,
    });
    return;
  }

  try {
    const provider = getEmailProvider();
    const result = await provider.send({
      to: [recipient],
      replyTo: notification.reply_to
        ? sanitizeEmailHeader(applyMergeTags(notification.reply_to, tags))
        : undefined,
      subject,
      text: notification.format === "html" ? undefined : message,
      html: notification.format === "html" ? message.replace(/\n/g, "<br>") : undefined,
    });

    if (!result.ok) {
      throw new Error(result.error || "Provider failed");
    }

    await db
      .prepare(
        `
          UPDATE form_notification_log
          SET status = 'sent', provider_ref = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .bind(result.providerRef ?? null, new Date().toISOString(), logId)
      .run();

    await recordSubmissionEvent(db, {
      submissionId,
      formId,
      eventType: "notification_sent",
      message: `Notification ${notification.key} sent to ${recipient}`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await db
      .prepare(
        `
          UPDATE form_notification_log
          SET status = 'failed', error_message = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .bind(errorMessage, new Date().toISOString(), logId)
      .run();

    await recordSubmissionEvent(db, {
      submissionId,
      formId,
      eventType: "notification_failed",
      message: `Notification ${notification.key} failed: ${errorMessage}`,
    });
  }
}

export async function recordSubmissionEvent(
  db: D1Database,
  input: {
    submissionId?: string | null;
    formId?: string | null;
    eventType: string;
    message?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  },
): Promise<void> {
  try {
    await db
      .prepare(
        `
          INSERT INTO form_submission_events (
            id, submission_id, form_id, event_type, message, metadata_json, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        generateId("fse"),
        input.submissionId ?? null,
        input.formId ?? null,
        input.eventType,
        input.message ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.createdBy ?? null,
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    console.error("Failed to record form submission event", error);
  }
}

export function defaultNotifications(): FormNotificationConfig[] {
  return [
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
  ];
}

export function defaultConfirmations(): FormConfirmationConfig[] {
  return [
    {
      key: "default",
      type: "message",
      message: "Thank you for your submission.",
      enabled: true,
    },
  ];
}
