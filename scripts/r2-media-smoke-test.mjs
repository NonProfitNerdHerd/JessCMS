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

function cookieHeader() {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function req(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  const cookies = cookieHeader();
  if (cookies) headers.Cookie = cookies;

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

// 1×1 PNG
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.ADMIN_EMAIL ?? "ike.j.rebout@gmail.com",
    password: process.env.ADMIN_PASSWORD ?? "JessCMSAdmin2026",
  }),
});
assert("admin login", login.status === 200);

const uploadForm = new FormData();
uploadForm.append("file", new Blob([pngBytes], { type: "image/png" }), `r2-test-${suffix}.png`);
uploadForm.append("title", `R2 Upload ${suffix}`);
uploadForm.append("folder", "r2-tests");
uploadForm.append("alt_text", "R2 smoke test image");

const uploaded = await req("/api/media/upload", {
  method: "POST",
  body: uploadForm,
});
assert("upload valid image", uploaded.status === 201);

const media = uploaded.body.data ?? uploaded.body;
const mediaId = media?.id;
const storageKey = media?.storage_key;
const publicPath = media?.public_url;
assert("media id returned", Boolean(mediaId));
assert("storage_provider is r2", media?.storage_provider === "r2");
assert("storage_key set", Boolean(storageKey));
assert("public_url is worker path", String(publicPath || "").startsWith("/media/"));
assert("resolved_url set", Boolean(media?.resolved_url));

const badTypeForm = new FormData();
badTypeForm.append("file", new Blob(["not an image"], { type: "text/plain" }), "bad.txt");
const badType = await req("/api/media/upload", { method: "POST", body: badTypeForm });
assert("reject invalid file type", badType.status === 400);

const bigBytes = new Uint8Array(10 * 1024 * 1024 + 1);
const bigForm = new FormData();
bigForm.append("file", new Blob([bigBytes], { type: "image/png" }), "big.png");
const oversized = await req("/api/media/upload", { method: "POST", body: bigForm });
assert("reject oversized file", oversized.status === 400);

const fetched = await req(`/api/media/${mediaId}`);
assert("get uploaded media", fetched.status === 200);
assert("fetched storage_key matches", fetched.body.data?.storage_key === storageKey);

if (publicPath) {
  const served = await req(publicPath);
  assert("public media route returns file", served.status === 200);
  assert(
    "public route content-type is image",
    (served.headers.get("content-type") || "").startsWith("image/"),
  );
  assert("cache-control header", Boolean(served.headers.get("cache-control")));
} else {
  assert("public media route returns file", false);
}

const mediaNewPage = await req("/admin/media/new");
assert(
  "admin upload UI present",
  String(mediaNewPage.body).includes("media-upload-dropzone") &&
    String(mediaNewPage.body).includes("media-upload-submit"),
);

if (mediaId) {
  const list = await req("/api/media?q=R2+Upload&folder=r2-tests&include_folders=1");
  assert("list includes uploaded item", (list.body.data?.items ?? []).some((item) => item.id === mediaId));

  const deleted = await req(`/api/media/${mediaId}`, { method: "DELETE" });
  assert("delete media", deleted.status === 200);

  const gone = await req(`/api/media/${mediaId}`);
  assert("D1 record removed", gone.status === 404);

  if (publicPath) {
    const servedAfterDelete = await req(publicPath);
    assert("R2 object no longer served", servedAfterDelete.status === 404);
  }
} else {
  assert("delete media", false);
}

console.log("\nR2 media smoke test complete.");
