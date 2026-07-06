import { getClientIp } from "../../db/audit";

const DEFAULT_PEPPER = "jesscms-forms-ip-pepper-change-in-production";

export async function hashIpAddress(
  ip: string | null,
  pepper = DEFAULT_PEPPER,
): Promise<string | null> {
  if (!ip) return null;

  const data = new TextEncoder().encode(`${pepper}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getSubmissionIp(request: Request): string | null {
  return getClientIp(request);
}

export interface SpamCheckInput {
  honeypotValue?: unknown;
  honeypotEnabled?: boolean;
  turnstileToken?: string | null;
  turnstileEnabled?: boolean;
}

export interface SpamCheckResult {
  isSpam: boolean;
  turnstileVerified: boolean;
  reason?: string;
}

export function checkSubmissionSpam(input: SpamCheckInput): SpamCheckResult {
  if (input.honeypotEnabled !== false) {
    const hp = input.honeypotValue;
    if (hp !== undefined && hp !== null && String(hp).trim() !== "") {
      return { isSpam: true, turnstileVerified: false, reason: "honeypot" };
    }
  }

  if (input.turnstileEnabled) {
    const token = input.turnstileToken?.trim();
    if (!token) {
      return { isSpam: true, turnstileVerified: false, reason: "turnstile_missing" };
    }

    // Placeholder: real Turnstile siteverify call goes here when configured.
    return { isSpam: false, turnstileVerified: true };
  }

  return { isSpam: false, turnstileVerified: false };
}

export async function verifyTurnstileToken(
  _token: string,
  _secret: string,
): Promise<boolean> {
  // Placeholder for Cloudflare Turnstile siteverify integration.
  return true;
}
