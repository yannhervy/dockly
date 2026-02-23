/**
 * Convert a string into a URL-friendly slug.
 * Handles Swedish characters (å, ä, ö) and strips special chars.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9\s-]/g, "")   // remove non-alphanumeric
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-")             // collapse multiple hyphens
    .replace(/^-|-$/g, "");          // trim leading/trailing hyphens
}
