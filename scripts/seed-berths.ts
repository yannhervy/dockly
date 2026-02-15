/**
 * Seed script: Import berths from CSV into Firestore.
 *
 * Usage:
 *   npx tsx scripts/seed-berths.ts
 *
 * This script:
 *   1. Creates a dock document for "Brygga D" (or uses existing)
 *   2. Reads berth CSV data and creates resource documents
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

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

interface CsvRow {
  price2025: string;
  price2026: string;
  berthNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  postalAddress: string;
  comment: string;
}

function parseCsv(filePath: string): CsvRow[] {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());

  // Skip header
  const rows = lines.slice(1);

  return rows
    .map((line) => {
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
        price2025: fields[0] || "",
        price2026: fields[1] || "",
        berthNumber: fields[2] || "",
        firstName: fields[3] || "",
        lastName: fields[4] || "",
        phone: fields[5] || "",
        email: fields[6] || "",
        address: fields[7] || "",
        postalAddress: fields[8] || "",
        comment: fields[9] || "",
      };
    })
    .filter((r) => r.berthNumber && !isNaN(Number(r.berthNumber)));
}

async function getOrCreateDock(dockName: string): Promise<string> {
  // Check if dock already exists
  const q = query(collection(db, "docks"), where("name", "==", dockName));
  const snap = await getDocs(q);

  if (!snap.empty) {
    console.log(`Dock "${dockName}" already exists (ID: ${snap.docs[0].id})`);
    return snap.docs[0].id;
  }

  // Create new dock
  const dockRef = doc(collection(db, "docks"));
  await setDoc(dockRef, {
    name: dockName,
    type: "Association",
    managerIds: [],
  });
  console.log(`Created dock "${dockName}" (ID: ${dockRef.id})`);
  return dockRef.id;
}

async function seed() {
  // Configuration — edit these for each dock
  const DOCK_NAME = "Brygga D";
  const CSV_FILE = "berths-dock1.csv";

  const csvPath = resolve(__dirname, "../data", CSV_FILE);
  const rows = parseCsv(csvPath);
  console.log(`Parsed ${rows.length} berths from ${CSV_FILE}`);

  const dockId = await getOrCreateDock(DOCK_NAME);

  let occupied = 0;
  let available = 0;

  for (const row of rows) {
    const berthNum = parseInt(row.berthNumber, 10);
    const isLedig = row.firstName.toLowerCase() === "ledig" || !row.firstName;
    const isOccupied = !isLedig && row.firstName.length > 0;

    const markingCode = `D-${berthNum}`;

    const docData: Record<string, unknown> = {
      type: "Berth",
      dockId,
      berthNumber: berthNum,
      markingCode,
      status: isOccupied ? "Occupied" : "Available",
      paymentStatus: isOccupied ? "Paid" : "Unpaid",
      occupantFirstName: isOccupied ? row.firstName : "",
      occupantLastName: isOccupied ? row.lastName : "",
      occupantPhone: isOccupied ? row.phone : "",
      occupantEmail: isOccupied ? row.email : "",
      occupantAddress: isOccupied ? row.address : "",
      occupantPostalAddress: isOccupied ? row.postalAddress : "",
      comment: row.comment || (isLedig && row.firstName === "Ledig" ? row.comment : ""),
      updatedAt: Timestamp.now(),
    };

    // Add pricing if available
    if (row.price2025) docData.price2025 = parseInt(row.price2025, 10);
    if (row.price2026) docData.price2026 = parseInt(row.price2026, 10);

    // Use dockId + berth number as document ID for easy lookups
    const docId = `${dockId}_berth_${berthNum}`;
    await setDoc(doc(db, "resources", docId), docData);

    if (isOccupied) occupied++;
    else available++;

    console.log(
      `  ${markingCode}: ${isOccupied ? `${row.firstName} ${row.lastName}` : "Available"}`
    );
  }

  console.log(`\nSeed complete for ${DOCK_NAME}!`);
  console.log(`  Occupied: ${occupied}`);
  console.log(`  Available: ${available}`);
  console.log(`  Total: ${occupied + available}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
