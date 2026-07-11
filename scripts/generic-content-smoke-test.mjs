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
const slug = `test-chase-${suffix}`;

const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.ADMIN_EMAIL ?? "ike.j.rebout@gmail.com",
    password: process.env.ADMIN_PASSWORD ?? "JessCMSAdmin2026",
  }),
});
assert("admin login", login.status === 200);

await req("/api/plugins/storm-chaser-example/enable", { method: "POST" });
const sync = await req("/api/runtime/sync", { method: "POST" });
assert("runtime sync", sync.status === 200);

const runtimeTypes = await req("/api/runtime/content-types");
const chaseType = (runtimeTypes.body.data?.items ?? runtimeTypes.body.data ?? []).find(
  (t) => (t.type_key ?? t.key) === "chase",
);
assert("plugin sync registers chase content type", Boolean(chaseType));

const listAdmin = await req("/admin/content/chase");
assert("generic admin list loads for chase", listAdmin.status === 200);
assert(
  "generic admin list page marker",
  typeof listAdmin.body === "string" && listAdmin.body.includes("generic-content-list"),
);

const newAdmin = await req("/admin/content/chase/new");
assert("generic admin new page loads for chase", newAdmin.status === 200);
assert(
  "generic admin edit page marker",
  typeof newAdmin.body === "string" && newAdmin.body.includes("generic-content-edit"),
);

const invalid = await req("/api/content/chase", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Invalid Chase",
    slug: `invalid-${suffix}`,
    metadata: { risk_level: "Severe" },
  }),
});
assert("invalid metadata returns 400", invalid.status === 400);

const created = await req("/api/content/chase", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Chase ${suffix}`,
    slug,
    status: "draft",
    excerpt: "Test chase excerpt",
    metadata: {
      target_area: "Central Oklahoma",
      start_time: new Date().toISOString(),
      risk_level: "Moderate",
      primary_state: "OK",
    },
    change_summary: "Initial chase entry",
  }),
});
assert("create chase entry", created.status === 201);
const chaseId = created.body.data?.id ?? created.body.id;

const updated = await req(`/api/content/chase/${chaseId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    metadata: {
      target_area: "Western Oklahoma",
      start_time: new Date().toISOString(),
      risk_level: "High",
      primary_state: "OK",
    },
    change_summary: "Updated target area",
  }),
});
assert("update chase entry", updated.status === 200);

const published = await req(`/api/content/chase/${chaseId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    status: "published",
    published_at: new Date().toISOString(),
    change_summary: "Published chase",
  }),
});
assert("publish chase entry", published.status === 200);

const indexLookup = await req(`/api/content/chase/slug/${slug}`);
assert("content_index syncs chase slug lookup", indexLookup.status === 200);

const publicRoute = await req(`/chases/${slug}`);
assert("public route renders chase", publicRoute.status === 200);
assert(
  "public route includes chase title",
  typeof publicRoute.body === "string" &&
    publicRoute.body.includes(`Chase ${suffix}`),
);

const revisions = await req(`/api/content/chase/${chaseId}/revisions`);
const revisionItems = revisions.body.data?.items ?? revisions.body.items ?? [];
assert("revision created for chase", revisions.status === 200 && revisionItems.length >= 2);

const workflow = await req(`/api/content/chase/${chaseId}/workflow`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "archive", comment: "Test archive" }),
});
assert("workflow state works for chase", workflow.status === 200);

const typesEnabled = await req("/api/runtime/content-types");
const typeItems = typesEnabled.body.data?.items ?? typesEnabled.body.data ?? [];
assert(
  "enabled plugin shows chase content type",
  typeItems.some((item) => item.type_key === "chase" && item.admin_base === "/admin/content/chase"),
);

await req("/api/plugins/storm-chaser-example/disable", { method: "POST" });
await req("/api/runtime/sync", { method: "POST" });

const typesDisabled = await req("/api/runtime/content-types");
const typeItemsDisabled = typesDisabled.body.data?.items ?? typesDisabled.body.data ?? [];
assert(
  "disabling plugin hides chase content type from runtime",
  !typeItemsDisabled.some((item) => item.type_key === "chase"),
);

const afterDisable = await req(`/api/content/chase/${chaseId}`);
assert(
  "disabling plugin blocks generic API while type disabled",
  afterDisable.status === 400 || afterDisable.status === 403,
);

await req("/api/plugins/storm-chaser-example/enable", { method: "POST" });
await req("/api/runtime/sync", { method: "POST" });

const afterReEnable = await req(`/api/content/chase/${chaseId}`);
assert(
  "disabling plugin does not delete chase data",
  afterReEnable.status === 200 && (afterReEnable.body.data?.id ?? afterReEnable.body.id) === chaseId,
);

console.log("\nGeneric content smoke test complete.");
