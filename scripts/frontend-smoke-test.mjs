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
assert("admin login for seed data", login.status === 200);

const blockDoc = {
  version: 1,
  blocks: [
    {
      id: "blk_test1",
      type: "heading",
      props: { text: "Frontend Test Heading", level: 2 },
      children: [],
      style: {},
      plugin_source: null,
    },
    {
      id: "blk_test2",
      type: "paragraph",
      props: { text: "Storm chaser content for search." },
      children: [],
      style: {},
      plugin_source: null,
    },
  ],
};

const page = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Public Page ${suffix}`,
    slug: `public-page-${suffix}`,
    status: "published",
    published_at: new Date().toISOString(),
    template: "default",
    excerpt: "Public page excerpt",
    content_json: JSON.stringify(blockDoc),
  }),
});
assert("create published page", page.status === 201);
const pageSlug = page.body.data?.slug ?? `public-page-${suffix}`;

const post = await req("/api/posts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Public Post ${suffix}`,
    slug: `public-post-${suffix}`,
    status: "published",
    published_at: new Date().toISOString(),
    excerpt: "Weather watch post excerpt",
    content_json: JSON.stringify(blockDoc),
  }),
});
assert("create published post", post.status === 201);
const postSlug = post.body.data?.slug ?? `public-post-${suffix}`;

const event = await req("/api/events", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Public Event ${suffix}`,
    slug: `public-event-${suffix}`,
    status: "published",
    published_at: new Date().toISOString(),
    start_datetime: new Date().toISOString(),
    excerpt: "Summer festival preview",
    content_json: JSON.stringify(blockDoc),
  }),
});
assert("create published event", event.status === 201);
const eventSlug = event.body.data?.slug ?? `public-event-${suffix}`;

await req("/api/theme/settings", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    site_name: "JessCMS Frontend Test",
    primary_color: "#2563eb",
  }),
});

const home = await req("/");
assert("home page renders", home.status === 200);
assert("home has html shell", html(home.body).includes("<!DOCTYPE html>"));
assert("home has site name", html(home.body).includes("JessCMS Frontend Test"));
assert("home has primary nav", html(home.body).includes('aria-label="Primary"'));
assert("home has seo title", html(home.body).includes("<title>"));
assert("home has canonical", html(home.body).includes('rel="canonical"'));
assert("home has og tags", html(home.body).includes('property="og:title"'));
assert("home has twitter card", html(home.body).includes('name="twitter:card"'));
assert("home has json-ld", html(home.body).includes("application/ld+json"));
assert("home has theme css", html(home.body).includes("/theme/jess-default.css"));
assert("home has css variables", html(home.body).includes("--jess-primary"));

const publicPage = await req(`/${pageSlug}`);
assert("page renders", publicPage.status === 200);
assert("page renders blocks", html(publicPage.body).includes("Frontend Test Heading"));

const blogIndex = await req("/blog");
assert("blog index renders", blogIndex.status === 200);
assert("blog index lists posts", html(blogIndex.body).includes(`Public Post ${suffix}`));

const blogPost = await req(`/blog/${postSlug}`);
assert("blog post renders", blogPost.status === 200);
assert("blog post has article", html(blogPost.body).includes('class="jess-content jess-post-body"'));

const eventsIndex = await req("/events");
assert("events index renders", eventsIndex.status === 200);
assert("events index lists events", html(eventsIndex.body).includes(`Public Event ${suffix}`));

const eventPage = await req(`/events/${eventSlug}`);
assert("event page renders", eventPage.status === 200);
assert("event page has meta", html(eventPage.body).includes("jess-event-meta"));

const notFound = await req("/this-page-does-not-exist-xyz");
assert("404 page", notFound.status === 404);
assert("404 content", html(notFound.body).includes("404"));
assert("404 noindex", html(notFound.body).includes('content="noindex, follow"'));

const search = await req(`/search?q=${encodeURIComponent("Storm")}`);
assert("search renders", search.status === 200);
assert("search finds content", html(search.body).includes("Storm chaser") || html(search.body).includes("Weather watch"));
assert("search noindex", html(search.body).includes('content="noindex, follow"'));

const robots = await req("/robots.txt");
assert("robots.txt", robots.status === 200);
assert("robots allows crawl", html(robots.body).includes("Allow: /"));
assert("robots sitemap", html(robots.body).includes("Sitemap:"));

const sitemap = await req("/sitemap.xml");
assert("sitemap.xml", sitemap.status === 200);
assert("sitemap has urls", html(sitemap.body).includes("<urlset"));
assert("sitemap includes blog post", html(sitemap.body).includes(`/blog/${postSlug}`));

const themeCss = await req("/theme/jess-default.css");
assert("theme css served", themeCss.status === 200 && html(themeCss.body).includes(".jess-theme"));

const cacheControl = home.headers.get("cache-control") ?? "";
assert("public cache headers", cacheControl.includes("public"));

const adminPage = await req("/admin/dashboard");
assert("admin not cached as public html", adminPage.status === 200 || adminPage.status === 302);

console.log("\nFrontend Phase 6 smoke test complete.");
