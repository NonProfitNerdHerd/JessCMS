export const PUBLISHED_WHERE =
  "(status = 'published' AND (published_at IS NULL OR datetime(published_at) <= datetime('now')))";

export const PUBLISHED_WHERE_PREFIX = (alias: string): string =>
  `(${alias}.status = 'published' AND (${alias}.published_at IS NULL OR datetime(${alias}.published_at) <= datetime('now')))`;
