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
  return Boolean(condition);
}

function html(body) {
  return String(body);
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

const createdForm = await req("/api/forms", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Contact ${suffix}`,
    slug: `contact-${suffix}`,
    status: "draft",
    template: "contact",
    settings: {
      success_message: "Thanks for reaching out!",
      submit_label: "Send",
      notifications: [
        {
          key: "admin",
          name: "Administrator notification",
          enabled: true,
          recipient: "admin@example.com",
          subject: "New submission: {form:name}",
          message: "{submission:summary}",
          include_field_summary: true,
          format: "text",
        },
      ],
      confirmations: [
        {
          key: "default",
          type: "message",
          message: "Thanks for reaching out!",
          enabled: true,
        },
      ],
    },
  }),
});
assert("create form", createdForm.status === 201);
const formId = createdForm.body.data?.id;
const formSlug = createdForm.body.data?.slug;
assert("template seeded fields", (createdForm.body.data?.fields ?? []).length >= 2);

const draftVersion = createdForm.body.data?.draft_version ?? 1;
const draftSave = await req(`/api/forms/${formId}/draft`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    expected_draft_version: draftVersion,
    title: `Contact ${suffix}`,
    slug: formSlug,
    definition: {
      ...(createdForm.body.data.definition || {}),
      settings: {
        ...(createdForm.body.data.definition?.settings || {}),
        submit_label: "Send message",
      },
    },
  }),
});
assert("save draft", draftSave.status === 200);
assert("draft version bumped", (draftSave.body.data?.draft_version ?? 0) > draftVersion);

const conflict = await req(`/api/forms/${formId}/draft`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    expected_draft_version: draftVersion,
    definition: draftSave.body.data.definition,
  }),
});
assert("draft conflict detected", conflict.status === 409);

const nameField = await req(`/api/forms/${formId}/fields`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    label: "Website",
    field_key: "website",
    field_type: "url",
    required: false,
  }),
});
assert("create url field", nameField.status === 201);

const publish = await req(`/api/forms/${formId}/publish`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ change_note: "Smoke publish" }),
});
assert("publish form", publish.status === 200);
assert("published status active", publish.body.data?.status === "active");
assert("published version set", Boolean(publish.body.data?.published_version));

const publicDraftBlocked = await req(`/api/public/forms/${formSlug}-missing`);
assert("missing public form 404", publicDraftBlocked.status === 404);

const publicForm = await req(`/api/public/forms/${formSlug}`);
assert("public get form", publicForm.status === 200);
assert("public form has fields", (publicForm.body.data?.fields ?? []).length >= 3);

const submit = await req(`/api/public/forms/${formSlug}/submit`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": `smoke-${suffix}`,
  },
  body: JSON.stringify({
    values: {
      name: { first: "Storm", last: "Chaser" },
      email: "storm@example.com",
      message: "Hello from smoke test",
      website: "https://example.com",
    },
    page_url: "http://127.0.0.1:8787/contact",
  }),
});
assert("submit form", submit.status === 201);
assert("submit success flag", submit.body.data?.success === true);
assert("confirmation payload", Boolean(submit.body.data?.confirmation));

const submitRetry = await req(`/api/public/forms/${formSlug}/submit`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": `smoke-${suffix}`,
  },
  body: JSON.stringify({
    values: {
      name: { first: "Storm", last: "Chaser" },
      email: "storm@example.com",
      message: "Hello from smoke test",
    },
  }),
});
assert("idempotent retry accepted", submitRetry.status === 201);
assert(
  "idempotent same submission id",
  submitRetry.body.data?.submission_id === submit.body.data?.submission_id,
);

const invalidSubmit = await req(`/api/public/forms/${formSlug}/submit`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    values: {
      name: {},
      email: "not-an-email",
      message: "",
    },
  }),
});
assert("invalid submit rejected", invalidSubmit.status === 400);

const submissions = await req(`/api/forms/${formId}/submissions`);
assert("list submissions", submissions.status === 200);
const hasSubmission = assert(
  "has submission",
  (submissions.body.data?.items ?? []).length >= 1,
);
const submissionId = hasSubmission ? submissions.body.data.items[0].id : null;

if (submissionId) {
  const submissionDetail = await req(`/api/forms/submissions/${submissionId}`);
  assert("get submission detail", submissionDetail.status === 200);
  assert(
    "submission has values",
    (submissionDetail.body.data?.values ?? []).some((row) => row.field_key === "email"),
  );
} else {
  assert("get submission detail", false);
  assert("submission has values", false);
}

const duplicated = await req(`/api/forms/${formId}/duplicate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
assert("duplicate form", duplicated.status === 201);
assert("duplicate is draft", duplicated.body.data?.status === "draft");

const versions = await req(`/api/forms/${formId}/versions`);
assert("list versions", versions.status === 200);
assert("has versions", (versions.body.data?.items ?? []).length >= 1);

const exported = await req(`/api/forms/${formId}/export`);
assert("export definition", exported.status === 200);
assert("export has schema", exported.body.data?.schemaVersion === 1);

const adminForms = await req("/admin/forms");
assert("admin forms page", adminForms.status === 200 && html(adminForms.body).includes("forms-table"));

const adminEdit = await req(`/admin/forms/${formId}`);
assert("admin form edit page", adminEdit.status === 200 && html(adminEdit.body).includes("fields-list"));
assert("builder shell present", html(adminEdit.body).includes("forms-builder-app"));

const adminSubmissions = await req(`/admin/forms/${formId}/submissions`);
assert(
  "admin submissions page",
  adminSubmissions.status === 200 && html(adminSubmissions.body).includes("submissions-table"),
);

const blockPage = await req("/admin/pages/new");
assert(
  "admin page editor loads",
  blockPage.status === 200 && html(blockPage.body).includes("block-editor.js"),
);

const editorBlocks = await req("/api/editor/blocks");
assert("editor blocks api", editorBlocks.status === 200);
assert(
  "form block registered",
  JSON.stringify(editorBlocks.body).includes('"form"') ||
    JSON.stringify(editorBlocks.body.data ?? {}).includes("form"),
);

const deletedCopy = await req(`/api/forms/${duplicated.body.data.id}`, { method: "DELETE" });
assert("delete duplicate", deletedCopy.status === 200);

const deleted = await req(`/api/forms/${formId}`, { method: "DELETE" });
assert("delete form", deleted.status === 200);

const gone = await req(`/api/forms/${formId}`);
assert("form gone after delete", gone.status === 404);

console.log("\nForms platform smoke test complete.");
