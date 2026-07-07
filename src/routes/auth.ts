import {
  createSession,
  deleteSession,
  findUserByEmail,
  findUserById,
  isAuthUser,
  purgeExpiredSessions,
  requireAuth,
} from "../auth";
import { countRecentFailedLogins, getClientIp, writeAuditLog } from "../db/audit";
import {
  buildSessionCookie,
  clearSessionCookie,
  hashPassword,
  hashSessionToken,
  isSecureRequest,
  parseSessionToken,
  verifyPassword,
} from "../lib/crypto";
import {
  badRequest,
  conflict,
  ok,
  serverError,
  unauthorized,
} from "../lib/response";

interface LoginBody {
  email?: string;
  password?: string;
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as LoginBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return badRequest("email and password are required");
    }

    const ipAddress = getClientIp(request);
    await purgeExpiredSessions(env.DB);

    if (ipAddress) {
      const failures = await countRecentFailedLogins(env.DB, ipAddress);
      if (failures >= 10) {
        return unauthorized("Too many failed login attempts. Try again later.");
      }
    }

    const user = await findUserByEmail(env.DB, email);
    const activeRow = user
      ? await env.DB.prepare("SELECT is_active FROM users WHERE id = ?")
          .bind(user.id)
          .first<{ is_active: number | null }>()
      : null;

    if (
      !user ||
      activeRow?.is_active === 0 ||
      !(await verifyPassword(password, user.password_hash))
    ) {
      await writeAuditLog(env.DB, {
        actorId: user?.id ?? null,
        action: "login_failed",
        entityType: "auth",
        entityId: email,
        metadata: { email },
        ipAddress,
      });
      return unauthorized("Invalid email or password");
    }

    const session = await createSession(env.DB, user.id);

    await writeAuditLog(env.DB, {
      actorId: user.id,
      action: "login",
      entityType: "auth",
      entityId: user.id,
      metadata: { email: user.email },
      ipAddress,
    });
    const secure = isSecureRequest(request);

    return ok(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        expires_at: session.expiresAt,
      },
      {
        headers: {
          "Set-Cookie": buildSessionCookie(session.token, secure),
        },
      },
    );
  } catch (error) {
    console.error(error);
    return serverError();
  }
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  const token = parseSessionToken(request);

  if (token) {
    await deleteSession(env.DB, token);
  }

  if (isAuthUser(authResult)) {
    await writeAuditLog(env.DB, {
      actorId: authResult.id,
      action: "logout",
      entityType: "auth",
      entityId: authResult.id,
      ipAddress: getClientIp(request),
    });
  }

  return ok(
    { logged_out: true },
    {
      headers: {
        "Set-Cookie": clearSessionCookie(isSecureRequest(request)),
      },
    },
  );
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (!isAuthUser(authResult)) {
    return authResult;
  }

  return ok({
    id: authResult.id,
    email: authResult.email,
    name: authResult.name,
    permissions: authResult.permissions,
  });
}

interface UpdateProfileBody {
  name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleUpdateProfile(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const authResult = await requireAuth(request, env);
    if (!isAuthUser(authResult)) {
      return authResult;
    }

    const body = (await request.json()) as UpdateProfileBody;
    const currentPassword = body.current_password;
    const nextName = body.name?.trim();
    const nextEmail = body.email?.trim().toLowerCase();
    const newPassword = body.new_password;

    if (!currentPassword) {
      return badRequest("current_password is required");
    }

    const user = await findUserById(env.DB, authResult.id);
    if (!user) {
      return unauthorized();
    }

    if (!(await verifyPassword(currentPassword, user.password_hash))) {
      return unauthorized("Current password is incorrect");
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    const changes: Record<string, boolean> = {};

    if (nextName !== undefined && nextName !== (user.name ?? "")) {
      if (!nextName) {
        return badRequest("name cannot be empty");
      }
      updates.push("name = ?");
      values.push(nextName);
      changes.name = true;
    }

    if (nextEmail !== undefined && nextEmail !== user.email) {
      if (!EMAIL_PATTERN.test(nextEmail)) {
        return badRequest("email must be a valid email address");
      }

      const existing = await findUserByEmail(env.DB, nextEmail);
      if (existing && existing.id !== user.id) {
        return conflict("That email address is already in use");
      }

      updates.push("email = ?");
      values.push(nextEmail);
      changes.email = true;
    }

    if (newPassword !== undefined) {
      if (newPassword.length < 12) {
        return badRequest("new_password must be at least 12 characters");
      }

      const passwordHash = await hashPassword(newPassword);
      updates.push("password_hash = ?");
      values.push(passwordHash);
      changes.password = true;
    }

    if (updates.length === 0) {
      return badRequest("No profile changes were provided");
    }

    updates.push("updated_at = datetime('now')");
    values.push(user.id);

    await env.DB.prepare(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
    )
      .bind(...values)
      .run();

    if (changes.password) {
      const token = parseSessionToken(request);
      if (token) {
        const tokenHash = await hashSessionToken(token);
        await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?")
          .bind(user.id, tokenHash)
          .run();
      }
    }

    await writeAuditLog(env.DB, {
      actorId: user.id,
      action: "update",
      entityType: "user",
      entityId: user.id,
      metadata: { fields: Object.keys(changes) },
      ipAddress: getClientIp(request),
    });

    const updated = await findUserById(env.DB, user.id);

    return ok({
      id: updated!.id,
      email: updated!.email,
      name: updated!.name,
      updated: changes,
    });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
