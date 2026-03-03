import { auth } from "./firebase";

const FUNCTION_URL =
  "https://europe-west1-stegerholmenshamn.cloudfunctions.net/sendEmail";

interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface EmailResult {
  to: string;
  success: boolean;
  id?: string;
  error?: string;
}

interface EmailResponse {
  results: EmailResult[];
}

/**
 * Send email via the Cloud Function endpoint.
 * Automatically attaches the current user's Firebase Auth token.
 *
 * @param to - Single email address or array of email addresses
 * @param subject - Email subject line
 * @param html - HTML body content
 * @param options - Optional: text fallback, replyTo address
 * @returns Array of results per recipient
 */
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  options?: { text?: string; replyTo?: string }
): Promise<EmailResult[]> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be logged in to send email");
  }

  const token = await user.getIdToken();

  const body: EmailRequest = { to, subject, html, ...options };

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok && response.status !== 207) {
    const error = await response.json();
    throw new Error(error.error || `Email request failed: ${response.status}`);
  }

  const data: EmailResponse = await response.json();
  return data.results;
}
