// One-off script to find and delete the resource with markingCode "57"
// Run with: node scripts/delete-resource-57.mjs

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

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
    let found = null;

    for (const d of snap.docs) {
      const data = d.data();
      if (data.markingCode === "57") {
        found = { id: d.id, ...data };
        break;
      }
    }

    if (!found) {
      console.log("No resource with markingCode '57' found.");
      process.exit(0);
    }

    console.log("Found resource to delete:");
    console.log(`  Document ID: ${found.id}`);
    console.log(`  Marking Code: ${found.markingCode}`);
    console.log(`  Type: ${found.type}`);
    console.log(`  Status: ${found.status}`);
    console.log(`  Occupant: ${found.occupantFirstName || ""} ${found.occupantLastName || ""}`);

    // Delete the resource
    await deleteDoc(doc(db, "resources", found.id));
    console.log("\n✓ Resource '57' deleted successfully!");

    // Verify SB-57 still exists
    let sb57 = null;
    const snap2 = await getDocs(collection(db, "resources"));
    for (const d of snap2.docs) {
      if (d.data().markingCode === "SB-57") {
        sb57 = { id: d.id, ...d.data() };
        break;
      }
    }

    if (sb57) {
      console.log(`\n✓ SB-57 still exists (ID: ${sb57.id}) — all good!`);
    } else {
      console.log("\n⚠ SB-57 not found — it may not exist yet.");
    }

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
