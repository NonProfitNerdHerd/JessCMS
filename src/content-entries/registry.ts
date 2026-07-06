/** Core content types with dedicated tables and legacy admin screens. */
export const LEGACY_CONTENT_TYPE_KEYS = new Set([
  "page",
  "post",
  "event",
  "form",
]);

export function isLegacyContentType(typeKey: string): boolean {
  return LEGACY_CONTENT_TYPE_KEYS.has(typeKey);
}

export function isGenericContentType(typeKey: string): boolean {
  return !isLegacyContentType(typeKey);
}

export function genericAdminBase(typeKey: string): string {
  return `/admin/content/${typeKey}`;
}
