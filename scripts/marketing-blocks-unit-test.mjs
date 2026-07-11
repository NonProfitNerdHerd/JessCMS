/**
 * Marketing blocks checks against a running JessCMS instance.
 * Run: npm run test:marketing-blocks
 * Requires: wrangler dev (or BASE_URL pointing at deployed worker)
 */
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

const catalog = await req("/api/editor/blocks");
const visual = catalog.body.data?.visual_editor ?? catalog.body.data?.items ?? [];
const types = ["hero", "call_to_action", "card", "image_box", "feature_grid"];
for (const type of types) {
  assert(`${type} in catalog`, visual.some((b) => b.type === type));
}

const marketingDoc = {
  version: 1,
  blocks: [
    {
      id: "blk_hero_1",
      type: "hero",
      props: {
        heading: `Hero ${suffix}`,
        headingLevel: 1,
        description: "Welcome copy",
        layout: "centered",
        primaryAction: { label: "Get started", url: "/start", style: "primary", target: "_self" },
        secondaryAction: { label: "", url: "", style: "secondary", target: "_self" },
      },
      children: [],
      style: { width: "full" },
      plugin_source: null,
    },
    {
      id: "blk_cta_1",
      type: "call_to_action",
      props: {
        heading: "Join us",
        headingLevel: 2,
        layout: "centered",
        primaryAction: { label: "Donate", url: "/donate", style: "primary", target: "_self" },
      },
      children: [],
      style: {},
      plugin_source: null,
    },
    {
      id: "blk_card_1",
      type: "card",
      props: {
        heading: "Annual Report",
        orientation: "vertical",
        linkMode: "card",
        linkUrl: "/report",
        buttonLabel: "Read more",
      },
      children: [],
      style: {},
      plugin_source: null,
    },
    {
      id: "blk_ibox_1",
      type: "image_box",
      props: {
        heading: "Our Mission",
        layout: "image-left",
        imageWidth: 45,
        description: "Mission text",
      },
      children: [],
      style: {},
      plugin_source: null,
    },
    {
      id: "blk_fg_1",
      type: "feature_grid",
      props: {
        heading: "Services",
        displayStyle: "cards",
        columns: { desktop: 3, tablet: 2, mobile: 1 },
        items: [
          { id: "item_a", heading: "Counseling", description: "Support", linkUrl: "", linkLabel: "" },
          { id: "item_b", heading: "Advocacy", description: "Voice", linkUrl: "", linkLabel: "" },
          { id: "item_c", heading: "Education", description: "Learn", linkUrl: "", linkLabel: "" },
        ],
      },
      children: [],
      style: {},
      plugin_source: null,
    },
  ],
};

const valid = await req("/api/editor/validate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ content_json: marketingDoc }),
});
assert("validate marketing document", valid.status === 200);
assert("marketing document valid", valid.body.data?.valid === true);

const emptyHero = await req("/api/editor/validate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    content_json: {
      version: 1,
      blocks: [
        {
          id: "blk_bad_hero",
          type: "hero",
          props: { heading: "" },
          children: [],
          style: {},
          plugin_source: null,
        },
      ],
    },
  }),
});
const emptyErrors = emptyHero.body.data?.errors ?? [];
assert(
  "empty hero heading fails validation",
  emptyErrors.some((e) => e.code === "hero_heading_required"),
);

const created = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Marketing Blocks ${suffix}`,
    slug: `marketing-blocks-${suffix}`,
    status: "draft",
    content_json: JSON.stringify(marketingDoc),
    save_mode: "draft",
  }),
});
assert("create page with marketing blocks", created.status === 200 || created.status === 201);
const pageId = created.body.id ?? created.body.data?.id;
assert("page id returned", Boolean(pageId));

if (pageId) {
  const page = await req(`/api/pages/${pageId}`);
  assert("page loads", page.status === 200);
  const payload = page.body?.data ?? page.body;
  const html = String(payload.content_html ?? "");
  const json = String(payload.content_json ?? payload.draft_content_json ?? "");
  assert(
    "html or json includes hero",
    html.includes("jess-hero") || html.includes(`Hero ${suffix}`) || json.includes("hero"),
  );
  assert(
    "html or json includes cta",
    html.includes("jess-cta") || html.includes("Join us") || json.includes("call_to_action"),
  );
  assert(
    "html or json includes feature grid",
    html.includes("jess-feature-grid") || html.includes("Counseling") || json.includes("feature_grid"),
  );
  assert(
    "html or json includes card",
    html.includes("Annual Report") || html.includes("jess-card") || json.includes("card"),
  );
}

console.log(process.exitCode ? "\nMarketing block checks failed." : "\nMarketing block checks passed.");
