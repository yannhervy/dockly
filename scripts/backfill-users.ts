/**
 * Backfill script: Create Firestore user documents for Firebase Auth users
 * that are missing them.
 *
 * Usage:
 *   npx tsx scripts/backfill-users.ts
 *
 * Prerequisites:
 *   - Run `gcloud auth application-default login` first, OR
 *   - Set GOOGLE_APPLICATION_CREDENTIALS env var to a service account key file
 *
 * This script:
 *   1. Lists all Firebase Auth users
 *   2. Checks which ones are missing a Firestore users/{uid} document
 *   3. Creates a minimal user document for the missing ones
 *      (with phone="" so the setup page will prompt them to complete it)
 */

import * as admin from "firebase-admin";

// Initialize with application default credentials
admin.initializeApp({
  projectId: "stegerholmenshamn",
});

const db = admin.firestore();
const auth = admin.auth();

interface AuthUser {
  uid: string;
  email?: string;
  displayName?: string;
}

/**
 * List all Firebase Auth users (paginates through all pages).
 */
async function listAllAuthUsers(): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  let nextPageToken: string | undefined;

  do {
    const result = await auth.listUsers(1000, nextPageToken);
    for (const user of result.users) {
      users.push({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
    }
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  return users;
}

async function backfill() {
  console.log("Fetching all Firebase Auth users...");
  const authUsers = await listAllAuthUsers();
  console.log(`Found ${authUsers.length} Auth users total.\n`);

  let created = 0;
  let alreadyExists = 0;

  for (const authUser of authUsers) {
    const docRef = db.collection("users").doc(authUser.uid);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      alreadyExists++;
      console.log(`  ✓ ${authUser.email || authUser.uid} — already has profile`);
      continue;
    }

    // Derive a name from displayName or email
    const name = authUser.displayName
      || (authUser.email ? authUser.email.split("@")[0] : "");

    const userData = {
      email: authUser.email || "",
      name,
      role: "Tenant",
      isPublic: true,
      phone: "",  // Empty phone — setup page will prompt to complete
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.set(userData);
    created++;
    console.log(`  ✚ ${authUser.email || authUser.uid} — created user document`);
  }

  console.log(`\nBackfill complete!`);
  console.log(`  Already existed: ${alreadyExists}`);
  console.log(`  Created: ${created}`);
  console.log(`  Total Auth users: ${authUsers.length}`);

  process.exit(0);
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
