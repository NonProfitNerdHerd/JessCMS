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
  "media:read": ["media:read"],
  "media:create": ["media:create"],
  "media:update": ["media:update"],
  "media:delete": ["media:delete"],
  "forms:read": ["forms:read"],
  "forms:create": ["forms:create"],
  "forms:update": ["forms:update"],
  "forms:delete": ["forms:delete"],
  "forms:submissions:read": ["forms:submissions:read"],
  "forms:submissions:update": ["forms:submissions:update"],
  "workflow:submit": ["workflow:submit"],
  "workflow:approve": ["workflow:approve"],
  "workflow:publish": ["workflow:publish", "content:publish", "content.publish"],
  "revisions:read": ["revisions:read"],
  "revisions:restore": ["revisions:restore"],
  "users:read": ["users.manage", "users:read"],
  "users:create": ["users.manage", "users:create"],
  "users:update": ["users.manage", "users:update"],
  "users:disable": ["users.manage", "users:disable"],
  "users:reset_password": ["users.manage", "users:reset_password"],
  "roles:read": ["users.manage", "roles:read"],
  "roles:create": ["users.manage", "roles:create"],
  "roles:update": ["users.manage", "roles:update"],
  "permissions:read": ["users.manage", "permissions:read"],
  "audit:read": ["users.manage", "audit:read"],
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
      SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.is_active
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `,
  )
    .bind(tokenHash)
    .first<{
      user_id: string;
      expires_at: string;
      id: string;
      email: string;
      name: string | null;
      is_active: number | null;
    }>();

  if (
    !session ||
    isSessionExpired(session.expires_at) ||
    session.is_active === 0
  ) {
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

export async function findUserById(
  db: D1Database,
  userId: string,
): Promise<(UserRow & { password_hash: string }) | null> {
  return db
    .prepare("SELECT id, email, name, password_hash FROM users WHERE id = ?")
    .bind(userId)
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

export async function purgeExpiredSessions(db: D1Database): Promise<void> {
  await db
    .prepare("DELETE FROM sessions WHERE expires_at < datetime('now')")
    .run();
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
