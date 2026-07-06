export function formsListShell(): string {
  return `
    <div class="admin-toolbar">
      <a class="btn btn-primary" href="/admin/forms/new">New form</a>
      <form class="admin-filters" id="forms-filter-form">
        <input type="search" name="q" placeholder="Search forms" class="input">
        <select name="status" class="select">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
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
            <th>Slug</th>
            <th>Status</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="forms-table-body">
          <tr><td colspan="5" class="muted">Loading…</td></tr>
        </tbody>
      </table>
    </div>
    <div class="admin-pagination" id="forms-pagination"></div>
  `;
}

export function formsEditShell(isNew: boolean): string {
  return `
    <div id="forms-error" class="alert alert-error hidden"></div>
    <div id="forms-success" class="alert alert-success hidden"></div>
    <form id="forms-meta-form" class="admin-form">
      <div class="form-grid">
        <label class="field"><span>Title</span><input class="input" name="title" required></label>
        <label class="field"><span>Slug</span><input class="input" name="slug" required pattern="[a-z0-9-]+"></label>
        <label class="field"><span>Status</span>
          <select class="select" name="status">
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label class="field field-wide"><span>Description</span><textarea class="textarea" name="description" rows="2"></textarea></label>
        <label class="field field-wide"><span>Success message</span><input class="input" name="success_message"></label>
        <label class="field"><span>Submit button label</span><input class="input" name="submit_label" value="Submit"></label>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${isNew ? "Create form" : "Save form"}</button>
        ${isNew ? "" : `<a class="btn btn-secondary" href="#" id="view-submissions-link">Submissions</a>`}
        ${isNew ? "" : `<button type="button" class="btn btn-danger" id="delete-form-btn">Delete form</button>`}
        <a class="btn btn-secondary" href="/admin/forms">Back</a>
      </div>
    </form>
    ${
      isNew
        ? ""
        : `
      <section class="forms-builder-section">
        <div class="forms-builder-header">
          <h2>Fields</h2>
          <button type="button" class="btn btn-secondary" id="add-field-btn">Add field</button>
        </div>
        <div id="fields-list" class="forms-fields-list">
          <p class="muted">Loading fields…</p>
        </div>
      </section>
    `
    }
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
            <th>Date</th>
            <th>Status</th>
            <th>ID</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="submissions-table-body">
          <tr><td colspan="4" class="muted">Loading…</td></tr>
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
