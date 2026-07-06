export type RouteHandler = (
  request: Request,
  env: Env,
  params: Record<string, string>,
) => Promise<Response>;

export interface RouteDefinition {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
}

export function matchRoute(
  method: string,
  pathname: string,
  routes: RouteDefinition[],
): { handler: RouteHandler; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }

    const match = pathname.match(route.pattern);
    if (!match) {
      continue;
    }

    const params: Record<string, string> = {};
    if (match.groups) {
      for (const [key, value] of Object.entries(match.groups)) {
        if (value !== undefined) {
          params[key] = value;
        }
      }
    }

    return { handler: route.handler, params };
  }

  return null;
}

export function staticRoute(
  method: string,
  path: string,
  handler: (request: Request, env: Env) => Promise<Response>,
): RouteDefinition {
  return {
    method,
    pattern: new RegExp(`^${escapeRegex(path)}$`),
    handler: (request, env) => handler(request, env),
  };
}

export function paramRoute(
  method: string,
  pathPattern: string,
  handler: RouteHandler,
): RouteDefinition {
  const paramNames: string[] = [];
  const regexBody = pathPattern
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
        return "(?<" + segment.slice(1) + ">[^/]+)";
      }

      return escapeRegex(segment);
    })
    .join("/");

  return {
    method,
    pattern: new RegExp(`^${regexBody}$`),
    handler,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
