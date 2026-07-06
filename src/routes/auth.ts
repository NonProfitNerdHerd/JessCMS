import {
  createSession,
  deleteSession,
  findUserByEmail,
  isAuthUser,
  requireAuth,
} from "../auth";
import {
  buildSessionCookie,
  clearSessionCookie,
  isSecureRequest,
  parseSessionToken,
  verifyPassword,
} from "../lib/crypto";
import {
  badRequest,
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

    const user = await findUserByEmail(env.DB, email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return unauthorized("Invalid email or password");
    }

    const session = await createSession(env.DB, user.id);
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
  const token = parseSessionToken(request);

  if (token) {
    await deleteSession(env.DB, token);
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
