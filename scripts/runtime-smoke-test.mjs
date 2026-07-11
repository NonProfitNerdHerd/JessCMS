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
  return { status: response.status, body };
}

function assert(name, condition) {
  console.log(condition ? `✓ ${name}` : `✗ ${name}`);
  if (!condition) process.exitCode = 1;
}

const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.ADMIN_EMAIL ?? "ike.j.rebout@gmail.com",
    password: process.env.ADMIN_PASSWORD ?? "JessCMSAdmin2026",
  }),
});
assert("admin login", login.status === 200);

const runtimePlugins = await req("/api/runtime/plugins");
assert("runtime plugins", runtimePlugins.status === 200);
assert("core plugin loaded", (runtimePlugins.body.data?.items ?? []).some((p) => p.manifest?.id === "jesscms-core"));

const contentTypes = await req("/api/runtime/content-types");
assert("runtime content types", contentTypes.status === 200);
const typeKeys = (contentTypes.body.data?.items ?? []).map((t) => t.type_key);
assert("includes page", typeKeys.includes("page"));
assert("includes form", typeKeys.includes("form"));

const blocks = await req("/api/runtime/blocks");
assert("runtime blocks", blocks.status === 200);
assert("includes paragraph block", (blocks.body.data?.items ?? []).some((b) => b.type === "paragraph"));
assert("includes form block when forms enabled", (blocks.body.data?.items ?? []).some((b) => b.type === "form"));

const routes = await req("/api/runtime/routes");
assert("runtime routes", routes.status === 200);
assert("includes admin routes", (routes.body.data?.items ?? []).some((r) => r.type === "admin"));

const navigation = await req("/api/runtime/navigation");
assert("runtime navigation", navigation.status === 200);
assert(
  "runtime navigation excludes core content duplicates",
  !(navigation.body.data?.items ?? []).some((n) => n.href === "/admin/pages"),
);
assert(
  "runtime navigation excludes theme settings duplicate",
  !(navigation.body.data?.items ?? []).some((n) => n.href === "/admin/settings/theme"),
);

const settings = await req("/api/runtime/settings");
assert("runtime settings", settings.status === 200);

const permissions = await req("/api/runtime/permissions");
assert("runtime permissions", permissions.status === 200);
assert("includes content:read", (permissions.body.data?.items ?? []).some((p) => p.slug === "content:read"));

const plugins = await req("/api/plugins");
assert("enriched plugins list", plugins.status === 200);
const formsPlugin = (plugins.body.data?.items ?? []).find((p) => p.id === "forms-builder");
assert("forms-builder has registered counts", typeof formsPlugin?.registered_blocks === "number");

const refresh = await req("/api/runtime/refresh", { method: "POST" });
assert("runtime refresh", refresh.status === 200);

const sync = await req("/api/runtime/sync", { method: "POST" });
assert("runtime sync", sync.status === 200);

const disable = await req("/api/plugins/storm-chaser-example/disable", { method: "POST" });
assert("disable plugin", disable.status === 200);

const afterDisable = await req("/api/runtime/blocks");
assert("alert_banner absent when storm disabled", !(afterDisable.body.data?.items ?? []).some((b) => b.type === "alert_banner"));
assert("radar_embed absent when storm disabled", !(afterDisable.body.data?.items ?? []).some((b) => b.type === "radar_embed"));

const enable = await req("/api/plugins/storm-chaser-example/enable", { method: "POST" });
assert("enable plugin", enable.status === 200);

const editorBlocks = await req("/api/editor/blocks");
assert("editor blocks from runtime", editorBlocks.status === 200);
assert("editor blocks count", (editorBlocks.body.data?.items ?? []).length > 0);

console.log("\nRuntime smoke test complete.");
