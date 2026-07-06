import { getAdminNavigation, type AdminNavSection } from "../runtime/navigation";
import { getCurrentUser, userHasPermission } from "../auth";
import { getContentTypeByKey } from "../content-types/registry";
import { isGenericContentType } from "../content-entries/registry";
import {
  genericEditPageShell,
  genericListPageShell,
} from "./generic-content-pages";
import {
  formsEditShell,
  formsListShell,
  formsSubmissionsShell,
  submissionDetailShell,
} from "../plugins/forms-builder/admin-pages";
import {
  htmlResponse,
  redirectResponse,
  renderAdminPage,
  type AdminPageOptions,
} from "./layout";

type AdminNavigation = AdminNavSection[];

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login"]);

function listPageShell(type: string, label: string): string {
  return `
    <div class="admin-toolbar">
      <a class="btn btn-primary" href="/admin/${type}/new">New ${label}</a>
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

function editPageShell(type: string, label: string, isEvent = false): string {
  const eventFields = isEvent
    ? `
      <div class="form-grid">
        <label class="field"><span>Start datetime</span><input class="input" name="start_datetime" type="datetime-local"></label>
        <label class="field"><span>End datetime</span><input class="input" name="end_datetime" type="datetime-local"></label>
        <label class="field"><span>Location name</span><input class="input" name="location_name"></label>
        <label class="field"><span>Location address</span><input class="input" name="location_address"></label>
        <label class="field"><span>Latitude</span><input class="input" name="latitude" type="number" step="any"></label>
        <label class="field"><span>Longitude</span><input class="input" name="longitude" type="number" step="any"></label>
        <label class="field"><span>Timezone</span><input class="input" name="timezone" value="UTC"></label>
        <label class="field"><span>Event status</span>
          <select class="select" name="event_status">
            <option value="scheduled">Scheduled</option>
            <option value="cancelled">Cancelled</option>
            <option value="postponed">Postponed</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>
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
        <label class="field"><span>Template</span><input class="input" name="template"></label>
        <input type="hidden" name="status" value="draft">
        <div class="field field-wide featured-image-field" data-featured-image-field>
          <span class="field-label">Featured image</span>
          <input type="hidden" name="featured_image_id">
          <div class="featured-image-preview muted" data-featured-image-preview>No image selected</div>
          <div class="featured-image-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-featured-image-select>Select from library</button>
            <button type="button" class="btn btn-secondary btn-sm hidden" data-featured-image-clear>Clear</button>
          </div>
        </div>
        <label class="field"><span>SEO title</span><input class="input" name="seo_title"></label>
        <label class="field field-wide"><span>SEO description</span><textarea class="textarea" name="seo_description" rows="2"></textarea></label>
      </div>
      ${eventFields}
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
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" data-action="save">Save</button>
        <button type="button" class="btn btn-danger" data-action="delete">Delete</button>
      </div>
    </form>
      </div>
      <aside class="content-edit-sidebar" id="content-sidebar">
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
        </section>
        <section class="admin-panel" id="revisions-panel">
          <h2 class="admin-panel-title">Revision history</h2>
          <div id="revisions-error" class="alert alert-error hidden"></div>
          <div id="revisions-list" class="revisions-list"></div>
          <div id="revision-compare" class="revision-compare hidden"></div>
        </section>
      </aside>
    </div>
  `;
}

function renderLoginPage(): string {
  return renderAdminPage({
    title: "Login",
    page: "login",
    standalone: true,
    content: `
      <div class="login-card">
        <h1>JessCMS Admin</h1>
        <p class="muted">Sign in to manage content.</p>
        <div id="login-error" class="alert alert-error hidden"></div>
        <form id="login-form" class="admin-form">
          <label class="field"><span>Email</span><input class="input" type="email" name="email" required autocomplete="username"></label>
          <label class="field"><span>Password</span><input class="input" type="password" name="password" required autocomplete="current-password"></label>
          <button type="submit" class="btn btn-primary btn-block">Sign in</button>
        </form>
      </div>
    `,
  });
}

function renderDashboard(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  navSections: AdminNavigation,
): string {
  return renderAdminPage({
    title: "Dashboard",
    page: "dashboard",
    user,
    navSections,
    content: `
      <div class="stats-grid" id="dashboard-stats">
        <div class="stat-card"><span class="stat-label">Pages</span><strong class="stat-value" data-stat="pages">…</strong></div>
        <div class="stat-card"><span class="stat-label">Posts</span><strong class="stat-value" data-stat="posts">…</strong></div>
        <div class="stat-card"><span class="stat-label">Events</span><strong class="stat-value" data-stat="events">…</strong></div>
      </div>
      <div class="quick-links">
        <a class="card-link" href="/admin/pages">Manage pages</a>
        <a class="card-link" href="/admin/posts">Manage posts</a>
        <a class="card-link" href="/admin/events">Manage events</a>
        <a class="card-link" href="/admin/media">Media library</a>
        <a class="card-link" href="/admin/forms">Forms</a>
        <a class="card-link" href="/admin/settings/theme">Theme settings</a>
        <a class="card-link" href="/admin/plugins">Plugins</a>
      </div>
    `,
  });
}

function renderThemePage(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  navSections: AdminNavigation,
): string {
  return renderAdminPage({
    title: "Theme Settings",
    page: "theme",
    user,
    navSections,
    content: `
      <div id="theme-error" class="alert alert-error hidden"></div>
      <div id="theme-success" class="alert alert-success hidden"></div>
      <form id="theme-form" class="admin-form">
        <div class="form-grid">
          <label class="field"><span>Site name</span><input class="input" name="site_name"></label>
          <label class="field"><span>Logo URL</span><input class="input" name="logo_url"></label>
          <label class="field"><span>Favicon URL</span><input class="input" name="favicon_url"></label>
          <label class="field"><span>Primary color</span><input class="input" name="primary_color" type="color"></label>
          <label class="field"><span>Secondary color</span><input class="input" name="secondary_color" type="color"></label>
          <label class="field"><span>Background color</span><input class="input" name="background_color" type="color"></label>
          <label class="field"><span>Text color</span><input class="input" name="text_color" type="color"></label>
          <label class="field"><span>Heading font</span><input class="input" name="heading_font"></label>
          <label class="field"><span>Body font</span><input class="input" name="body_font"></label>
          <label class="field"><span>Layout width</span><input class="input" name="layout_width"></label>
          <label class="field field-wide"><span>Button style (JSON)</span><textarea class="textarea code" name="button_style" rows="3"></textarea></label>
          <label class="field field-wide"><span>Custom CSS</span><textarea class="textarea code" name="custom_css" rows="6"></textarea></label>
        </div>
        <button type="submit" class="btn btn-primary">Save theme settings</button>
      </form>
    `,
  });
}

function renderProfilePage(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  navSections: AdminNavigation,
): string {
  return renderAdminPage({
    title: "Profile",
    page: "profile",
    user,
    navSections,
    content: `
      <div id="profile-error" class="alert alert-error hidden"></div>
      <div id="profile-success" class="alert alert-success hidden"></div>
      <form id="profile-form" class="admin-form">
        <section class="profile-section">
          <h2 class="profile-section-title">Account</h2>
          <div class="form-grid">
            <label class="field"><span>Name</span><input class="input" name="name" required autocomplete="name"></label>
            <label class="field"><span>Email</span><input class="input" type="email" name="email" required autocomplete="email"></label>
          </div>
        </section>
        <section class="profile-section">
          <h2 class="profile-section-title">Change password</h2>
          <p class="muted profile-hint">Leave blank to keep your current password.</p>
          <div class="form-grid">
            <label class="field"><span>New password</span><input class="input" type="password" name="new_password" autocomplete="new-password" minlength="12"></label>
            <label class="field"><span>Confirm new password</span><input class="input" type="password" name="confirm_password" autocomplete="new-password" minlength="12"></label>
          </div>
        </section>
        <section class="profile-section">
          <h2 class="profile-section-title">Confirm changes</h2>
          <p class="muted profile-hint">Enter your current password to save any changes.</p>
          <label class="field field-wide"><span>Current password</span><input class="input" type="password" name="current_password" required autocomplete="current-password"></label>
        </section>
        <button type="submit" class="btn btn-primary">Save profile</button>
      </form>
    `,
  });
}

function mediaFormShell(isNew: boolean): string {
  const uploadPanel = isNew
    ? `
      <div class="media-mode-tabs">
        <button type="button" class="btn btn-secondary btn-sm media-mode-tab is-active" data-media-mode="upload">Upload file</button>
        <button type="button" class="btn btn-secondary btn-sm media-mode-tab" data-media-mode="url">External URL</button>
      </div>
      <section class="media-upload-panel" data-media-panel="upload">
        <div class="media-upload-dropzone" id="media-upload-dropzone">
          <input type="file" id="media-upload-input" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf" hidden>
          <p class="media-upload-title">Drag and drop a file here</p>
          <p class="muted">JPEG, PNG, WebP, GIF, SVG, or PDF up to 10 MB</p>
          <button type="button" class="btn btn-secondary btn-sm" id="media-upload-browse">Choose file</button>
          <p class="muted media-upload-name" id="media-upload-name"></p>
          <div class="media-upload-progress hidden" id="media-upload-progress">
            <div class="media-upload-progress-bar" id="media-upload-progress-bar"></div>
          </div>
        </div>
        <div class="form-grid">
          <label class="field"><span>Title</span><input class="input" name="upload_title"></label>
          <label class="field"><span>Folder</span><input class="input" name="upload_folder" placeholder="e.g. uploads"></label>
          <label class="field field-wide"><span>Alt text</span><input class="input" name="upload_alt_text"></label>
          <label class="field field-wide"><span>Caption</span><input class="input" name="upload_caption"></label>
          <label class="field field-wide"><span>Description</span><textarea class="textarea" name="upload_description" rows="3"></textarea></label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-primary" id="media-upload-submit">Upload</button>
          <a class="btn btn-secondary" href="/admin/media">Back to library</a>
        </div>
      </section>
      <section class="media-url-panel hidden" data-media-panel="url">
    `
    : "";

  const urlPanelClose = isNew ? `</section>` : "";

  return `
    <div id="media-error" class="alert alert-error hidden"></div>
    <div id="media-success" class="alert alert-success hidden"></div>
    ${uploadPanel}
    <form id="media-form" class="admin-form ${isNew ? "media-url-form" : ""}">
      <div class="media-edit-layout">
        <div class="media-preview-panel">
          <div class="media-preview-box" id="media-preview">
            <p class="muted">Preview will appear here</p>
          </div>
          <div class="media-url-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="copy-url-btn">Copy URL</button>
          </div>
          <p class="muted media-storage-label" id="media-storage-label"></p>
        </div>
        <div class="media-fields-panel">
          <div class="form-grid">
            <label class="field field-wide"><span>Public URL</span><input class="input" name="public_url" ${isNew ? "placeholder=\"https://example.com/image.jpg\"" : "readonly"}></label>
            <label class="field"><span>Title</span><input class="input" name="title"></label>
            <label class="field"><span>Filename</span><input class="input" name="filename"></label>
            <label class="field"><span>Folder</span><input class="input" name="folder" placeholder="e.g. uploads"></label>
            <label class="field"><span>MIME type</span><input class="input" name="mime_type" placeholder="image/jpeg" ${isNew ? "" : "readonly"}></label>
            <label class="field"><span>File size (bytes)</span><input class="input" name="file_size" type="number" min="0" ${isNew ? "" : "readonly"}></label>
            <label class="field"><span>Width</span><input class="input" name="width" type="number" min="0"></label>
            <label class="field"><span>Height</span><input class="input" name="height" type="number" min="0"></label>
            <label class="field field-wide"><span>Alt text</span><input class="input" name="alt_text"></label>
            <label class="field field-wide"><span>Caption</span><input class="input" name="caption"></label>
            <label class="field field-wide"><span>Description</span><textarea class="textarea" name="description" rows="3"></textarea></label>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${isNew ? "Add URL media" : "Save changes"}</button>
            ${isNew ? "" : '<button type="button" class="btn btn-danger" id="delete-media-btn">Delete</button>'}
            <a class="btn btn-secondary" href="/admin/media">Back to library</a>
          </div>
        </div>
      </div>
    </form>
    ${urlPanelClose}
  `;
}

function renderMediaLibraryPage(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  navSections: AdminNavigation,
): string {
  return renderAdminPage({
    title: "Media Library",
    page: "media-list",
    user,
    navSections,
    content: `
      <div class="admin-toolbar">
        <a class="btn btn-primary" href="/admin/media/new">Upload / Add media</a>
        <form class="admin-filters" id="media-filter-form">
          <input type="search" name="q" placeholder="Search media" class="input">
          <select name="mime_type" class="select">
            <option value="">All types</option>
            <option value="image/*">Images</option>
            <option value="video/*">Videos</option>
            <option value="application/pdf">PDF</option>
          </select>
          <select name="folder" class="select" id="media-folder-filter">
            <option value="">All folders</option>
          </select>
          <button type="submit" class="btn btn-secondary">Filter</button>
        </form>
      </div>
      <div id="media-error" class="alert alert-error hidden"></div>
      <div class="media-grid" id="media-grid">
        <p class="muted">Loading media…</p>
      </div>
      <div class="admin-pagination" id="media-pagination"></div>
    `,
  });
}

function renderPluginsPage(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  navSections: AdminNavigation,
): string {
  return renderAdminPage({
    title: "Plugins",
    page: "plugins",
    user,
    navSections,
    content: `
      <div id="plugins-error" class="alert alert-error hidden"></div>
      <div id="plugins-success" class="alert alert-success hidden"></div>
      <div class="table-wrap">
        <table class="admin-table" id="plugins-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>ID</th>
              <th>Version</th>
              <th>Status</th>
              <th>Registered</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="plugins-table-body">
            <tr><td colspan="7" class="muted">Loading…</td></tr>
          </tbody>
        </table>
      </div>
      <div id="plugin-uninstall-panel" class="admin-panel hidden">
        <h2 class="admin-panel-title">Uninstall preview</h2>
        <div id="plugin-uninstall-preview" class="muted"></div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-uninstall-mode="disable_only">Disable only</button>
          <button type="button" class="btn btn-secondary btn-sm" data-uninstall-mode="uninstall_retain">Uninstall, retain data</button>
          <button type="button" class="btn btn-secondary btn-sm" data-uninstall-mode="uninstall_archive">Uninstall, archive data</button>
          <button type="button" class="btn btn-danger btn-sm" data-uninstall-mode="uninstall_delete">Uninstall, delete owned entities</button>
        </div>
      </div>
    `,
  });
}

export async function handleAdminRequest(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "GET" || !url.pathname.startsWith("/admin")) {
    return null;
  }

  const pathname = url.pathname.replace(/\/+$/, "") || "/admin";
  const user = await getCurrentUser(request, env);

  if (!PUBLIC_ADMIN_PATHS.has(pathname) && !user) {
    return redirectResponse("/admin/login");
  }

  if (pathname === "/admin/login" && user) {
    return redirectResponse("/admin/dashboard");
  }

  if (pathname === "/admin" || pathname === "/admin/") {
    return redirectResponse(user ? "/admin/dashboard" : "/admin/login");
  }

  if (pathname === "/admin/login") {
    return htmlResponse(renderLoginPage());
  }

  if (!user) {
    return redirectResponse("/admin/login");
  }

  const navSections = await getAdminNavigation(env, user);

  if (pathname === "/admin/dashboard") {
    return htmlResponse(renderDashboard(user, navSections));
  }

  if (pathname === "/admin/pages") {
    return htmlResponse(
      renderAdminPage({
        title: "Pages",
        page: "content-list",
        user,
        navSections,
        data: { type: "pages", label: "Page" },
        content: listPageShell("pages", "Page"),
      }),
    );
  }

  if (pathname === "/admin/pages/new") {
    return htmlResponse(
      renderAdminPage({
        title: "New Page",
        page: "content-edit",
        user,
        navSections,
        data: { type: "pages", id: "new", label: "Page" },
        content: editPageShell("pages", "Page"),
      }),
    );
  }

  const pageEdit = pathname.match(/^\/admin\/pages\/([^/]+)$/);
  if (pageEdit) {
    return htmlResponse(
      renderAdminPage({
        title: "Edit Page",
        page: "content-edit",
        user,
        navSections,
        data: { type: "pages", id: pageEdit[1], label: "Page" },
        content: editPageShell("pages", "Page"),
      }),
    );
  }

  if (pathname === "/admin/posts") {
    return htmlResponse(
      renderAdminPage({
        title: "Posts",
        page: "content-list",
        user,
        navSections,
        data: { type: "posts", label: "Post" },
        content: listPageShell("posts", "Post"),
      }),
    );
  }

  if (pathname === "/admin/posts/new") {
    return htmlResponse(
      renderAdminPage({
        title: "New Post",
        page: "content-edit",
        user,
        navSections,
        data: { type: "posts", id: "new", label: "Post" },
        content: editPageShell("posts", "Post"),
      }),
    );
  }

  const postEdit = pathname.match(/^\/admin\/posts\/([^/]+)$/);
  if (postEdit) {
    return htmlResponse(
      renderAdminPage({
        title: "Edit Post",
        page: "content-edit",
        user,
        navSections,
        data: { type: "posts", id: postEdit[1], label: "Post" },
        content: editPageShell("posts", "Post"),
      }),
    );
  }

  if (pathname === "/admin/events") {
    return htmlResponse(
      renderAdminPage({
        title: "Events",
        page: "content-list",
        user,
        navSections,
        data: { type: "events", label: "Event" },
        content: listPageShell("events", "Event"),
      }),
    );
  }

  if (pathname === "/admin/events/new") {
    return htmlResponse(
      renderAdminPage({
        title: "New Event",
        page: "content-edit",
        user,
        navSections,
        data: { type: "events", id: "new", label: "Event" },
        content: editPageShell("events", "Event", true),
      }),
    );
  }

  const eventEdit = pathname.match(/^\/admin\/events\/([^/]+)$/);
  if (eventEdit) {
    return htmlResponse(
      renderAdminPage({
        title: "Edit Event",
        page: "content-edit",
        user,
        navSections,
        data: { type: "events", id: eventEdit[1], label: "Event" },
        content: editPageShell("events", "Event", true),
      }),
    );
  }

  if (pathname === "/admin/settings/theme") {
    return htmlResponse(renderThemePage(user, navSections));
  }

  if (pathname === "/admin/media") {
    return htmlResponse(renderMediaLibraryPage(user, navSections));
  }

  if (pathname === "/admin/forms") {
    return htmlResponse(
      renderAdminPage({
        title: "Forms",
        page: "forms-list",
        user,
        navSections,
        content: formsListShell(),
      }),
    );
  }

  if (pathname === "/admin/forms/new") {
    return htmlResponse(
      renderAdminPage({
        title: "New Form",
        page: "forms-new",
        user,
        navSections,
        data: { id: "new" },
        content: formsEditShell(true),
      }),
    );
  }

  const formSubmissions = pathname.match(/^\/admin\/forms\/([^/]+)\/submissions$/);
  if (formSubmissions) {
    return htmlResponse(
      renderAdminPage({
        title: "Form Submissions",
        page: "forms-submissions",
        user,
        navSections,
        data: { formId: formSubmissions[1] },
        content: formsSubmissionsShell(),
      }),
    );
  }

  const submissionDetail = pathname.match(/^\/admin\/forms\/submissions\/([^/]+)$/);
  if (submissionDetail) {
    return htmlResponse(
      renderAdminPage({
        title: "Submission",
        page: "forms-submission-detail",
        user,
        navSections,
        data: { submissionId: submissionDetail[1] },
        content: submissionDetailShell(),
      }),
    );
  }

  const formEdit = pathname.match(/^\/admin\/forms\/([^/]+)$/);
  if (formEdit && formEdit[1] !== "new") {
    return htmlResponse(
      renderAdminPage({
        title: "Edit Form",
        page: "forms-edit",
        user,
        navSections,
        data: { id: formEdit[1] },
        content: formsEditShell(false),
      }),
    );
  }

  if (pathname === "/admin/media/new") {
    return htmlResponse(
      renderAdminPage({
        title: "Add Media",
        page: "media-new",
        user,
        navSections,
        data: { id: "new" },
        content: mediaFormShell(true),
      }),
    );
  }

  const mediaEdit = pathname.match(/^\/admin\/media\/([^/]+)$/);
  if (mediaEdit && mediaEdit[1] !== "new") {
    return htmlResponse(
      renderAdminPage({
        title: "Edit Media",
        page: "media-edit",
        user,
        navSections,
        data: { id: mediaEdit[1] },
        content: mediaFormShell(false),
      }),
    );
  }

  if (pathname === "/admin/plugins") {
    return htmlResponse(renderPluginsPage(user, navSections));
  }

  if (pathname === "/admin/profile") {
    return htmlResponse(renderProfilePage(user, navSections));
  }

  const genericList = pathname.match(/^\/admin\/content\/([^/]+)$/);
  if (genericList) {
    const typeKey = genericList[1];
    if (typeKey === "new") return null;
    if (!isGenericContentType(typeKey)) {
      return null;
    }
    const contentType = await getContentTypeByKey(env.DB, typeKey);
    if (!contentType?.enabled) {
      return null;
    }
    return htmlResponse(
      renderAdminPage({
        title: contentType.plural_label,
        page: "generic-content-list",
        user,
        navSections,
        data: { type: `content/${typeKey}`, label: contentType.label, mode: "generic" },
        content: genericListPageShell(contentType),
      }),
    );
  }

  const genericNew = pathname.match(/^\/admin\/content\/([^/]+)\/new$/);
  if (genericNew) {
    const typeKey = genericNew[1];
    if (!isGenericContentType(typeKey)) {
      return null;
    }
    const contentType = await getContentTypeByKey(env.DB, typeKey);
    if (!contentType?.enabled) {
      return null;
    }
    return htmlResponse(
      renderAdminPage({
        title: `New ${contentType.label}`,
        page: "generic-content-edit",
        user,
        navSections,
        data: {
          type: `content/${typeKey}`,
          id: "new",
          label: contentType.label,
          mode: "generic",
        },
        content: genericEditPageShell(contentType),
      }),
    );
  }

  const genericEdit = pathname.match(/^\/admin\/content\/([^/]+)\/([^/]+)$/);
  if (genericEdit && genericEdit[2] !== "new") {
    const typeKey = genericEdit[1];
    if (!isGenericContentType(typeKey)) {
      return null;
    }
    const contentType = await getContentTypeByKey(env.DB, typeKey);
    if (!contentType?.enabled) {
      return null;
    }
    return htmlResponse(
      renderAdminPage({
        title: `Edit ${contentType.label}`,
        page: "generic-content-edit",
        user,
        navSections,
        data: {
          type: `content/${typeKey}`,
          id: genericEdit[2],
          label: contentType.label,
          mode: "generic",
        },
        content: genericEditPageShell(contentType),
      }),
    );
  }

  return null;
}
