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
    <section class="admin-panel metadata-panel">
      <h2 class="admin-panel-title">${escapeHtml(contentType.label)} fields</h2>
      <div class="form-grid metadata-fields">
        ${fieldHtml}
      </div>
    </section>
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
        <label class="field"><span>SEO title</span><input class="input" name="seo_title"></label>
        <label class="field field-wide"><span>SEO description</span><textarea class="textarea" name="seo_description" rows="2"></textarea></label>
      `
    : "";

  const featuredImageField = supportsCapability(contentType, "featured_image")
    ? `
        <div class="field field-wide featured-image-field" data-featured-image-field>
          <span class="field-label">Featured image</span>
          <input type="hidden" name="featured_image_id">
          <div class="featured-image-preview muted" data-featured-image-preview>No image selected</div>
          <div class="featured-image-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-featured-image-select>Select from library</button>
            <button type="button" class="btn btn-secondary btn-sm hidden" data-featured-image-clear>Clear</button>
          </div>
        </div>
      `
    : "";

  const parentField = contentType.supports_parent
    ? `<label class="field"><span>Parent ID</span><input class="input" name="parent_id" placeholder="Parent entry ID"></label>`
    : "";

  const templateField = `<label class="field"><span>Template</span><input class="input" name="template"></label>`;

  const blockEditor = supportsCapability(contentType, "revisions") ||
    contentType.supports_json !== false
    ? `
      <section class="field field-wide block-editor-section">
        <span class="field-label">Content</span>
        <div id="block-editor" class="block-editor-root">
          <div class="block-editor-toolbar">
            <div class="block-add-wrap">
              <button type="button" class="btn btn-secondary" data-block-add-btn>+ Add block</button>
              <div class="block-add-menu hidden" data-block-add-menu>
                <button type="button" data-add-type="paragraph">Paragraph</button>
                <button type="button" data-add-type="heading">Heading</button>
                <button type="button" data-add-type="image">Image</button>
                <button type="button" data-add-type="button">Button</button>
                <button type="button" data-add-type="quote">Quote</button>
                <button type="button" data-add-type="list">List</button>
                <button type="button" data-add-type="spacer">Spacer</button>
                <button type="button" data-add-type="html">Custom HTML</button>
                <button type="button" data-add-type="form">Form</button>
              </div>
            </div>
          </div>
          <div class="block-editor-list" data-block-list></div>
        </div>
      </section>
      <details class="block-editor-advanced field-wide">
        <summary>Advanced / Raw JSON</summary>
        <label class="field"><span>Content JSON</span><textarea class="textarea code" name="content_json" id="content-json-raw" rows="8" placeholder='{"version":1,"blocks":[]}'></textarea></label>
        <label class="field"><span>Generated HTML (read-only)</span><textarea class="textarea code" name="content_html" id="content-html-raw" rows="6" readonly></textarea></label>
        <button type="button" class="btn btn-secondary btn-sm" id="apply-raw-json-btn">Apply raw JSON to editor</button>
      </details>
    `
    : "";

  const workflowSidebar =
    supportsCapability(contentType, "workflow") ||
    supportsCapability(contentType, "revisions")
      ? `
      <aside class="content-edit-sidebar" id="content-sidebar">
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
          <h2 class="admin-panel-title">Revision history</h2>
          <div id="revisions-error" class="alert alert-error hidden"></div>
          <div id="revisions-list" class="revisions-list"></div>
          <div id="revision-compare" class="revision-compare hidden"></div>
        </section>`
            : ""
        }
      </aside>
    `
      : "";

  return `
    <div class="content-edit-layout">
      <div class="content-edit-main">
    <form id="content-form" class="admin-form">
      <div id="form-error" class="alert alert-error hidden"></div>
      <div class="form-grid">
        <label class="field"><span>Title</span><input class="input" name="title" required></label>
        <label class="field"><span>Slug</span><input class="input" name="slug" required pattern="[a-z0-9-]+"></label>
        <label class="field field-wide"><span>Change summary</span><input class="input" name="change_summary" placeholder="Brief note about this save (optional)"></label>
        <label class="field"><span>Published at</span><input class="input" name="published_at" type="datetime-local"></label>
        <label class="field field-wide"><span>Excerpt</span><textarea class="textarea" name="excerpt" rows="2"></textarea></label>
        ${templateField}
        <input type="hidden" name="status" value="draft">
        ${featuredImageField}
        ${parentField}
        ${seoFields}
      </div>
      ${renderMetadataSection(contentType)}
      ${blockEditor}
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" data-action="save">Save draft</button>
        <button type="button" class="btn btn-primary" data-action="publish">Publish</button>
        <button type="button" class="btn btn-secondary" data-action="archive">Archive</button>
        <button type="button" class="btn btn-danger" data-action="delete">Delete</button>
      </div>
    </form>
      </div>
      ${workflowSidebar}
    </div>
  `;
}
