const base = process.env.BASE_URL ?? "http://127.0.0.1:8787";
const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
const password = process.env.ADMIN_PASSWORD ?? "ChangeMeNow123!";
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

async function loadBlockRender() {
  const code = await fetch(`${base}/admin/block-render.js`).then((r) => r.text());
  const window = { crypto: globalThis.crypto };
  // eslint-disable-next-line no-eval
  eval(code);
  return window.JessBlockRender;
}

const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
assert("login works", login.status === 200);

const render = await loadBlockRender();
assert("block-render.js loads", Boolean(render?.renderDocument));

const sampleDoc = {
  version: 1,
  blocks: [
    {
      id: "blk_test_para",
      type: "paragraph",
      props: { text: "Smoke test paragraph." },
      children: [],
      style: { textAlign: "left" },
      plugin_source: null,
    },
    {
      id: "blk_test_head",
      type: "heading",
      props: { text: "Smoke test heading", level: 2 },
      children: [],
      style: { textAlign: "center" },
      plugin_source: null,
    },
    {
      id: "blk_test_btn",
      type: "button",
      props: { text: "Learn more", url: "/about", style: "primary" },
      children: [],
      style: { textAlign: "center" },
      plugin_source: null,
    },
  ],
};

const contentJson = JSON.stringify(sampleDoc);
const contentHtml = render.renderDocument(sampleDoc);

assert("renderer produces paragraph class", contentHtml.includes('class="jess-block jess-paragraph'));
assert("renderer produces heading class", contentHtml.includes("jess-heading"));
assert("renderer produces button class", contentHtml.includes("jess-button primary"));

const suffix = Date.now().toString(36);
const created = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Block Editor Test ${suffix}`,
    slug: `block-editor-test-${suffix}`,
    status: "draft",
    content_json: contentJson,
    content_html: contentHtml,
  }),
});
assert("create page with blocks", created.status === 201);

const pageId = created.body.data?.id;
const fetched = await req(`/api/pages/${pageId}`);
const savedBlocks = JSON.parse(fetched.body.data?.content_json ?? "{}").blocks ?? [];
assert("saved page has 3 blocks", savedBlocks.length === 3);
assert(
  "saved content_html matches renderer",
  fetched.body.data?.content_html?.includes("Smoke test paragraph."),
);

const editPage = await req(`/admin/pages/${pageId}`);
assert(
  "edit page includes block editor",
  editPage.status === 200 &&
    String(editPage.body).includes('id="block-editor"') &&
    String(editPage.body).includes("block-render.js"),
);

const published = await req(`/api/pages/${pageId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    status: "published",
    published_at: new Date().toISOString(),
    content_json: contentJson,
    content_html: contentHtml,
  }),
});
assert("publish page with blocks", published.status === 200);

const fallbackDoc = render.parseContentDocument("", "<p>Legacy HTML only</p>");
assert(
  "html-only fallback becomes html block",
  fallbackDoc.blocks.length === 1 && fallbackDoc.blocks[0].type === "html",
);

console.log("\nBlock editor smoke test complete.");
