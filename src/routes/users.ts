import { isAuthUser, requirePermission } from "../auth";
import { getClientIp, writeAuditLog } from "../db/audit";
import {
  badRequest,
  created,
  forbidden,
  notFound,
  ok,
  serverError,
} from "../lib/response";
import {
  createUser,
  disableUser,
  enableUser,
  getUserById,
  listUsers,
  NotFoundError,
  resetUserPassword,
  updateUser,
  ValidationError,
} from "../users/repository";

function validationResponse(error: ValidationError): Response {
  return badRequest("Validation failed", error.errors);
}

export async function handleListUsers(request: Request, env: Env): Promise<Response> {
  const authResult = await requirePermission(request, env, "users:read");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const users = await listUsers(env.DB);
    return ok({
      items: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active === 1 || user.is_active === true,
        roles: user.roles,
        created_at: user.created_at,
        updated_at: user.updated_at,
      })),
    });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}

export async function handleGetUser(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "users:read");
  if (!isAuthUser(authResult)) return authResult;

  const user = await getUserById(env.DB, userId);
  if (!user) return notFound("User not found");

  return ok({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    is_active: user.is_active === 1 || user.is_active === true,
    roles: user.roles,
    created_at: user.created_at,
    updated_at: user.updated_at,
  });
}

interface CreateUserBody {
  email?: string;
  name?: string;
  password?: string;
  role_ids?: string[];
  legacy_role?: string;
}

export async function handleCreateUser(request: Request, env: Env): Promise<Response> {
  const authResult = await requirePermission(request, env, "users:create");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = (await request.json()) as CreateUserBody;
    const user = await createUser(env.DB, {
      email: body.email ?? "",
      name: body.name ?? "",
      password: body.password ?? "",
      role_ids: body.role_ids ?? [],
      legacy_role: body.legacy_role,
    });

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "create",
      entityType: "user",
      entityId: user.id,
      metadata: {
        email: user.email,
        role_ids: body.role_ids,
      },
      ipAddress: getClientIp(request),
    });

    return created({
      id: user.id,
      email: user.email,
      name: user.name,
      is_active: true,
      roles: user.roles,
    });
  } catch (error) {
    if (error instanceof ValidationError) return validationResponse(error);
    console.error(error);
    return serverError();
  }
}

interface UpdateUserBody {
  name?: string;
  email?: string;
  role_ids?: string[];
  legacy_role?: string;
}

export async function handleUpdateUser(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "users:update");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = (await request.json()) as UpdateUserBody;
    const before = await getUserById(env.DB, userId);
    if (!before) return notFound("User not found");

    const user = await updateUser(
      env.DB,
      userId,
      {
        name: body.name,
        email: body.email,
        role_ids: body.role_ids,
        legacy_role: body.legacy_role,
      },
      authResult.id,
    );

    const roleChanged =
      body.role_ids !== undefined &&
      JSON.stringify((before.roles ?? []).map((r) => r.id).sort()) !==
        JSON.stringify(body.role_ids.slice().sort());

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: roleChanged ? "update" : "update",
      entityType: roleChanged ? "role" : "user",
      entityId: roleChanged ? userId : userId,
      metadata: {
        user_id: userId,
        fields: Object.keys(body).filter((k) => body[k as keyof UpdateUserBody] !== undefined),
        role_changed: roleChanged,
        role_ids: body.role_ids,
      },
      ipAddress: getClientIp(request),
    });

    if (roleChanged) {
      await writeAuditLog(env.DB, {
        actorId: authResult.id,
        action: "update",
        entityType: "user_roles",
        entityId: userId,
        metadata: { role_ids: body.role_ids },
        ipAddress: getClientIp(request),
      });
    }

    return ok({
      id: user.id,
      email: user.email,
      name: user.name,
      is_active: user.is_active === 1 || user.is_active === true,
      roles: user.roles,
    });
  } catch (error) {
    if (error instanceof ValidationError) return validationResponse(error);
    if (error instanceof NotFoundError) return notFound("User not found");
    console.error(error);
    return serverError();
  }
}

export async function handleDisableUser(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "users:disable");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const user = await disableUser(env.DB, userId, authResult.id);

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "disable",
      entityType: "user",
      entityId: userId,
      metadata: { email: user.email },
      ipAddress: getClientIp(request),
    });

    return ok({ id: user.id, is_active: false });
  } catch (error) {
    if (error instanceof ValidationError) return forbidden(Object.values(error.errors)[0] ?? "Forbidden");
    if (error instanceof NotFoundError) return notFound("User not found");
    console.error(error);
    return serverError();
  }
}

export async function handleEnableUser(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "users:disable");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const user = await enableUser(env.DB, userId);

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "enable",
      entityType: "user",
      entityId: userId,
      metadata: { email: user.email },
      ipAddress: getClientIp(request),
    });

    return ok({ id: user.id, is_active: true });
  } catch (error) {
    if (error instanceof NotFoundError) return notFound("User not found");
    console.error(error);
    return serverError();
  }
}

interface ResetPasswordBody {
  password?: string;
}

export async function handleResetUserPassword(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const authResult = await requirePermission(request, env, "users:reset_password");
  if (!isAuthUser(authResult)) return authResult;

  try {
    const body = (await request.json()) as ResetPasswordBody;
    await resetUserPassword(env.DB, userId, body.password ?? "");

    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "reset_password",
      entityType: "user",
      entityId: userId,
      metadata: { method: "admin_temporary" },
      ipAddress: getClientIp(request),
    });

    return ok({ reset: true });
  } catch (error) {
    if (error instanceof ValidationError) return validationResponse(error);
    if (error instanceof NotFoundError) return notFound("User not found");
    console.error(error);
    return serverError();
  }
}
