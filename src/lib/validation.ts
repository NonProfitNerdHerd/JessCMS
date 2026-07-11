export const CONTENT_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "archived",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface BaseContentInput {
  title?: string;
  slug?: string;
  status?: string;
  excerpt?: string | null;
  content_json?: string | null;
  content_html?: string | null;
  draft_content_json?: string | null;
  save_mode?: "draft" | "publish" | "update";
  featured_image_id?: string | null;
  parent_id?: string | null;
  template?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  published_at?: string | null;
}

export interface EventContentInput extends BaseContentInput {
  start_datetime?: string;
  end_datetime?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string;
  event_status?: string;
}

function isContentStatus(value: string): value is ContentStatus {
  return CONTENT_STATUSES.includes(value as ContentStatus);
}

function validateContentJson(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return null;
    } catch {
      return "content_json must be valid JSON";
    }
  }

  try {
    JSON.stringify(value);
    return null;
  } catch {
    return "content_json must be valid JSON";
  }
}

function validatePublishedAt(
  status: string | undefined,
  publishedAt: string | null | undefined,
  errors: string[],
  required: boolean,
): void {
  if (!status) {
    return;
  }

  if (status === "published" || status === "scheduled") {
    if (!publishedAt) {
      errors.push("published_at is required when status is published or scheduled");
    } else if (Number.isNaN(Date.parse(publishedAt))) {
      errors.push("published_at must be a valid ISO datetime");
    }
  }

  if (required && !publishedAt && (status === "published" || status === "scheduled")) {
    errors.push("published_at is required when status is published or scheduled");
  }
}

export function validateBaseContentInput(
  input: BaseContentInput,
  options: { requireTitle?: boolean; requireSlug?: boolean } = {},
): ValidationResult {
  const errors: string[] = [];
  const requireTitle = options.requireTitle ?? false;
  const requireSlug = options.requireSlug ?? false;

  if (requireTitle && !input.title?.trim()) {
    errors.push("title is required");
  }

  if (requireSlug && !input.slug?.trim()) {
    errors.push("slug is required");
  }

  if (input.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    errors.push("slug must be lowercase alphanumeric with hyphens");
  }

  if (input.status && !isContentStatus(input.status)) {
    errors.push(`status must be one of: ${CONTENT_STATUSES.join(", ")}`);
  }

  const jsonError = validateContentJson(input.content_json);
  if (jsonError) {
    errors.push(jsonError);
  }

  validatePublishedAt(input.status, input.published_at, errors, requireTitle);

  return { valid: errors.length === 0, errors };
}

export function validateEventInput(
  input: EventContentInput,
  options: { requireTitle?: boolean; requireSlug?: boolean } = {},
): ValidationResult {
  const base = validateBaseContentInput(input, options);
  const errors = [...base.errors];

  if (options.requireTitle && !input.start_datetime) {
    errors.push("start_datetime is required");
  }

  if (input.start_datetime && Number.isNaN(Date.parse(input.start_datetime))) {
    errors.push("start_datetime must be a valid ISO datetime");
  }

  if (input.end_datetime) {
    if (Number.isNaN(Date.parse(input.end_datetime))) {
      errors.push("end_datetime must be a valid ISO datetime");
    } else if (
      input.start_datetime &&
      Date.parse(input.end_datetime) < Date.parse(input.start_datetime)
    ) {
      errors.push("end_datetime must be after start_datetime");
    }
  }

  if (
    input.event_status &&
    !["scheduled", "cancelled", "postponed", "completed"].includes(input.event_status)
  ) {
    errors.push("event_status must be scheduled, cancelled, postponed, or completed");
  }

  return { valid: errors.length === 0, errors };
}

export function normalizeContentJson(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

export function parseListQuery(url: URL): {
  status?: string;
  q?: string;
  limit: number;
  offset: number;
} {
  const status = url.searchParams.get("status") ?? undefined;
  const q = url.searchParams.get("q")?.trim() || undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 25), 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  return { status, q, limit, offset };
}

export function isPublicPublishedFilter(): string {
  return `(status = 'published' AND (published_at IS NULL OR datetime(published_at) <= datetime('now')))`;
}
