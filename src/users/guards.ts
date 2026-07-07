import { userHasPermission } from "../auth";

const ADMIN_ROLE_ID = "role_admin";
const ADMIN_PERMISSION_SLUGS = ["users.manage", "users:read", "users:create"];

export async function countActiveAdmins(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `
        SELECT COUNT(DISTINCT u.id) AS count
        FROM users u
        INNER JOIN user_roles ur ON ur.user_id = u.id
        WHERE ur.role_id = ?
          AND COALESCE(u.is_active, 1) = 1
      `,
    )
    .bind(ADMIN_ROLE_ID)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

export async function userIsAdmin(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `
        SELECT 1 AS ok
        FROM user_roles
        WHERE user_id = ? AND role_id = ?
      `,
    )
    .bind(userId, ADMIN_ROLE_ID)
    .first();

  return Boolean(row);
}

export async function userHasAdminAccess(
  db: D1Database,
  userId: string,
): Promise<boolean> {
  const permissions = await db
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

  const slugs = (permissions.results ?? []).map((row) => row.slug);
  return ADMIN_PERMISSION_SLUGS.some((required) => userHasPermission(slugs, required));
}

export async function assertCanDisableUser(
  db: D1Database,
  targetUserId: string,
  actorId: string,
): Promise<string | null> {
  if (targetUserId === actorId) {
    const actorIsAdmin = await userIsAdmin(db, actorId);
    if (actorIsAdmin) {
      const admins = await countActiveAdmins(db);
      if (admins <= 1) {
        return "You cannot disable your own account while you are the only active administrator";
      }
    }
  }

  const targetIsAdmin = await userIsAdmin(db, targetUserId);
  if (targetIsAdmin) {
    const admins = await countActiveAdmins(db);
    if (admins <= 1) {
      return "Cannot disable the last active administrator";
    }
  }

  return null;
}

export async function assertCanRemoveAdminRole(
  db: D1Database,
  userId: string,
): Promise<string | null> {
  const isAdmin = await userIsAdmin(db, userId);
  if (!isAdmin) return null;

  const admins = await countActiveAdmins(db);
  if (admins <= 1) {
    return "Cannot remove the administrator role from the last active administrator";
  }

  return null;
}

export async function assertRoleKeepsAdminAccess(
  db: D1Database,
  roleId: string,
  permissionIds: string[],
): Promise<string | null> {
  if (roleId !== ADMIN_ROLE_ID) return null;

  const critical = await db
    .prepare(
      `
        SELECT id FROM permissions
        WHERE slug IN ('users:read', 'users.manage', 'users:create', 'users:update')
      `,
    )
    .all<{ id: string }>();

  const criticalIds = new Set((critical.results ?? []).map((row) => row.id));
  const hasCritical = permissionIds.some((id) => criticalIds.has(id));
  if (!hasCritical) {
    return "The administrator role must retain user management permissions";
  }

  const admins = await countActiveAdmins(db);
  if (admins === 0) {
    return "Cannot strip permissions while no active administrators exist";
  }

  return null;
}
