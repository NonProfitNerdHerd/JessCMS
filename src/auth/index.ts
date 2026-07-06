import {
  generateId,
  generateSessionToken,
  hashSessionToken,
  isSessionExpired,
  parseSessionToken,
  sessionExpiresAt,
} from "../lib/crypto";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  permissions: string[];
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
}

const PERMISSION_ALIASES: Record<string, string[]> = {
  "content:read": ["content.read", "content:read"],
  "content:create": ["content.write", "content:create"],
  "content:update": ["content.write", "content:update"],
  "content:delete": ["content:delete"],
  "content:publish": ["content.publish", "content:publish"],
  "settings:read": ["theme.manage", "settings:read"],
  "settings:update": ["theme.manage", "settings:update"],
  "plugins:read": ["plugins.manage", "plugins:read"],
  "plugins:update": ["plugins.manage", "plugins:update"],
};

export async function getUserPermissions(
  db: D1Database,
  userId: string,
): Promise<string[]> {
  const result = await db
    .prepare(
      `
        SELECT DISTINCT p.slug
        FROM permissions p
        INNER JOIN role_permissions rp ON rp.permission_id = p.id
        INNER JOIN user_roles ur ON ur.role_id = rp.role_id
        WHERE ur.user_id = ?
      `,
    )
    .bind(userId)
    .all<{ slug: string }>();

  return (result.results ?? []).map((row) => row.slug);
}

export function userHasPermission(
  permissions: string[],
  required: string,
): boolean {
  const aliases = PERMISSION_ALIASES[required] ?? [required];
  return aliases.some((slug) => permissions.includes(slug));
}

export async function getCurrentUser(
  request: Request,
  env: Env,
): Promise<AuthUser | null> {
  const token = parseSessionToken(request);
  if (!token) {
    return null;
  }

  const tokenHash = await hashSessionToken(token);
  const session = await env.DB.prepare(
    `
      SELECT s.user_id, s.expires_at, u.id, u.email, u.name
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `,
  )
    .bind(tokenHash)
    .first<{ user_id: string; expires_at: string; id: string; email: string; name: string | null }>();

  if (!session || isSessionExpired(session.expires_at)) {
    if (session) {
      await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(tokenHash).run();
    }
    return null;
  }

  const permissions = await getUserPermissions(env.DB, session.id);

  return {
    id: session.id,
    email: session.email,
    name: session.name,
    permissions,
  };
}

export async function requireAuth(
  request: Request,
  env: Env,
): Promise<AuthUser | Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    const { unauthorized } = await import("../lib/response");
    return unauthorized();
  }

  return user;
}

export async function requirePermission(
  request: Request,
  env: Env,
  permission: string,
): Promise<AuthUser | Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  if (!userHasPermission(authResult.permissions, permission)) {
    const { forbidden } = await import("../lib/response");
    return forbidden(`Missing permission: ${permission}`);
  }

  return authResult;
}

export async function findUserByEmail(
  db: D1Database,
  email: string,
): Promise<(UserRow & { password_hash: string }) | null> {
  return db
    .prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?")
    .bind(email.toLowerCase().trim())
    .first<UserRow & { password_hash: string }>();
}

export async function createSession(
  db: D1Database,
  userId: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = sessionExpiresAt();

  await db
    .prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    )
    .bind(tokenHash, userId, expiresAt)
    .run();

  return { token, expiresAt };
}

export async function deleteSession(
  db: D1Database,
  token: string,
): Promise<void> {
  const tokenHash = await hashSessionToken(token);
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(tokenHash).run();
}

export async function countUsers(db: D1Database): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) AS count FROM users")
    .first<{ count: number }>();

  return result?.count ?? 0;
}

export async function createAdminUser(
  db: D1Database,
  email: string,
  passwordHash: string,
  name: string,
): Promise<string> {
  const userId = generateId("usr");

  await db.batch([
    db
      .prepare(
        "INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, 'admin')",
      )
      .bind(userId, email.toLowerCase().trim(), passwordHash, name),
    db
      .prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, 'role_admin')")
      .bind(userId),
  ]);

  return userId;
}

export function isAuthUser(value: AuthUser | Response): value is AuthUser {
  return !(value instanceof Response);
}
