/**
 * Seed script: Import land storage codes from CSV into Firestore.
 *
 * Usage:
 *   npx tsx scripts/seed-land-storage.ts
 *
 * Prerequisites:
 *   - npm install -D tsx (already a dev dependency or install separately)
 *   - Firebase project must have Firestore enabled
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, Timestamp } from "firebase/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

// Reuse the same Firebase config as the app
const firebaseConfig = {
  apiKey: "AIzaSyCGGMhp8H7pVuYeEM12DXMMAqptsTWTjOI",
  authDomain: "stegerholmenshamn.firebaseapp.com",
  projectId: "stegerholmenshamn",
  storageBucket: "stegerholmenshamn.firebasestorage.app",
  messagingSenderId: "885107364018",
  appId: "1:885107364018:web:ec26d4b61d610e5344b9ab",
};

// Read config from firebase.ts to avoid duplication
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface CsvRow {
  code: string;
  firstName: string;
  lastName: string;
  phone: string;
  comment: string;
}

function parseCsv(filePath: string): CsvRow[] {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());

  // Skip header
  const rows = lines.slice(1);

  return rows.map((line) => {
    // Handle quoted fields (CSV with commas inside quotes)
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    return {
      code: fields[0] || "",
      firstName: fields[1] || "",
      lastName: fields[2] || "",
      phone: fields[3] || "",
      comment: fields[4] || "",
    };
  });
}

async function seed() {
  const csvPath = resolve(__dirname, "../data/land-storage.csv");
  const rows = parseCsv(csvPath);

  console.log(`Parsed ${rows.length} rows from CSV`);

  let occupied = 0;
  let available = 0;

  for (const row of rows) {
    if (!row.code) continue;

    const isOccupied = row.firstName.length > 0;
    const docData = {
      code: row.code,
      status: isOccupied ? "Occupied" : "Available",
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      comment: row.comment,
      paymentStatus: isOccupied ? "Paid" : "Unpaid",
      updatedAt: Timestamp.now(),
    };

    // Use the code as the document ID for easy lookups
    await setDoc(doc(db, "landStorage", row.code), docData);

    if (isOccupied) occupied++;
    else available++;
  }

  console.log(`\nSeed complete!`);
  console.log(`  Occupied: ${occupied}`);
  console.log(`  Available: ${available}`);
  console.log(`  Total: ${occupied + available}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
