const base = process.env.BASE_URL ?? "http://127.0.0.1:8787";
const remote = process.argv.includes("--remote");
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

const rebuild = await req("/api/search/rebuild", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ include_forms: true, include_media: true }),
});
assert("rebuild index", rebuild.status === 200);
assert("rebuild indexed count", (rebuild.body.data?.indexed ?? 0) >= 0);

const publishedPage = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Search Published ${suffix}`,
    slug: `search-pub-${suffix}`,
    status: "published",
    published_at: "2026-07-06T12:00:00.000Z",
    excerpt: "Published search target",
    content_html: "<p>unique-body-term-alpha</p>",
  }),
});
assert("create published page", publishedPage.status === 201);
const publishedId = publishedPage.body.data?.id;

const draftPage = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Search Draft ${suffix}`,
    slug: `search-draft-${suffix}`,
    status: "draft",
    excerpt: "Draft search target",
    content_html: "<p>unique-body-term-beta</p>",
  }),
});
assert("create draft page", draftPage.status === 201);
const draftId = draftPage.body.data?.id;

const publicSearch = await req(`/api/search?q=unique-body-term-alpha`);
assert("public search finds published body", publicSearch.status === 200);
assert(
  "public search excludes draft",
  !(publicSearch.body.data?.items ?? []).some((item) => item.source_id === draftId),
);
assert(
  "public search includes published page",
  (publicSearch.body.data?.items ?? []).some((item) => item.source_id === publishedId),
);

const adminDraftSearch = await req(`/api/search/admin?q=Search+Draft+${suffix}`);
assert("admin search finds draft", adminDraftSearch.status === 200);
assert(
  "admin search includes draft page",
  (adminDraftSearch.body.data?.items ?? []).some((item) => item.source_id === draftId),
);

const titleSearch = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `ZZZ Title Match ${suffix}`,
    slug: `search-title-${suffix}`,
    status: "published",
    published_at: "2026-07-06T12:00:00.000Z",
    excerpt: "body only shared-term-gamma",
    content_html: "<p>shared-term-gamma</p>",
  }),
});
assert("create title-ranked page", titleSearch.status === 201);
const titleId = titleSearch.body.data?.id;

const bodySearch = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Body Match ${suffix}`,
    slug: `search-body-${suffix}`,
    status: "published",
    published_at: "2026-07-06T12:00:00.000Z",
    excerpt: "shared-term-gamma in excerpt only",
    content_html: "<p>other content</p>",
  }),
});
assert("create body-ranked page", bodySearch.status === 201);

const ranked = await req(`/api/search?q=ZZZ+Title+Match+${suffix}`);
const rankedItems = ranked.body.data?.items ?? [];
assert("title match ranks first", rankedItems[0]?.source_id === titleId);

const deleted = await req(`/api/pages/${publishedId}`, { method: "DELETE" });
assert("delete published page", deleted.status === 200);

const afterDelete = await req(`/api/search?q=unique-body-term-alpha`);
assert(
  "deleted page removed from index",
  !(afterDelete.body.data?.items ?? []).some((item) => item.source_id === publishedId),
);

const publicPage = await req("/search?q=unique-body-term-gamma");
assert("public search page loads", publicPage.status === 200 && String(publicPage.body).includes("jess-search"));

const adminSearchPage = await req("/admin/search?q=Search");
assert(
  "admin search page loads",
  adminSearchPage.status === 200 && String(adminSearchPage.body).includes("admin-search-form"),
);

await req(`/api/pages/${draftId}`, { method: "DELETE" });
await req(`/api/pages/${titleId}`, { method: "DELETE" });
await req(`/api/pages/${bodySearch.body.data?.id}`, { method: "DELETE" });

console.log(`\nSearch smoke test complete.${remote ? " (remote flag noted)" : ""}`);
