export function formsListShell(): string {
  return `
    <div class="admin-toolbar">
      <a class="btn btn-primary" href="/admin/forms/new">New form</a>
      <form class="admin-filters" id="forms-filter-form">
        <input type="search" name="q" placeholder="Search forms" class="input">
        <select name="status" class="select">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Published</option>
          <option value="disabled">Disabled</option>
          <option value="archived">Archived</option>
        </select>
        <button type="submit" class="btn btn-secondary">Filter</button>
      </form>
    </div>
    <div id="forms-error" class="alert alert-error hidden"></div>
    <div class="table-wrap">
      <table class="admin-table" id="forms-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Entries</th>
            <th>Last submission</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="forms-table-body">
          <tr><td colspan="6" class="muted">Loading…</td></tr>
        </tbody>
      </table>
    </div>
    <div class="admin-pagination" id="forms-pagination"></div>
  `;
}

export function formsEditShell(isNew: boolean): string {
  if (isNew) {
    return `
      <div id="forms-error" class="alert alert-error hidden"></div>
      <form id="forms-meta-form" class="admin-form forms-new-form">
        <div class="form-grid">
          <label class="field"><span>Title</span><input class="input" name="title" required placeholder="Contact form"></label>
          <label class="field"><span>Slug</span><input class="input" name="slug" required pattern="[a-z0-9-]+" placeholder="contact"></label>
          <label class="field field-wide"><span>Description</span><textarea class="textarea" name="description" rows="2"></textarea></label>
          <label class="field"><span>Start from template</span>
            <select class="select" name="template">
              <option value="blank">Blank form</option>
              <option value="contact">Simple contact</option>
              <option value="newsletter">Newsletter signup</option>
              <option value="feedback">Feedback</option>
              <option value="support">Support request</option>
            </select>
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Create form</button>
          <a class="btn btn-secondary" href="/admin/forms">Cancel</a>
        </div>
      </form>
    `;
  }

  return `
    <div class="forms-builder-app" id="forms-builder-app">
      <header class="forms-builder-toolbar">
        <a class="btn btn-secondary btn-sm" href="/admin/forms">← Forms</a>
        <input class="input forms-builder-title" id="fb-title" aria-label="Form name">
        <span class="forms-builder-status muted" id="fb-save-status">Loading…</span>
        <div class="forms-builder-toolbar-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="fb-undo" title="Undo">Undo</button>
          <button type="button" class="btn btn-secondary btn-sm" id="fb-redo" title="Redo">Redo</button>
          <div class="forms-preview-widths" role="group" aria-label="Preview width">
            <button type="button" class="btn btn-secondary btn-sm is-active" data-preview-width="desktop">Desktop</button>
            <button type="button" class="btn btn-secondary btn-sm" data-preview-width="tablet">Tablet</button>
            <button type="button" class="btn btn-secondary btn-sm" data-preview-width="mobile">Mobile</button>
          </div>
          <a class="btn btn-secondary btn-sm" id="fb-entries" href="#">Entries</a>
          <button type="button" class="btn btn-secondary" id="fb-save">Save draft</button>
          <button type="button" class="btn btn-primary" id="fb-publish">Publish</button>
          <details class="forms-more-menu">
            <summary class="btn btn-secondary btn-sm">More</summary>
            <div class="forms-more-menu-panel">
              <button type="button" id="fb-duplicate">Duplicate</button>
              <button type="button" id="fb-export">Export JSON</button>
              <button type="button" id="fb-disable">Disable</button>
              <button type="button" class="danger" id="fb-delete">Delete</button>
            </div>
          </details>
        </div>
      </header>
      <div id="forms-error" class="alert alert-error hidden"></div>
      <div id="forms-success" class="alert alert-success hidden"></div>
      <div class="forms-builder-layout">
        <aside class="forms-builder-left" aria-label="Add fields">
          <div class="forms-builder-tabs" role="tablist">
            <button type="button" class="is-active" data-left-tab="add" role="tab">Add</button>
            <button type="button" data-left-tab="structure" role="tab">Structure</button>
          </div>
          <div class="forms-builder-left-panel" data-left-panel="add">
            <input type="search" class="input" id="fb-field-search" placeholder="Search fields">
            <div id="fb-field-palette"></div>
          </div>
          <div class="forms-builder-left-panel hidden" data-left-panel="structure">
            <div id="fb-structure-list"></div>
          </div>
        </aside>
        <main class="forms-builder-canvas-wrap">
          <div class="forms-builder-canvas" id="fields-list" data-preview-width="desktop">
            <p class="muted">Loading builder…</p>
          </div>
        </main>
        <aside class="forms-builder-right" aria-label="Settings">
          <div id="fb-inspector">
            <p class="muted">Select a field or edit form settings.</p>
          </div>
        </aside>
      </div>
    </div>
  `;
}

export function formsSubmissionsShell(): string {
  return `
    <div class="admin-toolbar">
      <a class="btn btn-secondary" href="#" id="back-to-form-link">← Back to form</a>
      <form class="admin-filters" id="submissions-filter-form">
        <select name="status" class="select">
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="spam">Spam</option>
          <option value="archived">Archived</option>
        </select>
        <button type="submit" class="btn btn-secondary">Filter</button>
      </form>
    </div>
    <div id="submissions-error" class="alert alert-error hidden"></div>
    <div class="table-wrap">
      <table class="admin-table" id="submissions-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Status</th>
            <th>ID</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="submissions-table-body">
          <tr><td colspan="5" class="muted">Loading…</td></tr>
        </tbody>
      </table>
    </div>
    <div class="admin-pagination" id="submissions-pagination"></div>
  `;
}

export function submissionDetailShell(): string {
  return `
    <div class="admin-toolbar">
      <a class="btn btn-secondary" href="#" id="back-to-submissions-link">← Back to submissions</a>
    </div>
    <div id="submission-error" class="alert alert-error hidden"></div>
    <div id="submission-detail" class="submission-detail">
      <p class="muted">Loading submission…</p>
    </div>
  `;
}
