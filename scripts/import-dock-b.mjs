// Import script for Dock B (Brygga B) berths and tenants
// Run with: node scripts/import-dock-b.mjs
//
// Notes:
//  - Berths 17 and 20 are shared/used by adjacent berths and are NOT imported
//  - Some berths have two tenants (e.g. "Peter Andersson/Peter Eriksson") — stored in comment
//  - Phone field may contain extra text — cleaned up per berth

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  setDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCGGMhp8H7pVuYeEM12DXMMAqptsTWTjOI",
  authDomain: "stegerholmenshamn.se",
  projectId: "stegerholmenshamn",
  storageBucket: "stegerholmenshamn.firebasestorage.app",
  messagingSenderId: "885107364018",
  appId: "1:885107364018:web:ec26d4b61d610e5344b9ab",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DOCK_NAME = "Brygga B";
const DOCK_PREFIX = "B";

// Berths 17 and 20 are intentionally excluded — they are shared by adjacent berths.
// Width and length are in centimeters as given in the Excel file.
const berths = [
  {
    num: 1,
    widthCm: 200,
    lengthCm: 500,
    name: "Peter Andersson/Peter Eriksson",
    firstName: "Peter",
    lastName: "Andersson",
    address: "Banjogatan 33 421 46 V. Fröl.",
    phone: "0703-951699",
    email: "fericsson@gmail.com",
    comment:
      "Två hyresgäster: Peter Eriksson (brandman) 0735-075527, Peter Andersson 0703-951699",
  },
  {
    num: 2,
    widthCm: 200,
    lengthCm: 500,
    name: "Sebastian Blomgren",
    firstName: "Sebastian",
    lastName: "Blomgren",
    address: "",
    phone: "0704463820",
    email: "Sebastian.Blomgren@hotmail.com",
    comment: "",
  },
  {
    num: 3,
    widthCm: 200,
    lengthCm: 500,
    name: "Ledig",
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
  },
  {
    num: 4,
    widthCm: 200,
    lengthCm: 500,
    name: "Ledig",
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
  },
  {
    num: 5,
    widthCm: 200,
    lengthCm: 500,
    name: "Johan Strannelind",
    firstName: "Johan",
    lastName: "Strannelind",
    address: "Bronsfyndsgatan 65, 421 63 Västra Frölunda",
    phone: "0738395125",
    email: "business.strannelind@gmail.com",
    comment: "",
  },
  {
    num: 6,
    widthCm: 200,
    lengthCm: 500,
    name: "Claes Ohlsson",
    firstName: "Claes",
    lastName: "Ohlsson",
    address: "Breviks Ängar 18",
    phone: "0706832966",
    email: "Claes.ohlsson@medic.gu.se",
    comment: "",
  },
  {
    num: 7,
    widthCm: 200,
    lengthCm: 500,
    name: "Erik Larsson",
    firstName: "Erik",
    lastName: "Larsson",
    address: "Nordfjällsvägen 12, Västra Frölunda",
    phone: "0723704200",
    email: "erikostrat79@gmail.com",
    comment: "",
  },
  {
    num: 8,
    widthCm: 200,
    lengthCm: 500,
    name: "Dan Sundström",
    firstName: "Dan",
    lastName: "Sundström",
    address: "Tjuvdalsvägen 4A",
    phone: "0723378830",
    email: "sundstrom.dan@gmail.com",
    comment: "",
  },
  {
    num: 9,
    widthCm: 200,
    lengthCm: 500,
    name: "Dag Wedin",
    firstName: "Dag",
    lastName: "Wedin",
    address: "Råstensgatan 52A, 41654 GÖTEBORG",
    phone: "0707656648",
    email: "dagwed@gmail.com",
    comment: "",
  },
  {
    num: 10,
    widthCm: 200,
    lengthCm: 500,
    name: "Claes Tornevall",
    firstName: "Claes",
    lastName: "Tornevall",
    address: "Sixten Camps Gata 6, 41648 Göteborg",
    phone: "0735-123476",
    email: "ctornevall@gmail.com",
    comment: "",
  },
  {
    num: 11,
    widthCm: 200,
    lengthCm: 500,
    name: "Ledig",
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
  },
  {
    num: 12,
    widthCm: 200,
    lengthCm: 500,
    name: "Gunnar Blomqvist",
    firstName: "Gunnar",
    lastName: "Blomqvist",
    address: "Lövmossev 3 436 39 Askim",
    phone: "0708415738",
    email: "gunnar.blomkvist@bilia.se",
    comment: "",
  },
  {
    num: 13,
    widthCm: 200,
    lengthCm: 500,
    name: "Peter Andersson/Peter Eriksson",
    firstName: "Peter",
    lastName: "Andersson",
    address: "Banjogatan 33 421 46 V. Fröl.",
    phone: "0703-951699",
    email: "fericsson@gmail.com",
    comment:
      "Två hyresgäster: Peter Eriksson (brandman) 0735-075527, Peter Andersson 0703-951699",
  },
  {
    num: 14,
    widthCm: 200,
    lengthCm: 500,
    name: "Louise Siverbrant",
    firstName: "Louise",
    lastName: "Siverbrant",
    address: "Näsets Backaväg 22 42166 V Frölunda",
    phone: "0708-169933",
    email: "louiseosiverbrant@gmail.com",
    comment: "",
  },
  {
    num: 15,
    widthCm: 200,
    lengthCm: 500,
    name: "Magnus Krook",
    firstName: "Magnus",
    lastName: "Krook",
    address: "N. Breviksv 72 421 67 V. Fröl",
    phone: "0707-388767",
    email: "ekmankrook@gmail.com",
    comment: "",
  },
  {
    num: 16,
    widthCm: 220,
    lengthCm: 630,
    name: "Christian Stenberg",
    firstName: "Christian",
    lastName: "Stenberg",
    address: "Breviks Ängar 17. 421 67 Västra Frölunda",
    phone: "070-2464064",
    email: "Christian@mystenberg.se",
    comment: "",
  },
  // Berth 17 is omitted — shared between berths 16 and 18
  {
    num: 18,
    widthCm: 220,
    lengthCm: 600,
    name: "Kristian Smidfelt",
    firstName: "Kristian",
    lastName: "Smidfelt",
    address: "Bastebergsvägen 3, 421 66 Västra Frölunda",
    phone: "0707998486",
    email: "kristian.smidfelt@vgregion.se",
    comment: "",
  },
  {
    num: 19,
    widthCm: 210,
    lengthCm: 600,
    name: "Mersad Babic",
    firstName: "Mersad",
    lastName: "Babic",
    address: "Breviks Ängar 6, 421 67 Västra Frölunda",
    phone: "0707755322",
    email: "mersadbabic@hotmail.com",
    comment: "",
  },
  // Berth 20 is omitted — shared between berths 19 and 21
  {
    num: 21,
    widthCm: 200,
    lengthCm: 580,
    name: "Erik Larsson",
    firstName: "Erik",
    lastName: "Larsson",
    address: "Nordfjällsvägen 12, Västra Frölunda",
    phone: "0723704200",
    email: "erikostrat79@gmail.com",
    comment: "",
  },
  {
    num: 22,
    widthCm: 200,
    lengthCm: 500,
    name: "Ledig",
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
  },
  {
    num: 23,
    widthCm: 200,
    lengthCm: 500,
    name: "Ledig",
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
  },
  {
    num: 24,
    widthCm: 200,
    lengthCm: 500,
    name: "Ledig",
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
  },
  {
    num: 25,
    widthCm: 200,
    lengthCm: 500,
    name: "Ledig",
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
  },
  {
    num: 26,
    widthCm: 200,
    lengthCm: 500,
    name: "Ledig",
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    email: "",
    comment: "",
  },
];

