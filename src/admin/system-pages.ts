export function usersListShell(): string {
  return `
    <div class="admin-toolbar">
      <a class="btn btn-primary" href="/admin/users/new" id="users-new-btn">New user</a>
    </div>
    <div id="users-error" class="alert alert-error hidden" role="alert"></div>
    <div class="table-wrap">
      <table class="admin-table" id="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Roles</th>
            <th>Status</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="users-table-body">
          <tr><td colspan="6" class="muted">Loading…</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

export function usersFormShell(isNew: boolean): string {
  return `
    <div id="user-error" class="alert alert-error hidden" role="alert"></div>
    <div id="user-success" class="alert alert-success hidden" role="alert"></div>
    <form id="user-form" class="admin-form">
      <div class="form-group">
        <label for="user-name">Display name</label>
        <input type="text" id="user-name" name="name" class="input" required>
      </div>
      <div class="form-group">
        <label for="user-email">Email</label>
        <input type="email" id="user-email" name="email" class="input" required>
      </div>
      ${
        isNew
          ? `
      <div class="form-group">
        <label for="user-password">Password</label>
        <input type="password" id="user-password" name="password" class="input" minlength="12" required>
        <p class="form-hint">Minimum 12 characters.</p>
      </div>
      `
          : ""
      }
      <div class="form-group">
        <label>Roles</label>
        <div id="user-roles" class="checkbox-list muted">Loading roles…</div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Save</button>
        <a class="btn btn-secondary" href="/admin/users">Cancel</a>
      </div>
    </form>
    ${
      !isNew
        ? `
    <section class="admin-panel" id="user-actions-panel">
      <h2 class="admin-panel-title">Account actions</h2>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="user-reset-password-btn">Reset password</button>
        <button type="button" class="btn btn-secondary" id="user-toggle-active-btn">Toggle active</button>
      </div>
      <p class="form-hint" id="reset-password-hint">Admin-set temporary password (sessions are cleared).</p>
    </section>
    `
        : ""
    }
  `;
}

export function rolesListShell(): string {
  return `
    <div class="admin-toolbar">
      <button type="button" class="btn btn-primary" id="roles-new-btn">New role</button>
    </div>
    <div id="roles-error" class="alert alert-error hidden" role="alert"></div>
    <div class="table-wrap">
      <table class="admin-table" id="roles-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Permissions</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="roles-table-body">
          <tr><td colspan="4" class="muted">Loading…</td></tr>
        </tbody>
      </table>
    </div>
    <div id="role-create-panel" class="admin-panel hidden">
      <h2 class="admin-panel-title">Create role</h2>
      <form id="role-create-form" class="admin-form">
        <div class="form-group">
          <label for="role-slug">Slug</label>
          <input type="text" id="role-slug" name="slug" class="input" pattern="[a-z][a-z0-9_-]*" required>
        </div>
        <div class="form-group">
          <label for="role-name">Name</label>
          <input type="text" id="role-name" name="name" class="input" required>
        </div>
        <div class="form-group">
          <label for="role-description">Description</label>
          <textarea id="role-description" name="description" class="input" rows="2"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Create</button>
          <button type="button" class="btn btn-secondary" id="role-create-cancel">Cancel</button>
        </div>
      </form>
    </div>
  `;
}

export function roleEditShell(): string {
  return `
    <div id="role-error" class="alert alert-error hidden" role="alert"></div>
    <div id="role-success" class="alert alert-success hidden" role="alert"></div>
    <form id="role-form" class="admin-form">
      <div class="form-group">
        <label for="role-edit-name">Name</label>
        <input type="text" id="role-edit-name" name="name" class="input" required>
      </div>
      <div class="form-group">
        <label for="role-edit-description">Description</label>
        <textarea id="role-edit-description" name="description" class="input" rows="2"></textarea>
      </div>
      <div class="form-group">
        <label>Permissions</label>
        <div id="role-permissions" class="checkbox-list muted">Loading permissions…</div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Save permissions</button>
        <a class="btn btn-secondary" href="/admin/roles">Back to roles</a>
      </div>
    </form>
  `;
}

export function auditListShell(): string {
  return `
    <form class="admin-filters" id="audit-filter-form">
      <input type="search" name="q" placeholder="Search metadata" class="input">
      <select name="action" class="select" id="audit-action-filter">
        <option value="">All actions</option>
        <option value="create">create</option>
        <option value="update">update</option>
        <option value="delete">delete</option>
        <option value="publish">publish</option>
        <option value="login">login</option>
        <option value="login_failed">login_failed</option>
        <option value="logout">logout</option>
        <option value="disable">disable</option>
        <option value="enable">enable</option>
        <option value="reset_password">reset_password</option>
        <option value="restore">restore</option>
        <option value="rebuild">rebuild</option>
      </select>
      <input type="text" name="entity_type" placeholder="Entity type" class="input">
      <input type="text" name="actor_id" placeholder="Actor user ID" class="input">
      <input type="date" name="from" class="input">
      <input type="date" name="to" class="input">
      <button type="submit" class="btn btn-secondary">Filter</button>
    </form>
    <div id="audit-error" class="alert alert-error hidden" role="alert"></div>
    <div class="table-wrap">
      <table class="admin-table" id="audit-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Entity</th>
            <th>IP</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="audit-table-body">
          <tr><td colspan="6" class="muted">Loading…</td></tr>
        </tbody>
      </table>
    </div>
    <div id="audit-detail-panel" class="admin-panel hidden">
      <h2 class="admin-panel-title">Audit entry</h2>
      <pre id="audit-detail-json" class="code-block"></pre>
      <button type="button" class="btn btn-secondary btn-sm" id="audit-detail-close">Close</button>
    </div>
  `;
}

export function forbiddenShell(message: string): string {
  return `<p class="muted">${message}</p>`;
}
