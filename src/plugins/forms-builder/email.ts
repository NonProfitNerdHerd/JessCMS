/**
 * Email provider interface for form notifications.
 * Production sites should register a real provider; default logs to console.
 */

export interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  fromName?: string;
  fromEmail?: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailSendResult {
  ok: boolean;
  providerRef?: string;
  error?: string;
}

export interface EmailProvider {
  id: string;
  label: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

class ConsoleEmailProvider implements EmailProvider {
  id = "console";
  label = "Development logger";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.log(
      JSON.stringify({
        type: "form_email",
        to: message.to,
        subject: message.subject,
        replyTo: message.replyTo,
        preview: (message.text || message.html || "").slice(0, 280),
      }),
    );
    return { ok: true, providerRef: `console_${Date.now()}` };
  }
}

let activeProvider: EmailProvider = new ConsoleEmailProvider();

export function getEmailProvider(): EmailProvider {
  return activeProvider;
}

export function setEmailProvider(provider: EmailProvider): void {
  activeProvider = provider;
}

export function sanitizeEmailHeader(value: string): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function applyMergeTags(
  template: string,
  tags: Record<string, string>,
): string {
  return String(template ?? "").replace(/\{([a-z0-9:_-]+)\}/gi, (_, key: string) => {
    return tags[key] ?? tags[key.toLowerCase()] ?? "";
  });
}