async function run() {
  try {
    // 1. Find or create Dock B
    const docksRef = collection(db, "docks");
    const docksSnap = await getDocs(docksRef);
    let dockId = null;

    for (const d of docksSnap.docs) {
      if (d.data().name === DOCK_NAME) {
        dockId = d.id;
        // Ensure prefix is set
        if (!d.data().prefix) {
          await updateDoc(doc(db, "docks", dockId), { prefix: DOCK_PREFIX });
          console.log(`  Updated prefix on existing dock.`);
        }
        break;
      }
    }

    if (!dockId) {
      dockId = crypto.randomUUID();
      await setDoc(doc(db, "docks", dockId), {
        name: DOCK_NAME,
        prefix: DOCK_PREFIX,
        type: "Association",
        managerIds: [],
      });
      console.log(`Created dock "${DOCK_NAME}" with ID: ${dockId}`);
    } else {
      console.log(`Found existing dock "${DOCK_NAME}" with ID: ${dockId}`);
    }

    // 2. Load all existing markingCodes to prevent duplicates
    const resourcesSnap = await getDocs(collection(db, "resources"));
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
        status: hasOccupant ? "Occupied" : "Available",
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

      const id = crypto.randomUUID();
      await setDoc(doc(db, "resources", id), data);

      const label = hasOccupant ? `${b.firstName} ${b.lastName}` : "Ledig";
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
