import type { ContentTypeRecord } from "../foundation/types";
import { parseContentTypeSchema } from "../content-entries/schema-validation";
import type { SchemaFieldDefinition } from "../content-entries/types";
import { supportsCapability } from "../content-types/registry";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMetadataField(field: SchemaFieldDefinition): string {
  const name = `metadata_${field.key}`;
  const required = field.required ? " required" : "";
  const label = escapeHtml(field.label);

  switch (field.type) {
    case "textarea":
      return `<label class="field field-wide"><span>${label}</span><textarea class="textarea" name="${name}" rows="3"${required} data-metadata-key="${escapeHtml(field.key)}"></textarea></label>`;
    case "number":
      return `<label class="field"><span>${label}</span><input class="input" name="${name}" type="number" step="any"${required} data-metadata-key="${escapeHtml(field.key)}"></label>`;
    case "boolean":
      return `<label class="field field-checkbox"><input type="checkbox" name="${name}" data-metadata-key="${escapeHtml(field.key)}" data-metadata-type="boolean"><span>${label}</span></label>`;
    case "date":
      return `<label class="field"><span>${label}</span><input class="input" name="${name}" type="date"${required} data-metadata-key="${escapeHtml(field.key)}"></label>`;
    case "datetime":
      return `<label class="field"><span>${label}</span><input class="input" name="${name}" type="datetime-local"${required} data-metadata-key="${escapeHtml(field.key)}" data-metadata-type="datetime"></label>`;
    case "select": {
      const options = (field.options ?? [])
        .map(
          (option) =>
            `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`,
        )
        .join("");
      return `<label class="field"><span>${label}</span><select class="select" name="${name}"${required} data-metadata-key="${escapeHtml(field.key)}"><option value="">—</option>${options}</select></label>`;
    }
    case "url":
      return `<label class="field"><span>${label}</span><input class="input" name="${name}" type="url"${required} data-metadata-key="${escapeHtml(field.key)}"></label>`;
    case "email":
      return `<label class="field"><span>${label}</span><input class="input" name="${name}" type="email"${required} data-metadata-key="${escapeHtml(field.key)}"></label>`;
    case "image":
      return `<label class="field"><span>${label}</span><input class="input" name="${name}" placeholder="Media ID"${required} data-metadata-key="${escapeHtml(field.key)}"></label>`;
    case "json":
      return `<label class="field field-wide"><span>${label}</span><textarea class="textarea code" name="${name}" rows="4"${required} data-metadata-key="${escapeHtml(field.key)}" data-metadata-type="json"></textarea></label>`;
    default:
      return `<label class="field"><span>${label}</span><input class="input" name="${name}"${required} data-metadata-key="${escapeHtml(field.key)}"></label>`;
  }
}

function renderMetadataSection(contentType: ContentTypeRecord): string {
  const schema = parseContentTypeSchema(contentType.schema_json);
  const fields = schema.fields ?? [];
  if (fields.length === 0) {
    return "";
  }

  const fieldHtml = fields.map(renderMetadataField).join("\n");
  return `
    <div class="ve-page-section" data-page-section="metadata">
      <h3 class="ve-page-section-title">${escapeHtml(contentType.label)} fields</h3>
      <div class="metadata-fields">
        ${fieldHtml}
      </div>
    </div>
  `;
}

export function genericListPageShell(contentType: ContentTypeRecord): string {
  return `
    <div class="admin-toolbar">
      <a class="btn btn-primary" href="/admin/content/${escapeHtml(contentType.type_key)}/new">New ${escapeHtml(contentType.label)}</a>
      <form class="admin-filters" id="content-filter-form">
        <input type="search" name="q" placeholder="Search title or slug" class="input">
        <select name="status" class="select">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <button type="submit" class="btn btn-secondary">Filter</button>
      </form>
    </div>
    <div class="table-wrap">
      <table class="admin-table" id="content-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Published</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="content-table-body">
          <tr><td colspan="6" class="muted">Loading…</td></tr>
        </tbody>
      </table>
    </div>
    <div class="admin-pagination" id="content-pagination"></div>
  `;
}

