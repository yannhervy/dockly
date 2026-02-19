import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";

admin.initializeApp();

// Environment parameters — set via:
//   firebase functions:config:set elks.username="..." elks.password="..."
// Or for v2 params, set in .env file in functions/ dir or via Firebase Console
const elksUsername = defineString("ELKS_USERNAME");
const elksPassword = defineString("ELKS_PASSWORD");

const API_URL = "https://api.46elks.com/a1/sms";
const DEFAULT_SENDER = "Hamnen";

/**
 * Normalize a Swedish phone number to E.164 format (+46...).
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "+46" + cleaned.slice(1);
  }
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  return cleaned;
}

/**
 * Send SMS via 46elks.
 * Requires authentication (Firebase Auth token in Authorization header).
 *
 * POST /sendSms
 * Body: { "to": "+46701234567" | ["+46701234567", ...], "message": "Hello!" }
 *
 * Only users with role "Superadmin" or "Manager" can send SMS.
 */
export const sendSms = onRequest(
  { cors: true, region: "europe-west1" },
  async (req, res) => {
    // Only allow POST
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Verify Firebase Auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    let uid: string;
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      res.status(401).json({ error: "Invalid auth token" });
      return;
    }

    // Check user role in Firestore (only Superadmin/Manager can send SMS)
    const userDoc = await admin.firestore().doc(`users/${uid}`).get();
    const role = userDoc.data()?.role;
    if (!role || !["Superadmin", "Dock Manager"].includes(role)) {
      res.status(403).json({ error: "Insufficient permissions. Requires Dock Manager or Superadmin role." });
      return;
    }

    // Parse request body
    const { to, message, from } = req.body;
    if (!to || !message) {
      res.status(400).json({ error: "Missing required fields: to, message" });
      return;
    }

    const sender = from || DEFAULT_SENDER;
    const recipients: string[] = Array.isArray(to) ? to : [to];
    const auth = Buffer.from(`${elksUsername.value()}:${elksPassword.value()}`).toString("base64");

    const results = [];

    for (const recipient of recipients) {
      const normalized = normalizePhone(recipient);

      try {
        const body = new URLSearchParams({
          from: sender,
          to: normalized,
          message,
        });

        const response = await fetch(API_URL, {
          method: "POST",
          body: body.toString(),
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          results.push({ to: normalized, success: false, error: `HTTP ${response.status}: ${errorText}` });
        } else {
          const data = await response.json();
          results.push({ to: normalized, success: true, id: data.id });
        }
      } catch (err) {
        results.push({
          to: normalized,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Small delay between messages
      if (recipients.length > 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const allSuccess = results.every((r) => r.success);
    res.status(allSuccess ? 200 : 207).json({ results });
  }
);

/**
 * Firestore trigger: send SMS to all Superadmin users
 * when a new interest registration is created.
 */
export const onInterestCreated = onDocumentCreated(
  { document: "interests/{docId}", region: "europe-west1" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const userName = data.userName || "Okänd";
    const boatWidth = data.boatWidth || "?";
    const boatLength = data.boatLength || "?";
    const userMessage = data.message || "";

    // Fetch all superadmin users
    const usersSnap = await admin.firestore()
      .collection("users")
      .where("role", "==", "Superadmin")
      .get();

    const phones: string[] = [];
    usersSnap.forEach((doc) => {
      const phone = doc.data().phone;
      if (phone) phones.push(phone);
    });

    if (phones.length === 0) {
      console.log("No superadmin phone numbers found, skipping SMS.");
      return;
    }
    const hasImage = !!data.imageUrl;

    let message = `Ny intresseanmälan från ${userName}: ${boatWidth}×${boatLength}m.`;
    if (hasImage) {
      message += " 📷 Bild bifogad.";
    }
    if (userMessage) {
      message += ` "${userMessage}"`;
    }
    message += "\nhttps://stegerholmenshamn.web.app/admin";
    const auth = Buffer.from(
      `${elksUsername.value()}:${elksPassword.value()}`
    ).toString("base64");

    for (const phone of phones) {
      const normalized = normalizePhone(phone);
      try {
        const body = new URLSearchParams({
          from: DEFAULT_SENDER,
          to: normalized,
          message,
        });
        const response = await fetch(API_URL, {
          method: "POST",
          body: body.toString(),
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SMS to ${normalized} failed: ${errorText}`);
        } else {
          console.log(`SMS sent to ${normalized}`);
        }
      } catch (err) {
        console.error(`Error sending SMS to ${normalized}:`, err);
      }
    }
  }
);


/**
 * Delete a user completely: both the Firebase Auth account and the
 * Firestore users/{uid} document. Only Superadmin users may call this.
 *
 * POST /deleteUser
 * Body: { "uid": "theUserIdToDelete" }
 * Headers: Authorization: Bearer <firebase-id-token>
 */
export const deleteUser = onRequest(
  { cors: true, region: "europe-west1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Verify caller is authenticated
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    let callerUid: string;
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      callerUid = decoded.uid;
    } catch {
      res.status(401).json({ error: "Invalid auth token" });
      return;
    }

    // Verify caller is Superadmin
    const callerDoc = await admin.firestore().doc(`users/${callerUid}`).get();
    const callerRole = callerDoc.data()?.role;
    if (callerRole !== "Superadmin") {
      res.status(403).json({ error: "Only Superadmin can delete users." });
      return;
    }

    const { uid } = req.body;
    if (!uid || typeof uid !== "string") {
      res.status(400).json({ error: "Missing required field: uid" });
      return;
    }

    // Prevent self-deletion
    if (uid === callerUid) {
      res.status(400).json({ error: "You cannot delete your own account." });
      return;
    }

    const errors: string[] = [];

    // Delete Firestore user document
    try {
      await admin.firestore().doc(`users/${uid}`).delete();
    } catch (err) {
      console.error(`Failed to delete Firestore doc users/${uid}:`, err);
      errors.push("Failed to delete user profile.");
    }

    // Delete Firebase Auth account
    try {
      await admin.auth().deleteUser(uid);
    } catch (err) {
      console.error(`Failed to delete Auth user ${uid}:`, err);
      errors.push("Failed to delete auth account.");
    }

    if (errors.length > 0) {
      res.status(207).json({ success: false, errors });
    } else {
      res.status(200).json({ success: true });
    }
  }
);

// Engagement label mapping for SMS
const ENGAGEMENT_LABELS: Record<string, string> = {
  berth: "Båtplats",
  seahut: "Sjöbod",
  box: "Låda",
  landstorage: "Uppställning",
  interest: "Intresserad av båtplats",
  other: "Övrigt",
};

/**
 * Firestore trigger: send SMS to all Superadmin users
 * when a new user profile is created (approved === false).
 */
export const onUserCreated = onDocumentCreated(
  { document: "users/{uid}", region: "europe-west1" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // Only notify for new unapproved users
    if (data.approved !== false) return;

    const userName = data.name || "Okänd";
    const phone = data.phone || "—";
    const engagementArr: string[] = data.engagement || [];
    const engagementText = engagementArr
      .map((e: string) => ENGAGEMENT_LABELS[e] || e)
      .join(", ") || "Ej angivet";

    // Fetch all superadmin phone numbers
    const usersSnap = await admin.firestore()
      .collection("users")
      .where("role", "==", "Superadmin")
      .get();

    const phones: string[] = [];
    usersSnap.forEach((doc) => {
      const p = doc.data().phone;
      if (p) phones.push(p);
    });

    if (phones.length === 0) {
      console.log("No superadmin phone numbers found, skipping SMS.");
      return;
    }

    const noteText = data.registrationNote ? ` Notering: "${data.registrationNote}"` : "";

    const message = `Nytt konto väntar på godkännande: ${userName} (${phone}). Engagemang: ${engagementText}.${noteText}\nhttps://stegerholmenshamn.web.app/admin`;
    const authStr = Buffer.from(
      `${elksUsername.value()}:${elksPassword.value()}`
    ).toString("base64");

    for (const p of phones) {
      const normalized = normalizePhone(p);
      try {
        const body = new URLSearchParams({
          from: DEFAULT_SENDER,
          to: normalized,
          message,
        });
        const response = await fetch(API_URL, {
          method: "POST",
          body: body.toString(),
          headers: {
            Authorization: `Basic ${authStr}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SMS to ${normalized} failed: ${errorText}`);
        } else {
          console.log(`SMS sent to ${normalized}`);
        }
      } catch (err) {
        console.error(`Error sending SMS to ${normalized}:`, err);
      }
    }
  }
);


/**
 * Approve a pending user: set approved=true and send confirmation SMS.
 * Only Superadmin or Dock Manager can approve.
 *
 * POST /approveUser
 * Body: { "uid": "theUserIdToApprove" }
 * Headers: Authorization: Bearer <firebase-id-token>
 */
export const approveUser = onRequest(
  { cors: true, region: "europe-west1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Verify caller is authenticated
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    let callerUid: string;
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      callerUid = decoded.uid;
    } catch {
      res.status(401).json({ error: "Invalid auth token" });
      return;
    }

    // Verify caller is Superadmin or Dock Manager
    const callerDoc = await admin.firestore().doc(`users/${callerUid}`).get();
    const callerRole = callerDoc.data()?.role;
    if (!callerRole || !["Superadmin", "Dock Manager"].includes(callerRole)) {
      res.status(403).json({ error: "Only Superadmin or Dock Manager can approve users." });
      return;
    }

    const { uid } = req.body;
    if (!uid || typeof uid !== "string") {
      res.status(400).json({ error: "Missing required field: uid" });
      return;
    }

    // Set approved = true
    const userRef = admin.firestore().doc(`users/${uid}`);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    await userRef.update({ approved: true });

    // Send SMS to the approved user
    const userPhone = userDoc.data()?.phone;
    if (userPhone) {
      const normalized = normalizePhone(userPhone);
      const message = "Ditt konto på Stegerholmens Hamn är nu godkänt! Logga in på stegerholmenshamn.web.app";
      const authStr = Buffer.from(
        `${elksUsername.value()}:${elksPassword.value()}`
      ).toString("base64");

      try {
        const body = new URLSearchParams({
          from: DEFAULT_SENDER,
          to: normalized,
          message,
        });
        const response = await fetch(API_URL, {
          method: "POST",
          body: body.toString(),
          headers: {
            Authorization: `Basic ${authStr}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Approval SMS to ${normalized} failed: ${errorText}`);
        }
      } catch (err) {
        console.error(`Error sending approval SMS to ${normalized}:`, err);
      }
    }

    res.status(200).json({ success: true });
  }
);

/**
 * Send SMS to the interest owner when a reply is created.
 * Trigger: interests/{interestId}/replies/{replyId} created
 */
export const onInterestReplyCreated = onDocumentCreated(
  {
    document: "interests/{interestId}/replies/{replyId}",
    region: "europe-west1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const interestId = event.params.interestId;
    const replyData = snap.data();

    // Fetch the parent interest document
    const interestDoc = await admin
      .firestore()
      .collection("interests")
      .doc(interestId)
      .get();

    if (!interestDoc.exists) {
      console.log(`Interest ${interestId} not found, skipping SMS.`);
      return;
    }

    const interestData = interestDoc.data()!;
    const ownerPhone = interestData.phone;
    const ownerUserId = interestData.userId;

    // Don't SMS the owner if they replied to themselves
    if (replyData.authorId === ownerUserId) {
      console.log("Reply author is the interest owner, skipping SMS.");
      return;
    }

    if (!ownerPhone) {
      console.log("Interest owner has no phone number, skipping SMS.");
      return;
    }

    const normalized = normalizePhone(ownerPhone);
    const authorName = replyData.authorName || "Hamnförvaltningen";
    const message = `Hej! Du har fått ett svar på din intresseanmälan från ${authorName}. Logga in på stegerholmenshamn.web.app/dashboard för att läsa.`;

    const authStr = Buffer.from(
      `${elksUsername.value()}:${elksPassword.value()}`
    ).toString("base64");

    try {
      const body = new URLSearchParams({
        from: DEFAULT_SENDER,
        to: normalized,
        message,
      });
      const response = await fetch(API_URL, {
        method: "POST",
        body: body.toString(),
        headers: {
          Authorization: `Basic ${authStr}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Interest reply SMS to ${normalized} failed: ${errorText}`
        );
      } else {
        console.log(`Interest reply SMS sent to ${normalized}`);
      }
    } catch (err) {
      console.error(`Error sending interest reply SMS to ${normalized}:`, err);
    }
  }
);
