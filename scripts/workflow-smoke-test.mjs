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

const created = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Workflow Page ${suffix}`,
    slug: `workflow-page-${suffix}`,
    status: "draft",
    change_summary: "Initial version",
    content_json: JSON.stringify({ version: 1, blocks: [] }),
  }),
});
assert("create page", created.status === 201);
const pageId = created.body.data?.id ?? created.body.id;

const workflowInitial = await req(`/api/pages/${pageId}/workflow`);
assert("get workflow", workflowInitial.status === 200);
assert("initial state draft", workflowInitial.body.data?.state?.state === "draft");

const revisionsAfterCreate = await req(`/api/pages/${pageId}/revisions`);
assert("list revisions after create", revisionsAfterCreate.status === 200);
assert(
  "revision created on create",
  (revisionsAfterCreate.body.data?.items ?? revisionsAfterCreate.body.data ?? []).length >= 1,
);

const saveUpdate = await req(`/api/pages/${pageId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Workflow Page ${suffix} v2`,
    change_summary: "Updated title",
  }),
});
assert("save creates revision", saveUpdate.status === 200);

const revisionsAfterSave = await req(`/api/pages/${pageId}/revisions`);
const revItems = revisionsAfterSave.body.data?.items ?? revisionsAfterSave.body.data ?? [];
assert("second revision exists", revItems.length >= 2);

const submit = await req(`/api/pages/${pageId}/workflow`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "submit", comment: "Ready for review" }),
});
assert("submit for review", submit.status === 200);
assert("state in_review", submit.body.data?.state?.state === "in_review");

const rejectAttempt = await req(`/api/pages/${pageId}/workflow`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "publish", comment: "Should fail" }),
});
assert("invalid transition blocked", rejectAttempt.status === 400);

const approve = await req(`/api/pages/${pageId}/workflow`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "approve", comment: "Looks good" }),
});
assert("approve", approve.status === 200);
assert("state approved", approve.body.data?.state?.state === "approved");

const reject = await req(`/api/pages/${pageId}/workflow`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "reject", comment: "Needs more work" }),
});
assert("reject from in_review fails when approved", reject.status === 400);

const resubmit = await req(`/api/pages/${pageId}/workflow`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "submit" }),
});
assert("resubmit fails from approved", resubmit.status === 400);

const publish = await req(`/api/pages/${pageId}/workflow`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "publish", comment: "Go live" }),
});
assert("publish", publish.status === 200);
assert("state published", publish.body.data?.state?.state === "published");

const publishedPage = await req(`/api/pages/${pageId}`);
assert("content status published", publishedPage.body.data?.status === "published");

const page2 = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Schedule Page ${suffix}`,
    slug: `schedule-page-${suffix}`,
    status: "draft",
  }),
});
const page2Id = page2.body.data?.id ?? page2.body.id;

const schedule = await req(`/api/pages/${page2Id}/workflow`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "schedule",
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    comment: "Tomorrow morning",
  }),
});
assert("schedule", schedule.status === 200);
assert("state scheduled", schedule.body.data?.state?.state === "scheduled");

const firstRev = revItems.find((r) => r.revision_number === 1) ?? revItems.at(-1);
const latestRev = revItems[0];

if (firstRev && latestRev && firstRev.revision_number !== latestRev.revision_number) {
  const compare = await req(
    `/api/pages/${pageId}/revisions/compare?from=${firstRev.revision_number}&to=${latestRev.revision_number}`,
  );
  assert("compare revisions", compare.status === 200);
  assert("compare has changed_fields", Array.isArray(compare.body.data?.changed_fields));
}

const restore = await req(`/api/pages/${pageId}/revisions/${firstRev.id}/restore`, {
  method: "POST",
});
assert("restore revision", restore.status === 200);

const afterRestore = await req(`/api/pages/${pageId}/revisions`);
const afterRestoreItems =
  afterRestore.body.data?.items ?? afterRestore.body.data ?? [];
assert("restore creates new revision", afterRestoreItems.length > revItems.length);

const archive = await req(`/api/pages/${pageId}/workflow`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "archive" }),
});
assert("archive", archive.status === 200);
assert("state archived", archive.body.data?.state?.state === "archived");

const history = workflowInitial.body.data?.history ?? [];
assert("workflow history on initial get", Array.isArray(history));

console.log("\nWorkflow & revisions smoke tests finished.");