export function genericEditPageShell(contentType: ContentTypeRecord): string {
  const seoFields = supportsCapability(contentType, "seo")
    ? `
        <div class="ve-page-section" data-page-section="seo">
          <h3 class="ve-page-section-title">SEO</h3>
          <label class="field"><span>SEO title</span><input class="input" name="seo_title"></label>
          <label class="field"><span>SEO description</span><textarea class="textarea" name="seo_description" rows="2"></textarea></label>
        </div>
      `
    : "";

  const featuredImageField = supportsCapability(contentType, "featured_image")
    ? `
          <div class="field featured-image-field" data-featured-image-field>
            <span class="field-label">Featured image</span>
            <input type="hidden" name="featured_image_id">
            <div class="featured-image-preview muted" data-featured-image-preview>No image selected</div>
            <div class="featured-image-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-featured-image-select>Set featured image</button>
              <button type="button" class="btn btn-secondary btn-sm hidden" data-featured-image-clear>Clear</button>
            </div>
          </div>
      `
    : "";

  const parentField = contentType.supports_parent
    ? `<label class="field"><span>Parent ID</span><input class="input" name="parent_id" placeholder="Parent entry ID"></label>`
    : "";

  const workflowSidebar =
    supportsCapability(contentType, "workflow") ||
    supportsCapability(contentType, "revisions")
      ? `
      <aside id="content-sidebar" class="ve-workflow-source" hidden>
        ${
          supportsCapability(contentType, "workflow")
            ? `
        <section class="admin-panel" id="workflow-panel">
          <h2 class="admin-panel-title">Workflow</h2>
          <div id="workflow-error" class="alert alert-error hidden"></div>
          <div id="workflow-status" class="workflow-status">
            <span class="workflow-badge" data-workflow-state>—</span>
            <p class="muted workflow-meta" data-workflow-meta></p>
          </div>
          <label class="field"><span>Comment</span><textarea class="textarea" id="workflow-comment" rows="2" placeholder="Optional note for reviewers"></textarea></label>
          <label class="field workflow-schedule-field hidden"><span>Schedule for</span><input class="input" id="workflow-scheduled-at" type="datetime-local"></label>
          <div class="workflow-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-workflow-action="submit">Submit for review</button>
            <button type="button" class="btn btn-secondary btn-sm" data-workflow-action="approve">Approve</button>
            <button type="button" class="btn btn-secondary btn-sm" data-workflow-action="reject">Reject</button>
            <button type="button" class="btn btn-primary btn-sm" data-workflow-action="publish">Publish</button>
            <button type="button" class="btn btn-secondary btn-sm" data-workflow-action="schedule">Schedule</button>
            <button type="button" class="btn btn-secondary btn-sm" data-workflow-action="archive">Archive</button>
          </div>
          <details class="workflow-history-details">
            <summary>Workflow history</summary>
            <ul class="workflow-history-list" id="workflow-history"></ul>
          </details>
        </section>`
            : ""
        }
        ${
          supportsCapability(contentType, "revisions")
            ? `
        <section class="admin-panel" id="revisions-panel">
          <h2 class="admin-panel-title">Revisions</h2>
          <div id="revisions-error" class="alert alert-error hidden"></div>
          <div id="revisions-list" class="revisions-list"></div>
          <div id="revision-compare" class="revision-compare hidden"></div>
        </section>`
            : ""
        }
      </aside>
    `
      : `<aside id="content-sidebar" class="ve-workflow-source" hidden></aside>`;

  return `
    <form id="content-form" class="admin-form gutenberg-editor-form" data-content-type="${escapeHtml(contentType.type_key)}" data-content-label="${escapeHtml(contentType.label)}">
      <div id="form-error" class="alert alert-error hidden ve-top-alert"></div>
      <div id="block-editor" class="block-editor-root visual-editor-host"></div>

      <div id="page-settings-fields" class="ve-page-fields-source" hidden>
        <div class="ve-page-section" data-page-section="summary">
          <h3 class="ve-page-section-title">Summary</h3>
          <label class="field"><span>Title</span><input class="input" name="title" required></label>
          <label class="field"><span>Slug</span><input class="input" name="slug" required pattern="[a-z0-9-]+"></label>
          <label class="field"><span>Excerpt</span><textarea class="textarea" name="excerpt" rows="2"></textarea></label>
          ${featuredImageField}
          ${parentField}
        </div>
        <div class="ve-page-section" data-page-section="status">
          <h3 class="ve-page-section-title">Status &amp; visibility</h3>
          <input type="hidden" name="status" value="draft">
          <label class="field"><span>Published at</span><input class="input" name="published_at" type="datetime-local"></label>
          <label class="field"><span>Template</span><input class="input" name="template" placeholder="Default template"></label>
          <label class="field"><span>Change summary</span><input class="input" name="change_summary" placeholder="Optional note for this save"></label>
        </div>
        ${seoFields}
        ${renderMetadataSection(contentType)}
      </div>

      ${workflowSidebar}
      <details class="block-editor-advanced" hidden>
        <summary>Advanced / Raw JSON</summary>
        <label class="field"><span>Content JSON</span><textarea class="textarea code" name="content_json" id="content-json-raw" rows="8" placeholder='{"version":1,"blocks":[]}'></textarea></label>
        <label class="field"><span>Generated HTML (read-only)</span><textarea class="textarea code" name="content_html" id="content-html-raw" rows="6" readonly></textarea></label>
        <input type="hidden" name="draft_content_json" id="draft-content-json-raw" value="">
        <input type="hidden" name="save_mode" id="content-save-mode" value="update">
        <button type="button" class="btn btn-secondary btn-sm" id="apply-raw-json-btn">Apply raw JSON to editor</button>
      </details>
      <button type="button" class="btn btn-danger" data-action="delete" id="content-delete-btn" hidden>Move to trash</button>
    </form>
  `;
}
