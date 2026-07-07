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
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.ADMIN_EMAIL ?? "ike.j.rebout@gmail.com",
    password: process.env.ADMIN_PASSWORD ?? "JessCMSAdmin2026",
  }),
});

if (login.status !== 200) {
  console.error("Login failed:", login.status, login.body);
  process.exit(1);
}

const rebuild = await req("/api/search/rebuild", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    include_forms: true,
    include_media: true,
  }),
});

if (rebuild.status !== 200) {
  console.error("Rebuild failed:", rebuild.status, rebuild.body);
  process.exit(1);
}

console.log(`Rebuilt search index: ${rebuild.body.data?.indexed ?? 0} entries`);
if (remote) {
  console.log("(Used --remote flag; set BASE_URL to your deployed Worker URL)");
}
