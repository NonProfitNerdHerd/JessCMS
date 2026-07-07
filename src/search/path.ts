export function resolveRoutePath(
  contentType: string,
  slug: string,
  routeBase?: string | null,
): string | null {
  switch (contentType) {
    case "page":
      return slug === "home" ? "/" : `/${slug}`;
    case "post":
      return `/blog/${slug}`;
    case "event":
      return `/events/${slug}`;
    case "form":
      return routeBase ? `${routeBase.replace(/\/+$/, "")}/${slug}` : null;
    default:
      if (routeBase) {
        return `${routeBase.replace(/\/+$/, "")}/${slug}`;
      }
      return null;
  }
}

export { resolveRoutePath as buildRoutePath };
