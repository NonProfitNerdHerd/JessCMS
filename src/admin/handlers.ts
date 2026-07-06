import { getCurrentUser } from "../auth";
import {
  htmlResponse,
  redirectResponse,
  renderAdminPage,
} from "./layout";

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
    <form id="content-form" class="admin-form">
      <div id="form-error" class="alert alert-error hidden"></div>
      <div class="form-grid">
        <label class="field"><span>Title</span><input class="input" name="title" required></label>
        <label class="field"><span>Slug</span><input class="input" name="slug" required pattern="[a-z0-9-]+"></label>
        <label class="field"><span>Status</span>
          <select class="select" name="status">
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label class="field"><span>Published at</span><input class="input" name="published_at" type="datetime-local"></label>
        <label class="field field-wide"><span>Excerpt</span><textarea class="textarea" name="excerpt" rows="2"></textarea></label>
        <label class="field"><span>Template</span><input class="input" name="template"></label>
        <label class="field"><span>Featured image ID</span><input class="input" name="featured_image_id"></label>
        <label class="field"><span>SEO title</span><input class="input" name="seo_title"></label>
        <label class="field field-wide"><span>SEO description</span><textarea class="textarea" name="seo_description" rows="2"></textarea></label>
      </div>
      ${eventFields}
      <label class="field field-wide"><span>Content JSON</span><textarea class="textarea code" name="content_json" rows="8" placeholder='{"version":1,"blocks":[]}'></textarea></label>
      <label class="field field-wide"><span>Content HTML</span><textarea class="textarea code" name="content_html" rows="8"></textarea></label>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" data-action="draft">Save draft</button>
        <button type="button" class="btn btn-primary" data-action="publish">Publish</button>
        <button type="button" class="btn btn-secondary" data-action="archive">Archive</button>
        <button type="button" class="btn btn-danger" data-action="delete">Delete</button>
      </div>
    </form>
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

function renderDashboard(user: Awaited<ReturnType<typeof getCurrentUser>>): string {
  return renderAdminPage({
    title: "Dashboard",
    page: "dashboard",
    user,
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
        <a class="card-link" href="/admin/settings/theme">Theme settings</a>
        <a class="card-link" href="/admin/plugins">Plugins</a>
      </div>
    `,
  });
}

function renderThemePage(user: Awaited<ReturnType<typeof getCurrentUser>>): string {
  return renderAdminPage({
    title: "Theme Settings",
    page: "theme",
    user,
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

function renderProfilePage(user: Awaited<ReturnType<typeof getCurrentUser>>): string {
  return renderAdminPage({
    title: "Profile",
    page: "profile",
    user,
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

function renderPluginsPage(user: Awaited<ReturnType<typeof getCurrentUser>>): string {
  return renderAdminPage({
    title: "Plugins",
    page: "plugins",
    user,
    content: `
      <div id="plugins-error" class="alert alert-error hidden"></div>
      <div class="table-wrap">
        <table class="admin-table" id="plugins-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>ID</th>
              <th>Version</th>
              <th>Description</th>
              <th>Enabled</th>
            </tr>
          </thead>
          <tbody id="plugins-table-body">
            <tr><td colspan="5" class="muted">Loading…</td></tr>
          </tbody>
        </table>
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

  if (pathname === "/admin/dashboard") {
    return htmlResponse(renderDashboard(user));
  }

  if (pathname === "/admin/pages") {
    return htmlResponse(
      renderAdminPage({
        title: "Pages",
        page: "content-list",
        user,
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
        data: { type: "events", id: eventEdit[1], label: "Event" },
        content: editPageShell("events", "Event", true),
      }),
    );
  }

  if (pathname === "/admin/settings/theme") {
    return htmlResponse(renderThemePage(user));
  }

  if (pathname === "/admin/plugins") {
    return htmlResponse(renderPluginsPage(user));
  }

  if (pathname === "/admin/profile") {
    return htmlResponse(renderProfilePage(user));
  }

  return null;
}
