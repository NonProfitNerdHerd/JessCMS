const UNSAFE_FILENAME = /[^a-zA-Z0-9._-]+/g;

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(UNSAFE_FILENAME, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 120) || "file";
}

export function extensionFromFilename(name: string): string | null {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : null;
}

export function isSafeStorageKey(key: string): boolean {
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    return false;
  }
  if (!key.startsWith("uploads/")) {
    return false;
  }
  const segments = key.split("/");
  if (segments.length < 4) {
    return false;
  }
  return segments.every((segment) => segment.length > 0 && !segment.includes(".."));
}

export function storageKeyFromMediaPath(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "");
  if (!normalized.startsWith("/media/")) {
    return null;
  }
  const key = normalized.slice("/media/".length);
  return isSafeStorageKey(key) ? key : null;
}

export function publicMediaPath(storageKey: string): string {
  return `/media/${storageKey}`;
}
