const base = process.env.BASE_URL ?? "http://127.0.0.1:8791";
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

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const response = await fetch(`${base}${path}`, { ...options, headers });
  parseSetCookie(response);
  const body = await response.json();

  return { status: response.status, body };
}

const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "admin@example.com",
    password: "ChangeMeNow123!",
  }),
});

console.log("login", login.status, login.body.data?.user?.email);

const me = await req("/api/auth/me");
console.log("me", me.status, me.body.data?.permissions?.length, "permissions");

const suffix = Date.now().toString(36);

const page = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "About",
    slug: `about-${suffix}`,
    status: "draft",
    content_json: JSON.stringify({ version: 1, blocks: [] }),
  }),
});

console.log("create page", page.status, page.body.data?.id ?? page.body.error);

const pageId = page.body.data?.id;
if (pageId) {
  const published = await req(`/api/pages/${pageId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "published",
      published_at: "2026-07-06T12:00:00.000Z",
    }),
  });

  console.log("publish", published.status, published.body.data?.status);
}

const publicList = await fetch(`${base}/api/pages`).then((response) =>
  response.json(),
);
console.log("public list count", publicList.data?.count);

const post = await req("/api/posts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Hello",
    slug: `hello-${suffix}`,
    status: "draft",
  }),
});
console.log("create post", post.status, post.body.data?.id ?? post.body.error);

const event = await req("/api/events", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Meetup",
    slug: `meetup-${suffix}`,
    status: "draft",
    start_datetime: "2026-08-01T18:00:00.000Z",
  }),
});
console.log("create event", event.status, event.body.data?.id ?? event.body.error);

const logout = await req("/api/auth/logout", { method: "POST" });
console.log("logout", logout.status);
