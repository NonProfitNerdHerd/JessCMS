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
    settings: {
      success_message: "Thanks for reaching out!",
      submit_label: "Send",
    },
  }),
});
assert("create form", createdForm.status === 201);
const formId = createdForm.body.data?.id;
const formSlug = createdForm.body.data?.slug;

const nameField = await req(`/api/forms/${formId}/fields`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    label: "Your Name",
    field_key: "your_name",
    field_type: "text",
    required: true,
  }),
});
assert("create name field", nameField.status === 201);

const emailField = await req(`/api/forms/${formId}/fields`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    label: "Email",
    field_key: "email",
    field_type: "email",
    required: true,
  }),
});
assert("create email field", emailField.status === 201);

const consentField = await req(`/api/forms/${formId}/fields`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    label: "I agree to be contacted",
    field_key: "consent",
    field_type: "consent",
    required: true,
  }),
});
assert("create consent field", consentField.status === 201);

const activate = await req(`/api/forms/${formId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status: "active" }),
});
assert("activate form", activate.status === 200);

const publicForm = await req(`/api/public/forms/${formSlug}`);
assert("public get form", publicForm.status === 200);
assert("public form has fields", (publicForm.body.data?.fields ?? []).length >= 3);

const submit = await req(`/api/public/forms/${formSlug}/submit`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    values: {
      your_name: "Storm Chaser",
      email: "storm@example.com",
      consent: true,
    },
  }),
});
assert("submit form", submit.status === 201);
assert("submit success flag", submit.body.data?.success === true);

const invalidSubmit = await req(`/api/public/forms/${formSlug}/submit`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    values: {
      your_name: "",
      email: "not-an-email",
      consent: false,
    },
  }),
});
assert("invalid submit rejected", invalidSubmit.status === 400);

const submissions = await req(`/api/forms/${formId}/submissions`);
assert("list submissions", submissions.status === 200);
assert("has submission", (submissions.body.data?.items ?? []).length >= 1);
const submissionId = submissions.body.data.items[0].id;

const submissionDetail = await req(`/api/forms/submissions/${submissionId}`);
assert("get submission detail", submissionDetail.status === 200);
assert(
  "submission has values",
  (submissionDetail.body.data?.values ?? []).some((row) => row.field_key === "email"),
);

const adminForms = await req("/admin/forms");
assert("admin forms page", adminForms.status === 200 && html(adminForms.body).includes("forms-table"));

const adminEdit = await req(`/admin/forms/${formId}`);
assert("admin form edit page", adminEdit.status === 200 && html(adminEdit.body).includes("fields-list"));

const adminSubmissions = await req(`/admin/forms/${formId}/submissions`);
assert(
  "admin submissions page",
  adminSubmissions.status === 200 && html(adminSubmissions.body).includes("submissions-table"),
);

const blockPage = await req("/admin/pages/new");
assert("form block in editor menu", html(blockPage.body).includes('data-add-type="form"'));

const deleted = await req(`/api/forms/${formId}`, { method: "DELETE" });
assert("delete form", deleted.status === 200);

const gone = await req(`/api/forms/${formId}`);
assert("form gone after delete", gone.status === 404);

console.log("\nForms Phase 7B smoke test complete.");
