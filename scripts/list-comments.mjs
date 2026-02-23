/**
 * List all internalComment and comment fields across collections.
 * Uses Application Default Credentials (from `firebase login`).
 *
 * Usage: node scripts/list-comments.mjs
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: applicationDefault(),
  projectId: "stegerholmenshamn",
});
const db = getFirestore();

async function listComments(collectionName, commentField) {
  const snap = await db.collection(collectionName).get();
  const results = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const value = data[commentField];
    if (value && typeof value === "string" && value.trim()) {
      results.push({
        id: doc.id,
        markingCode: data.markingCode || data.code || data.abandonedId || "",
        name: data.name || data.firstName
          ? `${data.firstName || ""} ${data.lastName || ""}`.trim()
          : "",
        [commentField]: value.trim(),
      });
    }
  }
  return results;
}

console.log("\n=== USERS — internalComment ===");
const users = await listComments("users", "internalComment");
if (users.length === 0) console.log("  (none)");
for (const u of users) {
  console.log(`  [${u.id}] ${u.name || "(no name)"}: "${u.internalComment}"`);
}

console.log("\n=== RESOURCES — internalComment ===");
const resources = await listComments("resources", "internalComment");
if (resources.length === 0) console.log("  (none)");
for (const r of resources) {
  console.log(`  [${r.markingCode}] "${r.internalComment}"`);
}

console.log("\n=== LAND STORAGE — comment ===");
const land = await listComments("landStorage", "comment");
if (land.length === 0) console.log("  (none)");
for (const l of land) {
  console.log(`  [${l.markingCode}] ${l.name}: "${l.comment}"`);
}

console.log("\n=== ABANDONED OBJECTS — comment ===");
const abandoned = await listComments("abandonedObjects", "comment");
if (abandoned.length === 0) console.log("  (none)");
for (const a of abandoned) {
  console.log(`  [#${a.markingCode}] "${a.comment}"`);
}

console.log("\nDone.");
