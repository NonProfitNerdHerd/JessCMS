#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pluginsDir = join(root, "plugins");
const base = process.env.BASE_URL ?? "http://127.0.0.1:8787";
const JESSCMS_VERSION = "0.9.0";

const jar = {};

function parseSetCookie(response) {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    const [pair] = cookie.split(";");
    const [name, ...rest] = pair.split("=");
    jar[name] = rest.join("=");
  }
}

async function api(path, options = {}) {
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

function loadManifests() {
  const ids = readdirSync(pluginsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  return ids.map((id) => {
    const path = join(pluginsDir, id, "manifest.json");
    return JSON.parse(readFileSync(path, "utf8"));
  });
}

function compareVersions(current, required) {
  const parse = (value) =>
    value.replace(/^v/, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(current);
  const b = parse(required);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function validateManifests(manifests) {
  const errors = [];
  const pluginIds = new Set();
  const contentTypes = new Set();
  const blockTypes = new Set();
  const permissions = new Set();
  const adminPaths = new Set();
  const routeKeys = new Set();

  for (const manifest of manifests) {
    if (pluginIds.has(manifest.id)) errors.push(`Duplicate plugin ID: ${manifest.id}`);
    pluginIds.add(manifest.id);

    if (manifest.minimum_jesscms_version) {
      if (compareVersions(JESSCMS_VERSION, manifest.minimum_jesscms_version) < 0) {
        errors.push(
          `${manifest.id}: requires JessCMS ${manifest.minimum_jesscms_version}, running ${JESSCMS_VERSION}`,
        );
      }
    }

    for (const dep of manifest.dependencies ?? []) {
      if (!manifests.some((m) => m.id === dep.plugin_id)) {
        errors.push(`${manifest.id}: missing dependency ${dep.plugin_id}`);
      }
    }
  }

  for (const manifest of manifests) {
    for (const ct of manifest.content_types ?? []) {
      if (contentTypes.has(ct.type_key)) errors.push(`Duplicate content type: ${ct.type_key}`);
      contentTypes.add(ct.type_key);
      if (ct.admin_base && adminPaths.has(ct.admin_base)) {
        errors.push(`Duplicate admin route: ${ct.admin_base}`);
      }
      if (ct.admin_base) adminPaths.add(ct.admin_base);
    }

    for (const block of manifest.blocks ?? []) {
      if (blockTypes.has(block.type)) errors.push(`Duplicate block: ${block.type}`);
      blockTypes.add(block.type);
    }

    for (const permission of manifest.permissions ?? []) {
      if (permissions.has(permission)) errors.push(`Duplicate permission: ${permission}`);
      permissions.add(permission);
    }

    for (const page of manifest.admin_pages ?? manifest.admin_routes ?? []) {
      const path = `/admin${page.path.startsWith("/") ? page.path : `/${page.path}`}`;
      if (adminPaths.has(path)) errors.push(`Duplicate admin route: ${path}`);
      adminPaths.add(path);
    }

    for (const route of manifest.routes ?? []) {
      const key = `${(route.method ?? "GET").toUpperCase()} ${route.type ?? "api"} ${route.path}`;
      if (routeKeys.has(key)) errors.push(`Duplicate route: ${key}`);
      routeKeys.add(key);
    }

    for (const route of manifest.api_routes ?? []) {
      const key = `${route.method.toUpperCase()} api ${route.path}`;
      if (routeKeys.has(key)) errors.push(`Duplicate API route: ${key}`);
      routeKeys.add(key);
    }
  }

  return errors;
}

function listManifests(manifests) {
  console.log("Installed plugin manifests:\n");
  for (const manifest of manifests.sort((a, b) => a.name.localeCompare(b.name))) {
    const deps = (manifest.dependencies ?? []).map((d) => d.plugin_id).join(", ") || "—";
    console.log(`  ${manifest.id} v${manifest.version} [${manifest.enabled ? "enabled" : "disabled"}] deps: ${deps}`);
  }
}

const command = process.argv[2] ?? "validate";

if (command === "validate") {
  const manifests = loadManifests();
  const errors = validateManifests(manifests);
  if (errors.length === 0) {
    console.log(`✓ ${manifests.length} plugin manifests validated`);
    process.exit(0);
  }
  console.error("Validation failed:");
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

if (command === "list") {
  listManifests(loadManifests());
  process.exit(0);
}

if (command === "sync" || command === "refresh") {
  const login = await api("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL ?? "ike.j.rebout@gmail.com",
      password: process.env.ADMIN_PASSWORD ?? "JessCMSAdmin2026",
    }),
  });

  if (login.status !== 200) {
    console.error("Login failed. Start the dev server or set BASE_URL.");
    process.exit(1);
  }

  const path = command === "sync" ? "/api/runtime/sync" : "/api/runtime/refresh";
  const result = await api(path, { method: "POST" });
  if (result.status === 200) {
    console.log(`✓ ${command} completed`, result.body.data ?? result.body);
    process.exit(0);
  }
  console.error(`${command} failed`, result.body);
  process.exit(1);
}

console.error("Usage: node scripts/plugins-cli.mjs [validate|list|sync|refresh]");
process.exit(1);
