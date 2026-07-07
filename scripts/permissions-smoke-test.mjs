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
const adminEmail = process.env.ADMIN_EMAIL ?? "ike.j.rebout@gmail.com";
const adminPassword = process.env.ADMIN_PASSWORD ?? "JessCMSAdmin2026";

const badLogin = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: adminEmail, password: "wrong-password-xyz" }),
});
assert("login failure returns 401", badLogin.status === 401);

const auditAfterFail = await req("/api/audit?action=login_failed&limit=5");
assert("audit list requires auth", auditAfterFail.status === 401);

const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: adminEmail, password: adminPassword }),
});
assert("admin login", login.status === 200);

const usersList = await req("/api/users");
assert("admin can list users", usersList.status === 200);
assert("users list has items", (usersList.body.data?.items ?? []).length >= 1);

const rolesList = await req("/api/roles");
assert("admin can list roles", rolesList.status === 200);

const permissionsList = await req("/api/permissions");
assert("admin can list permissions", permissionsList.status === 200);
assert(
  "audit:read permission exists",
  (permissionsList.body.data?.items ?? []).some((p) => p.slug === "audit:read"),
);

const newUserEmail = `phase13-${suffix}@example.com`;
const createUser = await req("/api/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: newUserEmail,
    name: `Phase13 User ${suffix}`,
    password: "TempPassword1234",
    role_ids: ["role_editor"],
  }),
});
assert("admin can create user", createUser.status === 201);
const newUserId = createUser.body.data?.id;

const assignRole = await req(`/api/users/${newUserId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ role_ids: ["role_viewer", "role_editor"] }),
});
assert("admin can assign roles", assignRole.status === 200);

const auditLogin = await req("/api/audit?action=login&limit=5");
assert("audit filters by action", auditLogin.status === 200);
assert(
  "login audited",
  (auditLogin.body.data?.items ?? []).some((e) => e.action === "login"),
);

const auditFailed = await req("/api/audit?action=login_failed&limit=10");
assert("login_failed audit filter works", auditFailed.status === 200);

const adminUsers = (usersList.body.data?.items ?? []).filter((u) =>
  (u.roles ?? []).some((r) => r.id === "role_admin"),
);
const soleAdmin = adminUsers.find((u) => u.is_active);
if (soleAdmin && adminUsers.filter((u) => u.is_active).length === 1) {
  const disableLast = await req(`/api/users/${soleAdmin.id}/disable`, {
    method: "POST",
  });
  assert("cannot disable last admin", disableLast.status === 403);
}

const roleUpdate = await req("/api/roles/role_admin", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ permission_ids: ["perm_settings_read"] }),
});
assert("cannot strip admin role permissions", roleUpdate.status === 400);

const editorRole = await req("/api/roles/role_editor");
const editorPermIds = (editorRole.body.data?.permissions ?? []).map((p) => p.id);
const editorUpdate = await req("/api/roles/role_editor", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ permission_ids: editorPermIds }),
});
assert("role permission update works", editorUpdate.status === 200);

const themeBefore = await req("/api/theme/settings");
const themePut = await req("/api/theme/settings", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ...(themeBefore.body.data ?? {}),
    site_name: `JessCMS Audit ${suffix}`,
  }),
});
assert("theme update works", themePut.status === 200);

const themeAudit = await req("/api/audit?entity_type=theme_settings&limit=5");
assert("theme changes audited", themeAudit.status === 200);

const plugins = await req("/api/plugins");
const plugin = (plugins.body.data?.items ?? plugins.body.data ?? [])[0];
if (plugin?.id) {
  const disable = await req(`/api/plugins/${plugin.id}/disable`, { method: "POST" });
  assert("plugin disable", disable.status === 200);
  const enable = await req(`/api/plugins/${plugin.id}/enable`, { method: "POST" });
  assert("plugin enable", enable.status === 200);
  const pluginAudit = await req(`/api/audit?entity_type=plugin&limit=10`);
  assert("plugin changes audited", pluginAudit.status === 200);
}

const logout = await req("/api/auth/logout", { method: "POST" });
assert("logout", logout.status === 200);

const viewerJar = {};
async function viewerReq(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  const cookieHeader = Object.entries(viewerJar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  if (cookieHeader) headers.Cookie = cookieHeader;
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    const [pair] = cookie.split(";");
    const [name, ...rest] = pair.split("=");
    viewerJar[name] = rest.join("=");
  }
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("json")
    ? await response.json()
    : await response.text();
  return { status: response.status, body };
}

if (newUserId) {
  const viewerLogin = await viewerReq("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: newUserEmail, password: "TempPassword1234" }),
  });
  assert("viewer user login", viewerLogin.status === 200);

  const viewerUsers = await viewerReq("/api/users");
  assert("non-admin cannot access users", viewerUsers.status === 403);
}

console.log(process.exitCode ? "\nSome checks failed." : "\nAll permissions/audit checks passed.");
