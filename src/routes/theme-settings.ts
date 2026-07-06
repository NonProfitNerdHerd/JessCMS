import { isAuthUser, requirePermission } from "../auth";
import { getClientIp, writeAuditLog } from "../db/audit";
import {
  badRequest,
  ok,
} from "../lib/response";
import { DEFAULT_THEME_SETTINGS, getRegisteredBlocks } from "../foundation/registry";

const THEME_KEYS = [
  "theme_name",
  "site_name",
  "logo_url",
  "favicon_url",
  "primary_color",
  "secondary_color",
  "background_color",
  "text_color",
  "heading_font",
  "body_font",
  "button_style",
  "layout_width",
  "border_radius",
  "custom_css",
] as const;

const THEME_ALIASES: Record<string, string> = {
  logo: "logo_url",
  favicon: "favicon_url",
};

function normalizeThemeInput(body: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    const target = THEME_ALIASES[key] ?? key;
    normalized[target] = value;
  }

  return normalized;
}

export async function handleUpdateThemeSettings(
  request: Request,
  env: Env,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "settings:update");
  if (!isAuthUser(authResult)) {
    return authResult;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const updates = normalizeThemeInput(body);
  const allowed = new Set<string>(THEME_KEYS);
  const entries = Object.entries(updates).filter(([key]) => allowed.has(key));

  if (entries.length === 0) {
    return badRequest("No valid theme settings provided");
  }

  const statements = entries.map(([key, value]) =>
    env.DB.prepare(
      `
        INSERT INTO theme_settings (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = datetime('now')
      `,
    ).bind(key, JSON.stringify(value)),
  );

  await env.DB.batch(statements);

  await writeAuditLog(env.DB, {
    actorId: authResult.id,
    action: "update",
    entityType: "theme_settings",
    entityId: "theme",
    metadata: { keys: entries.map(([key]) => key) },
    ipAddress: getClientIp(request),
  });

  return handleThemeSettings(env);
}

export async function handleThemeSettings(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    "SELECT key, value FROM theme_settings ORDER BY key",
  ).all<{ key: string; value: string }>();

  const fromDb: Record<string, unknown> = {};

  for (const row of rows.results ?? []) {
    try {
      fromDb[row.key] = JSON.parse(row.value);
    } catch {
      fromDb[row.key] = row.value;
    }
  }

  const settings = {
    ...DEFAULT_THEME_SETTINGS,
    ...fromDb,
  };

  return ok({
    settings,
    source: Object.keys(fromDb).length > 0 ? "database" : "defaults",
  });
}

export async function handleEditorBlocks(_env: Env): Promise<Response> {
  const registry = getRegisteredBlocks();

  return ok({
    items: registry.all,
    core: registry.core,
    from_plugins: registry.from_plugins,
    count: registry.all.length,
  });
}
