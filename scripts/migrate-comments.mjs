/**
 * Migration: Convert existing `comment` fields on landStorage and
 * abandonedObjects into the new structured `internalComments` array.
 *
 * - byWho: fpw2TySbUhRLYwwmi9HoOG25hQy2 (Yann)
 * - date: Timestamp(0,0) — epoch 0 means "unknown date"
 * - The original `comment` field is preserved for legacy display
 *
 * Usage: node scripts/migrate-comments.mjs
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

initializeApp({
  credential: applicationDefault(),
  projectId: "stegerholmenshamn",
});
const db = getFirestore();

const YANN_UID = "fpw2TySbUhRLYwwmi9HoOG25hQy2";
const UNKNOWN_DATE = new Timestamp(0, 0); // epoch 0 = unknown date

async function migrateCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  let migrated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    // Skip if already has internalComments
    if (data.internalComments && data.internalComments.length > 0) {
      skipped++;
      continue;
    }

    // Skip if no comment to migrate
    const comment = (data.comment || "").trim();
    if (!comment) {
      skipped++;
      continue;
    }

    // Create the structured internal comment
    const internalComments = [
      {
        byWho: YANN_UID,
        date: UNKNOWN_DATE,
        comment: comment,
      },
    ];

    await doc.ref.update({ internalComments });
    migrated++;
    console.log(`  [${collectionName}] ${doc.id}: "${comment.slice(0, 60)}${comment.length > 60 ? "…" : ""}"`);
  }

  console.log(`  → ${migrated} migrated, ${skipped} skipped\n`);
  return migrated;
}

async function main() {
  console.log("=== Migrating comments to internalComments ===\n");

  console.log("Land Storage:");
  const landCount = await migrateCollection("landStorage");

  console.log("Abandoned Objects:");
  const abandonedCount = await migrateCollection("abandonedObjects");

  console.log(`Done! Total migrated: ${landCount + abandonedCount}`);
}

main().catch(console.error);
