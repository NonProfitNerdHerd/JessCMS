const base = process.env.BASE_URL ?? "http://127.0.0.1:8787";
const jar = {};

function parseSetCookie(response) {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    const [pair] = cookie.split(";");
    const [name, ...rest] = pair.split("=");
    jar[name] = rest.join("=");
  }
}

async function req(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  const cookieHeader = Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  if (cookieHeader) headers.Cookie = cookieHeader;

  const response = await fetch(`${base}${path}`, { ...options, headers });
  parseSetCookie(response);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("json")
    ? await response.json()
    : await response.text();
  return { status: response.status, body, headers: response.headers };
}

function assert(name, condition) {
  console.log(condition ? `✓ ${name}` : `✗ ${name}`);
  if (!condition) process.exitCode = 1;
}

const loginPage = await req("/admin/login");
assert("login page loads", loginPage.status === 200 && String(loginPage.body).includes("JessCMS Admin"));

const redirect = await fetch(`${base}/admin/dashboard`, { redirect: "manual" });
assert("dashboard redirects when logged out", redirect.status === 302);

const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@example.com", password: "ChangeMeNow123!" }),
});
assert("login works", login.status === 200);

const dashboard = await req("/admin/dashboard");
assert("dashboard loads", dashboard.status === 200 && String(dashboard.body).includes("Dashboard"));

const css = await req("/admin/styles.css");
assert("admin css served", css.status === 200 && String(css.body).includes(".admin-shell"));

const suffix = Date.now().toString(36);
const page = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Admin Test ${suffix}`,
    slug: `admin-test-${suffix}`,
    status: "draft",
    content_json: JSON.stringify({ version: 1, blocks: [] }),
  }),
});
assert("create page via API", page.status === 201);

const pageId = page.body.data?.id;
const editPage = await req(`/admin/pages/${pageId}`);
assert("edit page loads", editPage.status === 200 && String(editPage.body).includes("block-editor"));

const publish = await req(`/api/pages/${pageId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    status: "published",
    published_at: new Date().toISOString(),
  }),
});
assert("publish page", publish.status === 200);

const theme = await req("/api/theme/settings", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ site_name: "JessCMS Admin Test" }),
});
assert("update theme settings", theme.status === 200);

const plugins = await req("/api/plugins");
const pluginId = plugins.body.data?.items?.[0]?.id;
const toggle = await req(`/api/plugins/${pluginId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ enabled: false }),
});
assert("toggle plugin", toggle.status === 200);

await req(`/api/plugins/${pluginId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ enabled: true }),
});

const logout = await req("/api/auth/logout", { method: "POST" });
assert("logout works", logout.status === 200);

console.log("\nAdmin Phase 4 smoke test complete.");
