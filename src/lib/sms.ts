import { auth } from "./firebase";

const FUNCTION_URL =
  "https://europe-west1-stegerholmenshamn.cloudfunctions.net/sendSms";

interface SmsRequest {
  to: string | string[];
  message: string;
  from?: string;
}

interface SmsResult {
  to: string;
  success: boolean;
  id?: string;
  error?: string;
}

interface SmsResponse {
  results: SmsResult[];
}

/**
 * Send SMS via the Cloud Function endpoint.
 * Automatically attaches the current user's Firebase Auth token.
 *
 * @param to - Single phone number or array of phone numbers
 * @param message - SMS text to send
 * @returns Array of results per recipient
 */
export async function sendSms(
  to: string | string[],
  message: string
): Promise<SmsResult[]> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be logged in to send SMS");
  }

  const token = await user.getIdToken();

  const body: SmsRequest = { to, message };

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
    throw new Error(error.error || `SMS request failed: ${response.status}`);
  }

  const data: SmsResponse = await response.json();
  return data.results;
}
