// Import script for Dock H berths
// Run with: node scripts/import-dock-h.mjs
// Uses Firebase Admin SDK with Application Default Credentials.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GOOGLE_CLOUD_PROJECT = "stegerholmenshamn";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const DOCK_NAME = "Brygga H";
const DOCK_PREFIX = "H";

// Data from user input
const berths = [
  { num: 14, name: "Rasmus Berndtsson", length: 6, width: 2.5 },
  { num: 12, name: "Micael Boman", length: 6, width: 2.5 },
  { num: 10, name: "Erik Carlberg", length: 6, width: 2.5 },
  { num: 8, name: "Lejf Norberg", length: 6, width: 2.5 },
  { num: 6, name: "", length: 6, width: 2.5 },
  { num: 4, name: "Emil Sommer", length: 6, width: 2.5 },
  
  { num: 17, name: "Rasmus Ågren", length: 5.5, width: 2.5 },
  { num: 15, name: "Ola Bakken", length: 5.5, width: 2.5 },
  { num: 13, name: "Mikael Hammar", length: 5.5, width: 2.5 },
  { num: 11, name: "Jenny Ekengren", length: 5.5, width: 2.5 },
  { num: 9, name: "", length: 6, width: 2.5 },
  { num: 7, name: "", length: 6, width: 2.5 },
  { num: 5, name: "Bengt Göran Eklund", length: 6, width: 2.5 },
  { num: 3, name: "Andreas Haggärde", length: 6, width: 2.5 },
];

async function run() {
  try {
    // 1. Find or create Dock H
    const docksRef = db.collection("docks");
    const docksSnap = await docksRef.get();
    let dockId = null;

    for (const d of docksSnap.docs) {
      if (d.data().name === DOCK_NAME) {
        dockId = d.id;
        if (!d.data().prefix) {
          await docksRef.doc(dockId).update({ prefix: DOCK_PREFIX });
          console.log(`  Updated prefix on existing dock.`);
        }
        break;
      }
    }

    if (!dockId) {
      const newDockRef = docksRef.doc();
      dockId = newDockRef.id;
      await newDockRef.set({
        name: DOCK_NAME,
        prefix: DOCK_PREFIX,
        type: "Association",
        managerIds: [],
      });
      console.log(`Created dock "${DOCK_NAME}" with ID: ${dockId}`);
    } else {
      console.log(`Found existing dock "${DOCK_NAME}" with ID: ${dockId}`);
    }

    // 2. Load existing markingCodes to prevent duplicates
    const resourcesSnap = await db.collection("resources").get();
    const existingCodes = new Set();
    for (const r of resourcesSnap.docs) {
      existingCodes.add(r.data().markingCode);
    }

    // 3. Import berths
    let created = 0;
    let skipped = 0;

    for (const b of berths) {
      const markingCode = `${DOCK_PREFIX}-${b.num}`;

      if (existingCodes.has(markingCode)) {
        console.log(`  Skipping ${markingCode} (already exists)`);
        skipped++;
        continue;
      }

      const hasOccupant = !!b.name;
      let firstName = "";
      let lastName = "";
      
      if (hasOccupant) {
        const parts = b.name.split(" ");
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
      }

      const data = {
        type: "Berth",
        markingCode,
        dockId,
        berthNumber: b.num,
        sortOrder: b.num,
        length: b.length,
        width: b.width,
        status: hasOccupant ? "Occupied" : "Available",
        paymentStatus: "Unpaid",
        occupantIds: [],
      };

      if (hasOccupant) {
        data.occupantFirstName = firstName;
        data.occupantLastName = lastName;
      }

      const newRef = db.collection("resources").doc();
      await newRef.set(data);

      const label = hasOccupant ? `${firstName} ${lastName}` : "Ledig";
      console.log(`  Created ${markingCode} — ${label} [${b.length}x${b.width}]`);
      created++;
    }

    console.log(`\nDone! Created ${created} berths, skipped ${skipped}.`);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
