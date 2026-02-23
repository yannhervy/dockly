/**
 * One-time migration: add slug to existing news documents.
 *
 * Usage:
 *   set GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json
 *   node scripts/add-news-slugs.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

// Load service account key
const sa = JSON.parse(readFileSync("serviceAccountKey.json", "utf-8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const snap = await db.collection("news").get();
  const usedSlugs = new Set();
  let count = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.slug) {
      usedSlugs.add(data.slug);
      continue; // already has slug
    }

    let base = slugify(data.title || "untitled");
    let slug = base;
    let i = 2;
    while (usedSlugs.has(slug)) {
      slug = `${base}-${i}`;
      i++;
    }

    usedSlugs.add(slug);
    await doc.ref.update({ slug });
    count++;
    console.log(`  ${doc.id} -> ${slug}`);
  }

  console.log(`\nDone! Updated ${count} documents.`);
}

main().catch(console.error);
