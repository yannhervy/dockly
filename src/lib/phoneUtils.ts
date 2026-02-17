/**
 * Normalize a Swedish phone number to a consistent format for comparison.
 *
 * Examples:
 *   "+46 733 61 98 93"  → "0733619893"
 *   "+46733619893"      → "0733619893"
 *   "0733-619893"       → "0733619893"
 *   "0733619893"        → "0733619893"
 *   "733619893"         → "0733619893"
 *
 * Logic: strip all non-digit characters, then if the result starts with "46"
 * and is ≥ 10 digits, replace the leading "46" with "0".
 * If it doesn't start with "0", prepend "0".
 */
export function normalizePhone(input: string): string {
  if (!input) return "";

  // Strip everything that isn't a digit
  let digits = input.replace(/\D/g, "");

  // Handle +46 prefix (the "+" is already stripped)
  if (digits.startsWith("46") && digits.length >= 10) {
    digits = "0" + digits.slice(2);
  }

  // Ensure leading zero
  if (digits.length >= 9 && !digits.startsWith("0")) {
    digits = "0" + digits;
  }

  return digits;
}

/**
 * Check if two phone numbers match after normalization.
 * Returns false if either input is empty.
 */
export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na.length > 0 && nb.length > 0 && na === nb;
}
