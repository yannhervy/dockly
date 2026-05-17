// One-time script: shift GPS positions for Brygga A berths 1–14
// Each berth gets the GPS position of the berth below it:
//   A-14 ← A-13's position
//   A-13 ← A-12's position
//   ...
//   A-2  ← A-1's position
//   A-1  ← position cleared (no predecessor)
//
// Only lat, lng (and heading if present) are touched — no other fields are changed.
// Run with: node scripts/shift-gps-dock-a.mjs

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

process.env.GOOGLE_CLOUD_PROJECT = "stegerholmenshamn";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

// The berth numbers to shift, in ascending order (source → destination)
const SHIFT_RANGE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const DOCK_PREFIX = "A";

async function run() {
  try {
    // 1. Load all Brygga A berths in the shift range
    const snap = await db.collection("resources").get();

    // Build a map: markingCode -> { id, lat, lng, heading }
    const berthMap = {};
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.markingCode) continue;

      for (const num of SHIFT_RANGE) {
        const code = `${DOCK_PREFIX}-${num}`;
        if (data.markingCode === code) {
          berthMap[num] = {
            id: doc.id,
            markingCode: code,
            lat: data.lat ?? null,
            lng: data.lng ?? null,
            heading: data.heading ?? null,
          };
          break;
        }
      }
    }

    // Verify all berths were found
    for (const num of SHIFT_RANGE) {
      if (!berthMap[num]) {
        console.error(`ERROR: Could not find ${DOCK_PREFIX}-${num} in Firestore!`);
        process.exit(1);
      }
    }

    console.log("Current GPS positions:");
    for (const num of SHIFT_RANGE) {
      const b = berthMap[num];
      console.log(
        `  ${b.markingCode}: lat=${b.lat ?? "—"}, lng=${b.lng ?? "—"}, heading=${b.heading ?? "—"}`
      );
    }

    console.log("\nApplying shift (each berth gets the GPS of the one before it)...");

    // 2. Apply the shift in a batch
    //    Process from highest to lowest so we don't overwrite source data mid-loop
    const batch = db.batch();
    const maxNum = SHIFT_RANGE[SHIFT_RANGE.length - 1]; // 14
    const minNum = SHIFT_RANGE[0]; // 1

    for (let num = maxNum; num >= minNum; num--) {
      const dest = berthMap[num];
      const destRef = db.collection("resources").doc(dest.id);

      if (num === minNum) {
        // A-1: clear position (no predecessor)
        batch.update(destRef, {
          lat: FieldValue.delete(),
          lng: FieldValue.delete(),
          heading: FieldValue.delete(),
        });
        console.log(`  ${dest.markingCode} → position cleared`);
      } else {
        // A-N: gets A-(N-1)'s position
        const src = berthMap[num - 1];
        const update = {};

        if (src.lat !== null) {
          update.lat = src.lat;
        } else {
          update.lat = FieldValue.delete();
        }

        if (src.lng !== null) {
          update.lng = src.lng;
        } else {
          update.lng = FieldValue.delete();
        }

        if (src.heading !== null) {
          update.heading = src.heading;
        } else {
          update.heading = FieldValue.delete();
        }

        batch.update(destRef, update);
        console.log(
          `  ${dest.markingCode} ← ${src.markingCode} (lat=${src.lat ?? "—"}, lng=${src.lng ?? "—"})`
        );
      }
    }

    await batch.commit();
    console.log("\nDone! GPS positions shifted successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
