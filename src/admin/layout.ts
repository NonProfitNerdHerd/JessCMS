import type { AuthUser } from "../auth";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/admin/pages", label: "Pages", icon: "📄" },
  { href: "/admin/posts", label: "Posts", icon: "✎" },
  { href: "/admin/events", label: "Events", icon: "📅" },
  { href: "/admin/settings/theme", label: "Theme", icon: "🎨" },
  { href: "/admin/plugins", label: "Plugins", icon: "🧩" },
];

export interface AdminPageOptions {
  title: string;
  page: string;
  user?: AuthUser | null;
  content: string;
  data?: Record<string, string>;
  standalone?: boolean;
}

export function renderAdminPage(options: AdminPageOptions): string {
  const dataAttrs = Object.entries(options.data ?? {})
    .map(([key, value]) => ` data-${key}="${escapeHtml(value)}"`)
    .join("");

  if (options.standalone) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title)} · JessCMS</title>
  <link rel="stylesheet" href="/admin/styles.css">
</head>
<body class="admin-body admin-standalone" data-page="${escapeHtml(options.page)}"${dataAttrs}>
  ${options.content}
  <script src="/admin/app.js" defer></script>
</body>
</html>`;
  }

  const userLabel = options.user
    ? escapeHtml(options.user.name ?? options.user.email)
    : "Admin";

  const nav = NAV_ITEMS.map(
    (item) =>
      `<a class="admin-nav-link" href="${item.href}"><span class="admin-nav-icon">${item.icon}</span>${item.label}</a>`,
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title)} · JessCMS Admin</title>
  <link rel="stylesheet" href="/admin/styles.css">
</head>
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
          <p class="admin-user-label">Signed in as ${userLabel}</p>
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
  <script src="/admin/app.js" defer></script>
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
