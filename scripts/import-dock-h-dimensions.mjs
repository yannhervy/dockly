// Update script for Dock H berths dimensions
// Run with: node scripts/import-dock-h-dimensions.mjs

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GOOGLE_CLOUD_PROJECT = "stegerholmenshamn";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const DOCK_PREFIX = "H";

// Data from user input
const berths = [
  { num: 14, length: 6, width: 2.5 },
  { num: 12, length: 6, width: 2.5 },
  { num: 10, length: 6, width: 2.5 },
  { num: 8, length: 6, width: 2.5 },
  { num: 6, length: 6, width: 2.5 },
  { num: 4, length: 6, width: 2.5 },
  
  { num: 17, length: 5.5, width: 2.5 },
  { num: 15, length: 5.5, width: 2.5 },
  { num: 13, length: 5.5, width: 2.5 },
  { num: 11, length: 5.5, width: 2.5 },
  { num: 9, length: 6, width: 2.5 },
  { num: 7, length: 6, width: 2.5 },
  { num: 5, length: 6, width: 2.5 },
  { num: 3, length: 6, width: 2.5 },
];

async function run() {
  try {
    const resourcesSnap = await db.collection("resources").get();
    let updated = 0;

    for (const r of resourcesSnap.docs) {
      const data = r.data();
      if (!data.markingCode || !data.markingCode.startsWith(`${DOCK_PREFIX}-`)) continue;

      const numStr = data.markingCode.split("-")[1];
      const num = parseInt(numStr, 10);
      
      const b = berths.find(x => x.num === num);
      if (b) {
        await r.ref.update({
          maxWidth: b.width,
          maxLength: b.length
        });
        console.log(`Updated ${data.markingCode} to maxWidth: ${b.width}, maxLength: ${b.length}`);
        updated++;
      }
    }

    console.log(`\nDone! Updated ${updated} berths.`);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
