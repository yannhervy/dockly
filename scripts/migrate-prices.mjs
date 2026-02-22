// Migration script: copy legacy price2025/price2026 fields → prices map
// Run with: node scripts/migrate-prices.mjs
// Only affects type === "Berth" documents

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCGGMhp8H7pVuYeEM12DXMMAqptsTWTjOI",
  authDomain: "stegerholmenshamn.firebaseapp.com",
  projectId: "stegerholmenshamn",
  storageBucket: "stegerholmenshamn.firebasestorage.app",
  messagingSenderId: "885107364018",
  appId: "1:885107364018:web:ec26d4b61d610e5344b9ab",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const snap = await getDocs(collection(db, "resources"));
    let updated = 0;
    let skipped = 0;
    let noPrices = 0;

    for (const d of snap.docs) {
      const data = d.data();

      // Only process Berth documents
      if (data.type !== "Berth") continue;

      const existingPrices = data.prices || {};
      let newPrices = { ...existingPrices };
      let changed = false;

      // Check all priceYYYY fields dynamically
      for (const [key, val] of Object.entries(data)) {
        const match = key.match(/^price(\d{4})$/);
        if (match && typeof val === "number" && val > 0) {
          const year = match[1];
          if (newPrices[year] == null) {
            // Only write if not already present in the prices map
            newPrices[year] = Math.round(val);
            changed = true;
            console.log(`  ${data.markingCode}: ${key}=${val} → prices.${year}=${Math.round(val)}`);
          } else {
            console.log(`  ${data.markingCode}: prices.${year} already exists (${newPrices[year]}), skipping legacy ${key}=${val}`);
          }
        }
      }

      if (changed) {
        await updateDoc(doc(db, "resources", d.id), { prices: newPrices });
        updated++;
      } else if (Object.keys(newPrices).length === 0) {
        noPrices++;
      } else {
        skipped++;
      }
    }

    console.log(`\nDone! Updated: ${updated}, Already migrated: ${skipped}, No prices: ${noPrices}`);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
