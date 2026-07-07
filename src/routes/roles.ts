import { isAuthUser, requirePermission } from "../auth";
import { getClientIp, writeAuditLog } from "../db/audit";
import {
  badRequest,
  created,
  notFound,
  ok,
  serverError,
} from "../lib/response";
import {
  createRole,
  getRoleById,
  listPermissions,
  listRoles,
  updateRole,
} from "../roles/repository";
import { NotFoundError, ValidationError } from "../users/repository";

function validationResponse(error: ValidationError): Response {
  return badRequest("Validation failed", error.errors);
}

export async function handleListRoles(request: Request, env: Env): Promise<Response> {
  const authResult = await requirePermission(request, env, "roles:read");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const roles = await listRoles(env.DB);
    return ok({ items: roles });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}

export async function handleGetRole(
  request: Request,
  env: Env,
  roleId: string,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "roles:read");
  if (!isAuthUser(authResult)) return authResult;

  const role = await getRoleById(env.DB, roleId);
  if (!role) return notFound("Role not found");
  return ok(role);
}

export async function handleListPermissions(
  request: Request,
  env: Env,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "permissions:read");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const permissions = await listPermissions(env.DB);
    return ok({ items: permissions });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}

interface CreateRoleBody {
  slug?: string;
  name?: string;
  description?: string | null;
  permission_ids?: string[];
}

export async function handleCreateRole(request: Request, env: Env): Promise<Response> {
  const authResult = await requirePermission(request, env, "roles:create");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = (await request.json()) as CreateRoleBody;
    const role = await createRole(env.DB, {
      slug: body.slug ?? "",
      name: body.name ?? "",
      description: body.description,
      permission_ids: body.permission_ids ?? [],
    });

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "create",
      entityType: "role",
      entityId: role.id,
      metadata: { slug: role.slug, permission_ids: body.permission_ids },
      ipAddress: getClientIp(request),
    });

    return created(role);
  } catch (error) {
    if (error instanceof ValidationError) return validationResponse(error);
    console.error(error);
    return serverError();
  }
}

interface UpdateRoleBody {
  name?: string;
  description?: string | null;
  permission_ids?: string[];
}

export async function handleUpdateRole(
  request: Request,
  env: Env,
  roleId: string,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "roles:update");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = (await request.json()) as UpdateRoleBody;
    const before = await getRoleById(env.DB, roleId);
    if (!before) return notFound("Role not found");

    const role = await updateRole(env.DB, roleId, body);

    const permissionChanged = body.permission_ids !== undefined;
    if (permissionChanged) {
      await writeAuditLog(env.DB, {
        actorId: authResult.id,
        action: "update",
        entityType: "permission",
        entityId: roleId,
        metadata: {
          role_id: roleId,
          role_slug: role.slug,
          permission_ids: body.permission_ids,
        },
        ipAddress: getClientIp(request),
      });
    }

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "update",
      entityType: "role",
      entityId: roleId,
      metadata: {
        fields: Object.keys(body).filter((k) => body[k as keyof UpdateRoleBody] !== undefined),
        permission_changed: permissionChanged,
      },
      ipAddress: getClientIp(request),
    });

    return ok(role);
  } catch (error) {
    if (error instanceof ValidationError) return validationResponse(error);
    if (error instanceof NotFoundError) return notFound("Role not found");
    console.error(error);
    return serverError();
  }
}
