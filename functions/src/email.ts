import { Resend } from "resend";
import { defineString } from "firebase-functions/params";

// Environment parameter — set in functions/.env or Firebase Console
const resendApiKey = defineString("RESEND_API_KEY");

// Default sender — must be verified in Resend dashboard.
// Use "onboarding@resend.dev" for testing before domain verification.
const DEFAULT_FROM = "Stegerholmens Hamn <noreply@stegerholmenshamn.se>";

let _resend: Resend | null = null;

/**
 * Lazily initialise the Resend client so that the API key
 * is only read at runtime (not at deploy/parse time).
 */
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(resendApiKey.value());
  }
  return _resend;
}

// ─── Types ─────────────────────────────────────────────────

export interface EmailOptions {
  /** Recipient email address(es) */
  to: string | string[];
  /** Email subject line */
  subject: string;
  /** HTML body */
  html: string;
  /** Optional plain-text fallback */
  text?: string;
  /** Override the default sender */
  from?: string;
  /** Reply-to address */
  replyTo?: string;
}

export interface EmailResult {
  to: string;
  success: boolean;
  id?: string;
  error?: string;
}

// ─── Core send function ────────────────────────────────────

/**
 * Send a single email via Resend.
 *
 * @example
 * ```ts
 * await sendEmail({
 *   to: "user@example.com",
 *   subject: "Welcome!",
 *   html: "<h1>Hello</h1><p>Welcome aboard.</p>",
 * });
 * ```
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult[]> {
  const resend = getResend();
  const from = options.from || DEFAULT_FROM;
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const results: EmailResult[] = [];

  for (const recipient of recipients) {
    try {
      const { data, error } = await resend.emails.send({
        from,
        to: recipient,
        subject: options.subject,
        html: options.html,
        ...(options.text && { text: options.text }),
        ...(options.replyTo && { replyTo: options.replyTo }),
      });

      if (error) {
        results.push({ to: recipient, success: false, error: error.message });
      } else {
        results.push({ to: recipient, success: true, id: data?.id });
      }
    } catch (err) {
      results.push({
        to: recipient,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
