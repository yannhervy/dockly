// Import script for Dock G berths
// Run with: node scripts/import-dock-g.mjs
// Uses Firebase Admin SDK with Application Default Credentials.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GOOGLE_CLOUD_PROJECT = "stegerholmenshamn";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const DOCK_NAME = "Brygga G";
const DOCK_PREFIX = "G";

// Data from user input
const berths = [
  { num: 20, name: "Hung Tran", length: 5.5, width: 2.5 },
  { num: 18, name: "", length: 5.5, width: 2.5 },
  { num: 16, name: "Per Bjällmark", length: 5.5, width: 2.5 },
  { num: 14, name: "Ramona/Lars Jansson", length: 5.5, width: 2.5 },
  { num: 12, name: "Jan-Erik Ottosson", length: 5.5, width: 2.5 },
  { num: 10, name: "Michael Rittfeldt", length: 5.5, width: 2.5 },
  { num: 8, name: "Eive Nilsson", length: 5.5, width: 2.5 },
  { num: 6, name: "Andreas Olausson", length: 7, width: 2.5 },
  { num: 4, name: "Roger Elmersson", length: 7, width: 2.5 },
  { num: 2, name: "Conny Johansson", length: 7, width: 2.5 },
  
  { num: 19, name: "Mikaela Eriksson", length: 5.5, width: 2.5 },
  { num: 17, name: "Anders Wideman", length: 5.5, width: 2.5 },
  { num: 15, name: "Faton Begu", length: 5.5, width: 2.5 },
  { num: 13, name: "Stephan Winberg", length: 5.5, width: 2.5 },
  { num: 11, name: "Henrik Bergfalk", length: 5.5, width: 2.5 },
  { num: 9, name: "Håkan Johnson", length: 6, width: 2.5 },
  { num: 7, name: "Carl Sandberg", length: 6, width: 2.5 },
  { num: 5, name: "Johny Koch", length: 6, width: 2.5 },
  { num: 3, name: "Håkan Jonsson", length: 6.5, width: 2.5 },
  { num: 1, name: "Kent Johansson", length: 6.5, width: 2.5 },
];

async function run() {
  try {
    // 1. Find or create Dock G
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
        maxLength: b.length,
        maxWidth: b.width,
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
