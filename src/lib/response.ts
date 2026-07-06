const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

function json(data: unknown, status: number, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(JSON_HEADERS);
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  }

  return new Response(JSON.stringify(data), { status, headers });
}

export function ok(data: unknown, init?: { headers?: HeadersInit }): Response {
  return json({ data }, 200, init?.headers);
}

export function created(data: unknown, init?: { headers?: HeadersInit }): Response {
  return json({ data }, 201, init?.headers);
}

export function badRequest(message: string, details?: unknown): Response {
  return json({ error: message, details }, 400);
}

export function unauthorized(message = "Unauthorized"): Response {
  return json({ error: message }, 401);
}

export function forbidden(message = "Forbidden"): Response {
  return json({ error: message }, 403);
}

export function notFound(message = "Not found"): Response {
  return json({ error: message }, 404);
}

export function serverError(message = "Internal server error"): Response {
  return json({ error: message }, 500);
}

/** @deprecated Use ok() or other helpers from lib/response */
export function jsonResponse(data: unknown, status = 200): Response {
  if (status >= 400) {
    return json(
      typeof data === "object" && data !== null && "error" in data
        ? data
        : { error: String(data) },
      status,
    );
  }

  return json(data, status);
}
