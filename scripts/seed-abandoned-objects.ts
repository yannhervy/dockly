/**
 * Seed script: Import abandoned objects from photos in public/abandonedboats/.
 * Extracts GPS coordinates and date from EXIF data.
 *
 * Usage:
 *   npx tsx scripts/seed-abandoned-objects.ts
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, Timestamp } from "firebase/firestore";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import * as ExifParser from "exif-parser";

// Firebase configuration (same as main app)
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

async function seed() {
  const photosDir = resolve(__dirname, "../public/abandonedboats");
  const files = readdirSync(photosDir).filter((f) =>
    /\.(jpe?g)$/i.test(f)
  );

  console.log(`Found ${files.length} photos in ${photosDir}`);

  let abandonedId = 1;
  let successCount = 0;
  let noGpsCount = 0;

  for (const file of files.sort()) {
    const filePath = resolve(photosDir, file);
    const buffer = readFileSync(filePath);

    let lat: number | undefined;
    let lng: number | undefined;
    let dateStr: string | undefined;

    try {
      const parser = ExifParser.create(buffer);
      const result = parser.parse();

      // Extract GPS
      if (result.tags.GPSLatitude && result.tags.GPSLongitude) {
        lat = result.tags.GPSLatitude;
        lng = result.tags.GPSLongitude;
      }

      // Extract date (prefer DateTimeOriginal, fallback to CreateDate and ModifyDate)
      const exifDate =
        result.tags.DateTimeOriginal ||
        result.tags.CreateDate ||
        result.tags.ModifyDate;

      if (exifDate) {
        // exif-parser returns dates as Unix timestamps (seconds since epoch)
        const d = new Date(exifDate * 1000);
        dateStr = d.toISOString();
      }
    } catch (err) {
      console.warn(`  Warning: Could not parse EXIF from ${file}:`, err);
    }

    if (!lat || !lng) {
      console.log(`  Skipping ${file} — no GPS data found`);
      noGpsCount++;
      continue;
    }

    const abandonedSince = dateStr
      ? Timestamp.fromDate(new Date(dateStr))
      : Timestamp.now();

    const docId = `abandoned-${abandonedId}`;
    const data = {
      abandonedId,
      objectType: "Boat",
      lat,
      lng,
      imageUrl: `/abandonedboats/${file}`,
      abandonedSince,
      comment: "",
    };

    await setDoc(doc(db, "abandonedObjects", docId), data);
    console.log(
      `  #${abandonedId} ${file} → lat=${lat.toFixed(6)} lng=${lng.toFixed(6)} date=${dateStr || "now"}`
    );

    abandonedId++;
    successCount++;
  }

  console.log(`\nSeed complete!`);
  console.log(`  Imported: ${successCount}`);
  console.log(`  Skipped (no GPS): ${noGpsCount}`);
  console.log(`  Total photos: ${files.length}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
