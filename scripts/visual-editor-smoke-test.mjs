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

const suffix = Date.now().toString(36);
const adminEmail = process.env.ADMIN_EMAIL ?? "ike.j.rebout@gmail.com";
const adminPassword = process.env.ADMIN_PASSWORD ?? "JessCMSAdmin2026";

const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: adminEmail, password: adminPassword }),
});
assert("admin login", login.status === 200);

const blocks = await req("/api/editor/blocks");
assert("editor blocks catalog", blocks.status === 200);
assert(
  "divider in catalog or visual list",
  (blocks.body.data?.items ?? []).some((b) => b.type === "divider") ||
    (blocks.body.data?.visual_editor ?? []).some((b) => b.type === "divider"),
);
assert(
  "columns supports nesting metadata",
  (blocks.body.data?.items ?? []).some((b) => b.type === "columns"),
);
assert(
  "hero in visual catalog",
  (blocks.body.data?.visual_editor ?? blocks.body.data?.items ?? []).some((b) => b.type === "hero"),
);
assert(
  "feature_grid in visual catalog",
  (blocks.body.data?.visual_editor ?? blocks.body.data?.items ?? []).some((b) => b.type === "feature_grid"),
);

const doc = {
  version: 1,
  blocks: [
    {
      id: "blk_heading_1",
      type: "heading",
      props: { text: `Visual Editor ${suffix}`, level: 2 },
      children: [],
      style: { textAlign: "left" },
      plugin_source: null,
    },
    {
      id: "blk_para_1",
      type: "paragraph",
      props: { text: "Nested-ready document body." },
      children: [],
      style: {},
      plugin_source: null,
    },
    {
      id: "blk_divider_1",
      type: "divider",
      props: { style: "solid", thickness: "2px", width: "100%", color: "#999" },
      children: [],
      style: {},
      plugin_source: null,
    },
    {
      id: "blk_button_1",
      type: "button",
      props: { text: "Learn more", url: "/about", style: "primary" },
      children: [],
      style: { textAlign: "left" },
      plugin_source: null,
    },
    {
      id: "blk_cols_1",
      type: "columns",
      props: { columnCount: 2, gap: "1rem", ratios: ["50%", "50%"] },
      children: [
        {
          id: "blk_col_a",
          type: "column",
          props: { width: "50%" },
          children: [
            {
              id: "blk_col_a_p",
              type: "paragraph",
              props: { text: "Left column" },
              children: [],
              style: {},
              plugin_source: null,
            },
          ],
          style: {},
          plugin_source: null,
        },
        {
          id: "blk_col_b",
          type: "column",
          props: { width: "50%" },
          children: [
            {
              id: "blk_col_b_p",
              type: "paragraph",
              props: { text: "Right column" },
              children: [],
              style: {},
              plugin_source: null,
            },
          ],
          style: {},
          plugin_source: null,
        },
      ],
      style: {},
      plugin_source: null,
    },
  ],
};

const validate = await req("/api/editor/validate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ content_json: doc }),
});
assert("validate document", validate.status === 200);
assert("document is valid", validate.body.data?.valid === true);

const badButton = structuredClone(doc);
badButton.blocks[3].props.text = "";
const validateBad = await req("/api/editor/validate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ content_json: badButton, for_publish: true }),
});
assert("empty button fails publish validation", validateBad.body.data?.valid === false);

const created = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Visual Editor ${suffix}`,
    slug: `visual-editor-${suffix}`,
    status: "draft",
    content_json: JSON.stringify(doc),
    save_mode: "draft",
  }),
});
assert("create page with nested blocks", created.status === 201);
const pageId = created.body.data?.id;
assert("page has content_html", Boolean(created.body.data?.content_html));
assert(
  "html includes columns",
  String(created.body.data?.content_html ?? "").includes("jess-columns"),
);

const published = await req(`/api/pages/${pageId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    status: "published",
    published_at: new Date().toISOString(),
    content_json: JSON.stringify(doc),
    save_mode: "publish",
  }),
});
assert("publish page", published.status === 200);

const draftEdit = await req(`/api/pages/${pageId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    save_mode: "draft",
    draft_content_json: JSON.stringify({
      ...doc,
      blocks: [
        ...doc.blocks,
        {
          id: "blk_draft_only",
          type: "paragraph",
          props: { text: "Draft-only paragraph" },
          children: [],
          style: {},
          plugin_source: null,
        },
      ],
    }),
  }),
});
assert("save draft on published page", draftEdit.status === 200);

const fetched = await req(`/api/pages/${pageId}`);
assert(
  "draft_content_json stored",
  String(fetched.body.data?.draft_content_json ?? "").includes("Draft-only paragraph"),
);
assert(
  "published content_json unchanged by draft save",
  !String(fetched.body.data?.content_json ?? "").includes("Draft-only paragraph"),
);

const editorPage = await req(`/admin/pages/${pageId}`);
assert("editor page loads", editorPage.status === 200);
assert(
  "visual editor host present",
  String(editorPage.body).includes("block-editor") || String(editorPage.body).includes("visual-editor"),
);

console.log(process.exitCode ? "\nSome visual editor checks failed." : "\nVisual editor checks passed.");
