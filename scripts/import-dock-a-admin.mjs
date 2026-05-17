// Import script for Dock A (Brygga A) berths and tenants
// Run with: node scripts/import-dock-a-admin.mjs
//
// Uses Firebase Admin SDK with Application Default Credentials.
// Make sure you are logged in: firebase login
//
// Notes:
//  - Berths 15-18 are "Avstigningsplats" (disembarkation points) — imported as Unavailable
//  - Berth 5 has two tenants (Ragna Stokke + Birgitt Stokke), both stored in comment
//  - Berth 24 has two contacts (Carina + Per Milch)
//  - Berth 28 has two tenants (Peter Andersson / Peter Eriksson), same as B-1 and B-13

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.GOOGLE_CLOUD_PROJECT = "stegerholmenshamn";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const DOCK_NAME = "Brygga A";
const DOCK_PREFIX = "A";

const berths = [
  {
    num: 1,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
    status: "Available",
  },
  {
    num: 2,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
    status: "Available",
  },
  {
    num: 3,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
    status: "Available",
  },
  {
    num: 4,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
    status: "Available",
  },
  {
    num: 5,
    widthCm: 200,
    lengthCm: 500,
    // Primary contact: Ragna Stokke; secondary: Birgitt Stokke
    firstName: "Ragna",
    lastName: "Stokke",
    address: "Bratta 14, N-2611 Lillehammar",
    phone: "0047-99564850",
    email: "pstokke@gmail.com",
    comment:
      "Två hyresgäster: Ragna Stokke 0047-99564850, Birgitt Stokke (dotter) 0047-93022551. Extra kopia till birgitstokke@gmail.com",
    status: "Occupied",
  },
  {
    num: 6,
    widthCm: 200,
    lengthCm: 500,
    firstName: "Heidar",
    lastName: "Hilmarsson",
    address: "Stegerholmsvägen 32, 42167 Västra Frölunda",
    phone: "0702034964",
    email: "heidar.hilmarsson@gmail.com",
    comment: "",
    status: "Occupied",
  },
  {
    num: 7,
    widthCm: 200,
    lengthCm: 500,
    firstName: "Juukka",
    lastName: "Leakssonen",
    address: "V Gunnesgärde 5 417 49 Göteborg",
    phone: "0709426660",
    email: "Jukkalax@hotmail.com",
    comment: "Alternativt telefonnummer: 031553068",
    status: "Occupied",
  },
  {
    num: 8,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
    status: "Available",
  },
  {
    num: 9,
    widthCm: 200,
    lengthCm: 500,
    firstName: "Jimmy",
    lastName: "Johansson",
    address: "Höjdgatan 155, 431 36 Mölndal",
    phone: "0763986896",
    email: "jimmy.gbg@gmail.com",
    comment: "",
    status: "Occupied",
  },
  {
    num: 10,
    widthCm: 200,
    lengthCm: 500,
    firstName: "Richard",
    lastName: "Johansson",
    address: "Pilegården 2D 436 35 Askim",
    phone: "031684717",
    email: "bosse48@live.se",
    comment: "",
    status: "Occupied",
  },
  {
    num: 11,
    widthCm: 200,
    lengthCm: 500,
    firstName: "Stig",
    lastName: "Stråhle",
    address: "Näsets Backaväg 30 42166 V Frölunda",
    phone: "0739-726231",
    email: "stig-gullmar@hotmail.com",
    comment: "",
    status: "Occupied",
  },
  {
    num: 12,
    widthCm: 200,
    lengthCm: 500,
    firstName: "Ulf",
    lastName: "Ahlcrona",
    address: "Västra Palettgatan 1 42166 Västra Frölunda",
    phone: "0705-348964",
    email: "ulf.ahlcrona@telia.com",
    comment: "",
    status: "Occupied",
  },
  {
    num: 13,
    widthCm: 200,
    lengthCm: 500,
    firstName: "Daniel",
    lastName: "Jons",
    address: "Lammevallsgatan 18 43144 Mölndal",
    phone: "0703-559551",
    email: "daniel.jons@vgregion.se",
    comment: "",
    status: "Occupied",
  },
  {
    num: 14,
    widthCm: 200,
    lengthCm: 500,
    firstName: "Johannes",
    lastName: "Hjelmåker",
    address: "Breviks Ängar 10, 42167 Västra Frölunda",
    phone: "0704313224",
    email: "johannes.hjelmaker@gmail.com",
    comment: "",
    status: "Occupied",
  },
  // Berths 15-18 are disembarkation spots — not regular bookable berths
  {
    num: 15,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "Avstigningsplats — ej tillgänglig för bokning",
    status: "Unavailable",
  },
  {
    num: 16,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "Avstigningsplats — ej tillgänglig för bokning",
    status: "Unavailable",
  },
  {
    num: 17,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "Avstigningsplats — ej tillgänglig för bokning",
    status: "Unavailable",
  },
  {
    num: 18,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "Avstigningsplats — ej tillgänglig för bokning",
    status: "Unavailable",
  },
  {
    num: 19,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
    status: "Available",
  },
  {
    num: 20,
    widthCm: 200,
    lengthCm: 500,
    firstName: "Jon",
    lastName: "Hällqvist",
    address: "Eklanda Byväg 12, 43159 Mölndal",
    phone: "070-4374600",
    email: "jonhallqvist@hotmail.com",
    comment: "",
    status: "Occupied",
  },
  {
    num: 21,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
    status: "Available",
  },
  {
    num: 22,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
    status: "Available",
  },
  {
    num: 23,
    widthCm: 200,
    lengthCm: 500,
    firstName: "Martin",
    lastName: "Mattiasson",
    address: "Basungatan 17 42140 Västra Frölunda",
    phone: "0735-156084",
    email: "m.mathiasson@outlook.com",
    comment: "",
    status: "Occupied",
  },
  {
    num: 24,
    widthCm: 200,
    lengthCm: 500,
    // Main contact: Per Milch (invoice); secondary: Carina Milch
    firstName: "Carina",
    lastName: "Milch",
    address: "Toppvägen 10 42166 V Frölunda",
    phone: "0709-319930",
    email: "per.milch@kalltorpsbygg.se",
    comment: "Carina Milch 0709-319930, Per Milch 0709-644548. E-post tillhör Per.",
    status: "Occupied",
  },
  {
    num: 25,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
    status: "Available",
  },
  {
    num: 26,
    widthCm: 200,
    lengthCm: 500,
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
    status: "Available",
  },
  {
    num: 27,
    widthCm: 200,
    lengthCm: 500,
    firstName: "Jan",
    lastName: "Hagwall",
    address: "Sandlyckev 39 421 66 V. Fröl.",
    phone: "",
    email: "hackenycken@icloud.com",
    comment: "",
    status: "Occupied",
  },
  {
    num: 28,
    widthCm: 200,
    lengthCm: 500,
    firstName: "Peter",
    lastName: "Andersson",
    address: "Banjogatan 33 421 46 V. Fröl.",
    phone: "0703-951699",
    email: "fericsson@gmail.com",
    comment:
      "Två hyresgäster: Peter Eriksson (brandman) 0735-075527, Peter Andersson 0703-951699",
    status: "Occupied",
  },
];

async function run() {
  try {
    // 1. Find or create Dock A
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

      const hasOccupant = !!(b.firstName || b.lastName);

      const data = {
        type: "Berth",
        markingCode,
        dockId,
        berthNumber: b.num,
        sortOrder: b.num,
        widthCm: b.widthCm,
        lengthCm: b.lengthCm,
        status: b.status,
        paymentStatus: "Unpaid",
        occupantIds: [],
        objectImageUrl: "",
      };

      if (b.firstName) data.occupantFirstName = b.firstName;
      if (b.lastName) data.occupantLastName = b.lastName;
      if (b.email) data.occupantEmail = b.email;
      if (b.phone) data.occupantPhone = b.phone;
      if (b.address) data.occupantAddress = b.address;
      if (b.comment) data.comment = b.comment;

      const newRef = db.collection("resources").doc();
      await newRef.set(data);

      let label;
      if (b.status === "Unavailable") label = "Avstigningsplats";
      else if (hasOccupant) label = `${b.firstName} ${b.lastName}`;
      else label = "Ledig";

      console.log(`  Created ${markingCode} — ${label}`);
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
