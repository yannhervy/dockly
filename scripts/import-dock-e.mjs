// Import script for Dock E berths and tenants
// Run with: node scripts/import-dock-e.mjs

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc, query, where, updateDoc } from "firebase/firestore";

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

const DOCK_NAME = "Brygga E";
const DOCK_PREFIX = "E";

const berths = [
  { num: 1, firstName: "Tarek", lastName: "Alfutih", email: "Tarek.alfutih@hotmail.com", phone: "0764-242132", comment: "", price2025: 1500 },
  { num: 2, firstName: "", lastName: "", email: "", phone: "", comment: "", price2025: 0 },
  { num: 3, firstName: "Henrik", lastName: "Hellander", email: "h.helander@outlook.com", phone: "070-222 63 52", comment: "", price2025: 3057 },
  { num: 4, firstName: "Staffan", lastName: "Redfors", email: "Staffan.redfors@telia.com", phone: "0704-221365", comment: "", price2025: 3114 },
  { num: 5, firstName: "Mats", lastName: "Jansson", email: "anneli.mats@telia.com", phone: "0706-460815", comment: "Vill gärna ha en plats längre ut", price2025: 3171 },
  { num: 6, firstName: "Hans", lastName: "Lindblad", email: "hanlind58@gmail.com", phone: "0725-283550", comment: "tom plats 2018", price2025: 3228 },
  { num: 7, firstName: "Lars", lastName: "Stråhle", email: "lars.strahle@gmail.com", phone: "0705-23 68 95", comment: "Hyr ut i andra hand till Jessicas kollega", price2025: 3284 },
  { num: 8, firstName: "Jessica", lastName: "Ek", email: "jessicaek79@gmail.com", phone: "0725-874255", comment: "", price2025: 3342 },
  { num: 9, firstName: "Carl", lastName: "Bengtsson", email: "carlb2138@gmail.com", phone: "0706-17 65 17", comment: "", price2025: 3400 },
  { num: 10, firstName: "Peter", lastName: "Teider", email: "peter.teider@gmail.com", phone: "0766-187674", comment: "", price2025: 3456 },
  { num: 11, firstName: "Linda", lastName: "Schweitz", email: "Linda.Schweitz@outlook.com", phone: "073-901 61 70", comment: "Bytt från E12", price2025: 3456 },
  { num: 12, firstName: "", lastName: "", email: "", phone: "", comment: "", price2025: 3370 },
  { num: 13, firstName: "Stig", lastName: "Fagerberg", email: "marianne.lindstrom2@hotmail.com", phone: "0706-955705", comment: "", price2025: 3284 },
  { num: 14, firstName: "Dag", lastName: "Magnusson", email: "uvodam@gmail.com", phone: "0761-042831", comment: "", price2025: 3200 },
  { num: 15, firstName: "Fredrik", lastName: "Friberg", email: "freddo83@hotmail.com", phone: "070-2 31 82 82", comment: "Nicolas granne", price2025: 3114 },
  { num: 16, firstName: "", lastName: "", email: "", phone: "", comment: "", price2025: 3028 },
  { num: 17, firstName: "", lastName: "", email: "", phone: "", comment: "", price2025: 1500 },
];

async function run() {
  try {
    // 1. Find or create Dock E
    const docksRef = collection(db, "docks");
    const docksSnap = await getDocs(docksRef);
    let dockId = null;

    for (const d of docksSnap.docs) {
      if (d.data().name === DOCK_NAME) {
        dockId = d.id;
        // Update prefix if missing
        if (!d.data().prefix) {
          await updateDoc(doc(db, "docks", dockId), { prefix: DOCK_PREFIX });
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

    // 2. Check existing berths to avoid duplicates
    const resourcesSnap = await getDocs(collection(db, "resources"));
    const existingCodes = new Set();
    for (const r of resourcesSnap.docs) {
      existingCodes.add(r.data().markingCode);
    }

    // 3. Import berths
    let created = 0;
    let skipped = 0;

    for (const b of berths) {
      const markingCode = `E-${b.num}`;

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
        status: hasOccupant ? "Occupied" : "Available",
        paymentStatus: "Unpaid",
        occupantIds: [],
        objectImageUrl: "",
      };

      if (b.firstName) data.occupantFirstName = b.firstName;
      if (b.lastName) data.occupantLastName = b.lastName;
      if (b.email) data.occupantEmail = b.email;
      if (b.phone) data.occupantPhone = b.phone;
      if (b.comment) data.comment = b.comment;
      if (b.price2025 > 0) data.price2025 = b.price2025;

      const id = crypto.randomUUID();
      await setDoc(doc(db, "resources", id), data);
      console.log(`  Created ${markingCode}${hasOccupant ? ` — ${b.firstName} ${b.lastName}` : " (empty)"}`);
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
