import { generateId } from "../lib/crypto";
import { assertRoleKeepsAdminAccess } from "../users/guards";
import { validateRoleSlug, ValidationError, NotFoundError } from "../users/repository";

export interface RoleRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  permissions?: Array<{ id: string; slug: string; name: string }>;
}

export interface PermissionRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

const PROTECTED_ROLE_IDS = new Set(["role_admin", "role_editor", "role_viewer"]);

function mapRole(row: Record<string, unknown>): RoleRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listPermissions(db: D1Database): Promise<PermissionRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT id, slug, name, description
        FROM permissions
        ORDER BY slug ASC
      `,
    )
    .all<PermissionRecord>();

  return result.results ?? [];
}

export async function getRolePermissions(
  db: D1Database,
  roleId: string,
): Promise<PermissionRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT p.id, p.slug, p.name, p.description
        FROM permissions p
        INNER JOIN role_permissions rp ON rp.permission_id = p.id
        WHERE rp.role_id = ?
        ORDER BY p.slug ASC
      `,
    )
    .bind(roleId)
    .all<PermissionRecord>();

  return result.results ?? [];
}

export async function listRoles(db: D1Database): Promise<RoleRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT id, slug, name, description, created_at, updated_at
        FROM roles
        ORDER BY name ASC
      `,
    )
    .all<Record<string, unknown>>();

  const roles = (result.results ?? []).map(mapRole);
  for (const role of roles) {
    role.permissions = await getRolePermissions(db, role.id);
  }
  return roles;
}

export async function getRoleById(db: D1Database, id: string): Promise<RoleRecord | null> {
  const row = await db
    .prepare(
      `
        SELECT id, slug, name, description, created_at, updated_at
        FROM roles
        WHERE id = ?
      `,
    )
    .bind(id)
    .first<Record<string, unknown>>();

  if (!row) return null;
  const role = mapRole(row);
  role.permissions = await getRolePermissions(db, role.id);
  return role;
}

export async function createRole(
  db: D1Database,
  input: {
    slug: string;
    name: string;
    description?: string | null;
    permission_ids: string[];
  },
): Promise<RoleRecord> {
  const slug = input.slug.trim().toLowerCase();
  const errors: Record<string, string> = {};

  if (!validateRoleSlug(slug)) {
    errors.slug = "Role slug must be lowercase letters, numbers, hyphens, or underscores";
  }
  if (!input.name?.trim()) {
    errors.name = "Name is required";
  }

  const existing = await db
    .prepare("SELECT id FROM roles WHERE slug = ?")
    .bind(slug)
    .first();
  if (existing) {
    errors.slug = "Role slug already exists";
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  const id = generateId("role");
  await db
    .prepare(
      `
        INSERT INTO roles (id, slug, name, description)
        VALUES (?, ?, ?, ?)
      `,
    )
    .bind(id, slug, input.name.trim(), input.description?.trim() || null)
    .run();

  await setRolePermissions(db, id, input.permission_ids);

  const created = await getRoleById(db, id);
  if (!created) {
    throw new Error("Failed to create role");
  }
  return created;
}

export async function updateRole(
  db: D1Database,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    permission_ids?: string[];
  },
): Promise<RoleRecord> {
  const existing = await getRoleById(db, id);
  if (!existing) {
    throw new NotFoundError();
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    if (!input.name.trim()) {
      throw new ValidationError({ name: "Name cannot be empty" });
    }
    updates.push("name = ?");
    values.push(input.name.trim());
  }

  if (input.description !== undefined) {
    updates.push("description = ?");
    values.push(input.description?.trim() || null);
  }

  if (input.permission_ids !== undefined) {
    const guard = await assertRoleKeepsAdminAccess(db, id, input.permission_ids);
    if (guard) {
      throw new ValidationError({ permission_ids: guard });
    }
    await setRolePermissions(db, id, input.permission_ids);
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(id);
    await db
      .prepare(`UPDATE roles SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  return (await getRoleById(db, id))!;
}

export async function setRolePermissions(
  db: D1Database,
  roleId: string,
  permissionIds: string[],
): Promise<void> {
  if (permissionIds.length === 0 && roleId !== "role_admin") {
    // allow custom roles with zero permissions
  } else if (permissionIds.length === 0) {
    throw new ValidationError({ permission_ids: "Administrator role cannot have zero permissions" });
  }

  if (permissionIds.length > 0) {
    const valid = await db
      .prepare(
        `SELECT id FROM permissions WHERE id IN (${permissionIds.map(() => "?").join(",")})`,
      )
      .bind(...permissionIds)
      .all<{ id: string }>();

    if ((valid.results ?? []).length !== permissionIds.length) {
      throw new ValidationError({ permission_ids: "One or more permissions are invalid" });
    }
  }

  await db.prepare("DELETE FROM role_permissions WHERE role_id = ?").bind(roleId).run();
  for (const permissionId of permissionIds) {
    await db
      .prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)")
      .bind(roleId, permissionId)
      .run();
  }
}

export function isProtectedRole(roleId: string): boolean {
  return PROTECTED_ROLE_IDS.has(roleId);
}
