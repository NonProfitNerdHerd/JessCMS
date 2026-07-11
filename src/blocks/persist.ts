import { parseContentDocument, renderDocument } from "./render";
import { validateContentDocument } from "./validate";
import { normalizeContentJson } from "../lib/validation";

export interface PreparedContentBody {
  content_json: string | null;
  content_html: string | null;
  draft_content_json?: string | null;
  validation_errors?: string[];
}

/**
 * Normalize editor payload:
 * - Always regenerate content_html from content_json when publishing/saving published body
 * - Optionally store draft_content_json without touching published HTML
 */
export function prepareContentBody(input: {
  content_json?: unknown;
  content_html?: string | null;
  draft_content_json?: unknown;
  save_mode?: "draft" | "publish" | "update";
  existing_status?: string | null;
}): PreparedContentBody {
  const draftRaw = normalizeContentJson(input.draft_content_json);
  const jsonRaw = normalizeContentJson(input.content_json);

  const saveMode = input.save_mode ?? "update";
  const isPublished = input.existing_status === "published";

  // Editing a published item as draft: keep published body, store draft separately.
  if (saveMode === "draft" && isPublished && (draftRaw ?? jsonRaw)) {
    const draft = draftRaw ?? jsonRaw;
    const validation = validateContentDocument(draft);
    return {
      content_json: null, // signal: do not overwrite published json
      content_html: null,
      draft_content_json: draft,
      validation_errors: validation.errors.map((e) => e.message),
    };
  }

  if (saveMode === "publish" && (draftRaw || jsonRaw)) {
    const source = draftRaw ?? jsonRaw!;
    const doc = parseContentDocument(source);
    const html = renderDocument(doc);
    return {
      content_json: JSON.stringify(doc),
      content_html: html,
      draft_content_json: null,
    };
  }

  if (jsonRaw) {
    const doc = parseContentDocument(jsonRaw);
    const html = renderDocument(doc);
    return {
      content_json: JSON.stringify(doc),
      content_html: html,
      draft_content_json: draftRaw === undefined ? undefined : draftRaw,
    };
  }

  return {
    content_json: null,
    content_html: input.content_html ?? null,
    draft_content_json: draftRaw === undefined ? undefined : draftRaw,
  };
}
