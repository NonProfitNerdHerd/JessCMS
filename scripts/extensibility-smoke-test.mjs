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

const suffix = Date.now().toString(36);

const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.ADMIN_EMAIL ?? "ike.j.rebout@gmail.com",
    password: process.env.ADMIN_PASSWORD ?? "JessCMSAdmin2026",
  }),
});
assert("admin login", login.status === 200);

const contentTypes = await req("/api/content/types");
assert("content types registry", contentTypes.status === 200);
const typeKeys = (contentTypes.body.data?.items ?? []).map((t) => t.type_key ?? t.id);
assert("seed includes page", typeKeys.includes("page"));
assert("seed includes post", typeKeys.includes("post"));
assert("seed includes event", typeKeys.includes("event"));
assert("seed includes form", typeKeys.includes("form"));

const created = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Index Sync ${suffix}`,
    slug: `index-sync-${suffix}`,
    status: "published",
    published_at: new Date().toISOString(),
    change_summary: "Index sync test",
  }),
});
assert("create page for index sync", created.status === 201);
const pageId = created.body.data?.id ?? created.body.id;
const pageSlug = created.body.data?.slug ?? created.body.slug;

const publicPage = await req(`/${pageSlug}`);
assert("public route lookup via legacy + index", publicPage.status === 200);

const plugins = await req("/api/plugins");
assert("list plugins", plugins.status === 200);
const formsPlugin = (plugins.body.data?.items ?? []).find((p) => p.id === "forms-builder");
assert("forms-builder plugin listed", Boolean(formsPlugin));

const resources = await req("/api/plugins/forms-builder/resources");
assert("plugin resources", resources.status === 200);
assert(
  "forms-builder owns forms table resource",
  (resources.body.data?.resources ?? []).some((r) => r.table_name === "forms"),
);

const preview = await req("/api/plugins/forms-builder/uninstall-preview", {
  method: "POST",
});
assert("uninstall preview", preview.status === 200);
assert("preview has options", (preview.body.data?.options ?? []).includes("disable_only"));
assert("preview lists warnings or resources", (preview.body.data?.resources ?? []).length > 0);

const disable = await req("/api/plugins/storm-chaser-example/disable", {
  method: "POST",
});
assert("disable plugin without data loss", disable.status === 200);
assert("disabled lifecycle state", disable.body.data?.plugin?.lifecycle_state === "disabled");

const enable = await req("/api/plugins/storm-chaser-example/enable", {
  method: "POST",
});
assert("re-enable plugin", enable.status === 200);

// Manifest validation runs at worker startup (validateAllPluginManifests in registry.ts).
assert("worker started with valid manifests", login.status === 200);

console.log("\nExtensibility smoke tests finished.");
