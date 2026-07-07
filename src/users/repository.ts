import { generateId } from "../lib/crypto";
import { hashPassword } from "../lib/crypto";
import {
  assertCanDisableUser,
  assertCanRemoveAdminRole,
  userIsAdmin,
} from "./guards";

export class ValidationError extends Error {
  constructor(public readonly errors: Record<string, string>) {
    super("Validation failed");
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_SLUG_PATTERN = /^[a-z][a-z0-9_-]{0,47}$/;

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
  roles?: Array<{ id: string; slug: string; name: string }>;
}

function mapUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    name: (row.name as string | null) ?? null,
    role: String(row.role ?? "editor"),
    is_active: row.is_active === 0 || row.is_active === false ? 0 : 1,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getUserRoles(
  db: D1Database,
  userId: string,
): Promise<Array<{ id: string; slug: string; name: string }>> {
  const result = await db
    .prepare(
      `
        SELECT r.id, r.slug, r.name
        FROM roles r
        INNER JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = ?
        ORDER BY r.name ASC
      `,
    )
    .bind(userId)
    .all<{ id: string; slug: string; name: string }>();

  return result.results ?? [];
}

export async function listUsers(db: D1Database): Promise<UserRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT id, email, name, role, is_active, created_at, updated_at
        FROM users
        ORDER BY email ASC
      `,
    )
    .all<Record<string, unknown>>();

  const users = (result.results ?? []).map(mapUser);
  for (const user of users) {
    user.roles = await getUserRoles(db, user.id);
  }
  return users;
}

export async function getUserById(db: D1Database, id: string): Promise<UserRecord | null> {
  const row = await db
    .prepare(
      `
        SELECT id, email, name, role, is_active, created_at, updated_at
        FROM users
        WHERE id = ?
      `,
    )
    .bind(id)
    .first<Record<string, unknown>>();

  if (!row) return null;
  const user = mapUser(row);
  user.roles = await getUserRoles(db, user.id);
  return user;
}

export async function createUser(
  db: D1Database,
  input: {
    email: string;
    name: string;
    password: string;
    role_ids: string[];
    legacy_role?: string;
  },
): Promise<UserRecord> {
  const errors: Record<string, string> = {};
  const email = input.email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Invalid email address";
  }
  if (!input.name?.trim()) {
    errors.name = "Name is required";
  }
  if (!input.password || input.password.length < 12) {
    errors.password = "Password must be at least 12 characters";
  }
  if (!input.role_ids?.length) {
    errors.role_ids = "At least one role is required";
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) {
    throw new ValidationError({ email: "Email already in use" });
  }

  const id = generateId("usr");
  const passwordHash = await hashPassword(input.password);
  const legacyRole = input.legacy_role ?? "editor";

  await db
    .prepare(
      `
        INSERT INTO users (id, email, password_hash, name, role, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `,
    )
    .bind(id, email, passwordHash, input.name.trim(), legacyRole)
    .run();

  await setUserRoles(db, id, input.role_ids);

  const created = await getUserById(db, id);
  if (!created) {
    throw new Error("Failed to create user");
  }
  return created;
}

export async function updateUser(
  db: D1Database,
  id: string,
  input: {
    name?: string;
    email?: string;
    role_ids?: string[];
    legacy_role?: string;
  },
  actorId: string,
): Promise<UserRecord> {
  const existing = await getUserById(db, id);
  if (!existing) {
    throw new NotFoundError();
  }

  const errors: Record<string, string> = {};
  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    if (!input.name.trim()) {
      errors.name = "Name cannot be empty";
    } else {
      updates.push("name = ?");
      values.push(input.name.trim());
    }
  }

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      errors.email = "Invalid email address";
    } else {
      const duplicate = await db
        .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
        .bind(email, id)
        .first();
      if (duplicate) {
        errors.email = "Email already in use";
      } else {
        updates.push("email = ?");
        values.push(email);
      }
    }
  }

  if (input.legacy_role !== undefined) {
    updates.push("role = ?");
    values.push(input.legacy_role);
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  if (input.role_ids !== undefined) {
    const hadAdmin = await userIsAdmin(db, id);
    const willHaveAdmin = input.role_ids.includes("role_admin");
    if (hadAdmin && !willHaveAdmin) {
      const guard = await assertCanRemoveAdminRole(db, id);
      if (guard) {
        throw new ValidationError({ role_ids: guard });
      }
    }
    await setUserRoles(db, id, input.role_ids);
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(id);
    await db
      .prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  const updated = await getUserById(db, id);
  return updated!;
}

export async function setUserRoles(
  db: D1Database,
  userId: string,
  roleIds: string[],
): Promise<void> {
  if (roleIds.length === 0) {
    throw new ValidationError({ role_ids: "At least one role is required" });
  }
  const valid = await db
    .prepare(`SELECT id FROM roles WHERE id IN (${roleIds.map(() => "?").join(",")})`)
    .bind(...roleIds)
    .all<{ id: string }>();

  if ((valid.results ?? []).length !== roleIds.length) {
    throw new ValidationError({ role_ids: "One or more roles are invalid" });
  }

  await db.prepare("DELETE FROM user_roles WHERE user_id = ?").bind(userId).run();
  for (const roleId of roleIds) {
    await db
      .prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)")
      .bind(userId, roleId)
      .run();
  }
}

export async function disableUser(
  db: D1Database,
  userId: string,
  actorId: string,
): Promise<UserRecord> {
  const existing = await getUserById(db, userId);
  if (!existing) {
    throw new NotFoundError();
  }

  const guard = await assertCanDisableUser(db, userId, actorId);
  if (guard) {
    throw new ValidationError({ user: guard });
  }

  await db
    .prepare(
      `
        UPDATE users SET is_active = 0, updated_at = datetime('now')
        WHERE id = ?
      `,
    )
    .bind(userId)
    .run();

  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();

  const user = await getUserById(db, userId);
  return user!;
}

export async function enableUser(db: D1Database, userId: string): Promise<UserRecord> {
  const existing = await getUserById(db, userId);
  if (!existing) {
    throw new NotFoundError();
  }

  await db
    .prepare(
      `
        UPDATE users SET is_active = 1, updated_at = datetime('now')
        WHERE id = ?
      `,
    )
    .bind(userId)
    .run();

  return (await getUserById(db, userId))!;
}

export async function resetUserPassword(
  db: D1Database,
  userId: string,
  password: string,
): Promise<void> {
  if (!password || password.length < 12) {
    throw new ValidationError({ password: "Password must be at least 12 characters" });
  }

  const existing = await getUserById(db, userId);
  if (!existing) {
    throw new NotFoundError();
  }

  const passwordHash = await hashPassword(password);
  await db
    .prepare(
      `
        UPDATE users SET password_hash = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
    )
    .bind(passwordHash, userId)
    .run();

  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

export function validateRoleSlug(slug: string): boolean {
  return ROLE_SLUG_PATTERN.test(slug);
}
