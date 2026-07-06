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
const imageUrl = `https://picsum.photos/seed/jesscms-${suffix}/800/600.jpg`;

const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.ADMIN_EMAIL ?? "ike.j.rebout@gmail.com",
    password: process.env.ADMIN_PASSWORD ?? "JessCMSAdmin2026",
  }),
});
assert("admin login", login.status === 200);

const created = await req("/api/media", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    public_url: imageUrl,
    title: `Media Test ${suffix}`,
    alt_text: "Storm test image",
    caption: "Phase 7A caption",
    folder: "test-folder",
    mime_type: "image/jpeg",
    width: 800,
    height: 600,
  }),
});
assert("create media", created.status === 201);
const mediaId = created.body.data?.id;
assert("media id returned", Boolean(mediaId));

const fetched = await req(`/api/media/${mediaId}`);
assert("get media by id", fetched.status === 200);
assert("media has public_url", fetched.body.data?.public_url === imageUrl);
assert("media resolved_url", Boolean(fetched.body.data?.resolved_url));

const updated = await req(`/api/media/${mediaId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Updated Media ${suffix}`,
    description: "Updated description",
  }),
});
assert("update media", updated.status === 200);
assert("updated title", updated.body.data?.title === `Updated Media ${suffix}`);

const list = await req("/api/media?q=Updated&folder=test-folder&include_folders=1");
assert("list media with search", list.status === 200);
assert("list finds item", (list.body.data?.items ?? []).some((item) => item.id === mediaId));
assert("folders included", Array.isArray(list.body.data?.folders));

const page = await req(`/admin/pages/new`);
assert("content edit loads media library script", page.status === 200 && html(page.body).includes("/admin/media-library.js"));
assert("featured image picker present", html(page.body).includes("data-featured-image-select"));

const mediaAdmin = await req("/admin/media");
assert("media library admin page", mediaAdmin.status === 200 && html(mediaAdmin.body).includes("media-grid"));

const mediaEdit = await req(`/admin/media/${mediaId}`);
assert("media edit admin page", mediaEdit.status === 200 && html(mediaEdit.body).includes("media-form"));

const blockEditor = await req("/admin/pages/new");
assert("block editor script present", html(blockEditor.body).includes("/admin/block-editor.js"));

const pageWithImage = await req("/api/pages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `Media Block Page ${suffix}`,
    slug: `media-block-${suffix}`,
    status: "draft",
    featured_image_id: mediaId,
    content_json: JSON.stringify({
      version: 1,
      blocks: [
        {
          id: "blk_img1",
          type: "image",
          props: {
            url: imageUrl,
            alt: "Storm test image",
            caption: "From library",
            media_id: mediaId,
          },
          children: [],
          style: {},
          plugin_source: null,
        },
      ],
    }),
  }),
});
assert("create page with image block + featured image", pageWithImage.status === 201);
const pageId = pageWithImage.body.data?.id;

const loadedPage = await req(`/api/pages/${pageId}`);
assert("page stores featured image id", loadedPage.body.data?.featured_image_id === mediaId);
const parsedBlocks = JSON.parse(loadedPage.body.data?.content_json || "{}");
assert("page stores image block url", parsedBlocks.blocks?.[0]?.props?.url === imageUrl);

await req(`/api/pages/${pageId}`, { method: "DELETE" });

const deleted = await req(`/api/media/${mediaId}`, { method: "DELETE" });
assert("delete media", deleted.status === 200);

const gone = await req(`/api/media/${mediaId}`);
assert("media gone after delete", gone.status === 404);

console.log("\nMedia Phase 7A smoke test complete.");
