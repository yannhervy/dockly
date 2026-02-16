/**
 * 46elks SMS Service
 *
 * Provides functions for sending SMS via the 46elks API.
 * Credentials are loaded from environment variables:
 *   ELKS_USERNAME, ELKS_PASSWORD
 *
 * Usage from scripts:
 *   import { sendSms, sendBulkSms } from "./sms-service";
 *   await sendSms("+46701234567", "Hello!");
 */

const API_URL = "https://api.46elks.com/a1/sms";
const SENDER_NAME = "Hamnen"; // Max 11 chars for alphanumeric sender ID

interface SmsResult {
  success: boolean;
  to: string;
  id?: string;
  error?: string;
}

interface ElksResponse {
  id: string;
  status: string;
  created: string;
  from: string;
  to: string;
  message: string;
  cost: number;
}

function getCredentials() {
  const username = process.env.ELKS_USERNAME;
  const password = process.env.ELKS_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Missing 46elks credentials. Set ELKS_USERNAME and ELKS_PASSWORD in .env.local"
    );
  }

  return { username, password };
}

/**
 * Normalize a Swedish phone number to E.164 format (+46...).
 * Handles common formats: 0701234567, 070-123 45 67, +46701234567
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // Handle Swedish numbers starting with 0
  if (cleaned.startsWith("0")) {
    cleaned = "+46" + cleaned.slice(1);
  }

  // Ensure it starts with +
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  return cleaned;
}

/**
 * Send a single SMS message.
 */
export async function sendSms(
  to: string,
  message: string,
  from: string = SENDER_NAME
): Promise<SmsResult> {
  const { username, password } = getCredentials();
  const normalizedTo = normalizePhoneNumber(to);

  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const body = new URLSearchParams({
    from,
    to: normalizedTo,
    message,
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: body.toString(),
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        to: normalizedTo,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data = (await response.json()) as ElksResponse;
    return {
      success: true,
      to: normalizedTo,
      id: data.id,
    };
  } catch (err) {
    return {
      success: false,
      to: normalizedTo,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send SMS to multiple recipients with the same message.
 * Returns results for each recipient.
 */
export async function sendBulkSms(
  recipients: string[],
  message: string,
  from: string = SENDER_NAME
): Promise<SmsResult[]> {
  const results: SmsResult[] = [];

  for (const to of recipients) {
    const result = await sendSms(to, message, from);
    results.push(result);

    // Small delay between messages to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  return results;
}
