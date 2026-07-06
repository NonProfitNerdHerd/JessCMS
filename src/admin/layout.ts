import type { AuthUser } from "../auth";
import type { AdminNavSection } from "../runtime/navigation";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNavSections(sections: AdminNavSection[] = []): string {
  return sections
    .map((section) => {
      const links = section.items
        .map(
          (item) =>
            `<a class="admin-nav-link" href="${escapeHtml(item.href)}"><span class="admin-nav-icon">${item.icon}</span>${escapeHtml(item.label)}</a>`,
        )
        .join("");

      if (!section.label) {
        return links;
      }

      return `<div class="admin-nav-section">
        <p class="admin-nav-section-label">${escapeHtml(section.label)}</p>
        ${links}
      </div>`;
    })
    .join("");
}

export interface AdminPageOptions {
  title: string;
  page: string;
  user?: AuthUser | null;
  content: string;
  data?: Record<string, string>;
  standalone?: boolean;
  extraScripts?: string[];
  navSections?: AdminNavSection[];
}

export function renderAdminPage(options: AdminPageOptions): string {
  const dataAttrs = Object.entries(options.data ?? {})
    .map(([key, value]) => ` data-${key}="${escapeHtml(value)}"`)
    .join("");

  const isContentEdit =
    options.page === "content-edit" || options.page === "generic-content-edit";
  const needsMediaLibrary = isContentEdit || options.page.startsWith("media");
  const needsFormsBuilder = isContentEdit || options.page.startsWith("forms");
  const blockStyles = isContentEdit
    ? '  <link rel="stylesheet" href="/blocks.css">\n'
    : "";
  const scriptSources = [
    ...(needsMediaLibrary ? ["/admin/media-library.js"] : []),
    ...(needsFormsBuilder ? ["/admin/forms-builder.js"] : []),
    ...(isContentEdit
      ? ["/admin/block-render.js", "/admin/block-editor.js", "/admin/workflow-revisions.js"]
      : []),
    ...(options.extraScripts ?? []),
  ];

  const extraScripts = scriptSources
    .map((src) => `  <script src="${src}" defer></script>`)
    .join("\n");

  const scriptTags = `${extraScripts}
  <script src="/admin/app.js" defer></script>`;

  if (options.standalone) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title)} · JessCMS</title>
  <link rel="stylesheet" href="/admin/styles.css">
${blockStyles}</head>
<body class="admin-body admin-standalone" data-page="${escapeHtml(options.page)}"${dataAttrs}>
  ${options.content}
${scriptTags}
</body>
</html>`;
  }

  const userLabel = options.user
    ? escapeHtml(options.user.name ?? options.user.email)
    : "Admin";

  const nav = renderNavSections(options.navSections);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title)} · JessCMS Admin</title>
  <link rel="stylesheet" href="/admin/styles.css">
${blockStyles}</head>
<body class="admin-body" data-page="${escapeHtml(options.page)}"${dataAttrs}>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="admin-brand">JessCMS</div>
      <nav class="admin-nav">${nav}</nav>
    </aside>
    <div class="admin-main">
      <header class="admin-header">
        <div>
          <h1 class="admin-page-title">${escapeHtml(options.title)}</h1>
          <p class="admin-user-label">Signed in as <a class="admin-user-link" href="/admin/profile">${userLabel}</a></p>
        </div>
        <div class="admin-header-actions">
          <button type="button" class="btn btn-secondary" id="logout-btn">Logout</button>
        </div>
      </header>
      <main class="admin-content">
        ${options.content}
      </main>
    </div>
  </div>
${scriptTags}
</body>
</html>`;
}

export function htmlResponse(html: string, status = 200, headers?: HeadersInit): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...Object.fromEntries(new Headers(headers).entries()),
    },
  });
}

export function redirectResponse(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: {
      Location: location,
    },
  });
}
