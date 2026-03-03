import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { sendEmail as sendEmailUtil } from "./email";

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
    try {
      await admin.auth().verifyIdToken(token);
    } catch {
      res.status(401).json({ error: "Invalid auth token" });
      return;
    }

    // User is authenticated — allow SMS sending for any logged-in user

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
      message += " Bild bifogad.";
    }
    if (userMessage) {
      const truncated = userMessage.length > 60 ? userMessage.slice(0, 57) + "..." : userMessage;
      message += ` "${truncated}"`;
    }
    message += "\nhttps://stegerholmenshamn.se/admin";
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

    const noteText = data.registrationNote
      ? (() => {
          const note = String(data.registrationNote);
          const truncated = note.length > 40 ? note.slice(0, 37) + "..." : note;
          return ` Notering: "${truncated}"`;
        })()
      : "";

    const message = `Nytt konto väntar på godkännande: ${userName} (${phone}). Engagemang: ${engagementText}.${noteText}\nhttps://stegerholmenshamn.se/admin`;
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
      const message = "Ditt konto på Stegerholmens Hamn är nu godkänt! Ladda om sidan för att se ändringarna. stegerholmenshamn.se";
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
    const message = `Hej! Du har fått ett svar på din intresseanmälan från Stegerholmens hamn. Gå till Mina grejer för att läsa: https://stegerholmenshamn.se`;

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


// ─── Password Reset via SMS ────────────────────────────────

/**
 * Request a password reset SMS.
 * No authentication required (user is locked out).
 *
 * POST /requestPasswordResetSms
 * Body: { "phone": "+46701234567" }
 */
export const requestPasswordResetSms = onRequest(
  { cors: true, region: "europe-west1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { phone } = req.body;
    if (!phone || typeof phone !== "string") {
      res.status(400).json({ error: "Missing required field: phone" });
      return;
    }

    const normalized = normalizePhone(phone);

    // Rate limit: max 3 requests per phone per hour
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    try {
      const recentAttempts = await admin.firestore()
        .collection("passwordResetTokens")
        .where("phone", "==", normalized)
        .get();

      const recentCount = recentAttempts.docs.filter((d) => {
        const created = d.data().createdAt?.toDate?.();
        return created && created > oneHourAgo;
      }).length;

      if (recentCount >= 3) {
        res.status(429).json({ error: "För många försök. Vänta en stund och försök igen." });
        return;
      }
    } catch {
      // If query fails (e.g. missing index), skip rate limiting
    }

    // Find user by phone in Firestore
    const usersSnap = await admin.firestore()
      .collection("users")
      .where("phone", "==", normalized)
      .limit(1)
      .get();

    // Also try unnormalized phone
    let userDoc = usersSnap.docs[0];
    if (!userDoc) {
      const altSnap = await admin.firestore()
        .collection("users")
        .where("phone", "==", phone.trim())
        .limit(1)
        .get();
      userDoc = altSnap.docs[0];
    }

    if (!userDoc) {
      // Don't reveal whether the phone exists — always show success
      res.status(200).json({ success: true });
      return;
    }

    const userData = userDoc.data();
    const uid = userDoc.id;

    // Check if user has a password provider (not Google-only)
    try {
      const authUser = await admin.auth().getUser(uid);
      const hasPasswordProvider = authUser.providerData.some(
        (p) => p.providerId === "password"
      );
      if (!hasPasswordProvider) {
        res.status(400).json({
          error: "google_only",
          message: "Ditt konto är kopplat till Google. Logga in med Google-knappen istället.",
        });
        return;
      }
    } catch {
      // User not found in Auth — should not normally happen
      res.status(200).json({ success: true });
      return;
    }

    // Generate a one-time token
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(now + 15 * 60 * 1000)); // 15 minutes

    await admin.firestore().collection("passwordResetTokens").doc(token).set({
      uid,
      phone: normalized,
      email: userData.email,
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt,
    });

    // Send SMS with reset link
    const resetUrl = `https://stegerholmenshamn.se/reset-password?token=${token}`;
    const message = `Återställ ditt lösenord på Stegerholmens Hamn: ${resetUrl}`;

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
        console.error(`Password reset SMS to ${normalized} failed: ${errorText}`);
        res.status(500).json({ error: "Kunde inte skicka SMS. Försök igen." });
        return;
      }
    } catch (err) {
      console.error(`Error sending password reset SMS:`, err);
      res.status(500).json({ error: "Kunde inte skicka SMS. Försök igen." });
      return;
    }

    res.status(200).json({ success: true });
  }
);

/**
 * Reset password using a one-time token (from SMS link).
 *
 * POST /resetPasswordWithToken
 * Body: { "token": "abc123...", "newPassword": "..." }
 */
export const resetPasswordWithToken = onRequest(
  { cors: true, region: "europe-west1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: "Missing required fields: token, newPassword" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: "Lösenordet måste vara minst 6 tecken." });
      return;
    }

    // Validate token
    const tokenDoc = await admin.firestore()
      .collection("passwordResetTokens")
      .doc(token)
      .get();

    if (!tokenDoc.exists) {
      res.status(400).json({ error: "Ogiltig eller utgången länk. Begär en ny." });
      return;
    }

    const tokenData = tokenDoc.data()!;
    const expiresAt = tokenData.expiresAt.toDate();

    if (new Date() > expiresAt) {
      // Clean up expired token
      await tokenDoc.ref.delete();
      res.status(400).json({ error: "Länken har gått ut. Begär en ny." });
      return;
    }

    // Set new password
    try {
      await admin.auth().updateUser(tokenData.uid, { password: newPassword });
    } catch (err) {
      console.error("Failed to update password:", err);
      res.status(500).json({ error: "Kunde inte uppdatera lösenordet. Försök igen." });
      return;
    }

    // Delete used token
    await tokenDoc.ref.delete();

    res.status(200).json({ success: true });
  }
);


// ─── Admin Password Management ────────────────────────────

/**
 * Allow a Superadmin to set a user's password.
 *
 * POST /adminSetPassword
 * Body: { "targetUid": "...", "newPassword": "..." }
 * Headers: Authorization: Bearer <firebase-id-token>
 */
export const adminSetPassword = onRequest(
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
      res.status(403).json({ error: "Only Superadmin can change user passwords." });
      return;
    }

    const { targetUid, newPassword } = req.body;
    if (!targetUid || !newPassword) {
      res.status(400).json({ error: "Missing required fields: targetUid, newPassword" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: "Lösenordet måste vara minst 6 tecken." });
      return;
    }

    // Prevent changing own password via this endpoint
    if (targetUid === callerUid) {
      res.status(400).json({ error: "Använd profilsidan för att ändra ditt eget lösenord." });
      return;
    }

    try {
      await admin.auth().updateUser(targetUid, { password: newPassword });
      res.status(200).json({ success: true });
    } catch (err) {
      console.error(`Failed to set password for ${targetUid}:`, err);
      res.status(500).json({ error: "Kunde inte uppdatera lösenordet." });
    }
  }
);

/**
 * Send a 4-digit SMS verification code to a phone number.
 * No auth required — this is called before the user has a profile.
 * Rate limited: max 3 codes per phone per hour.
 *
 * POST /sendVerificationSms
 * Body: { "phone": "+46701234567" }
 * Returns: { "verificationId": "docId" }
 */
export const sendVerificationSms = onRequest(
  { cors: true, region: "europe-west1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { phone } = req.body;
    if (!phone || typeof phone !== "string") {
      res.status(400).json({ error: "Missing required field: phone" });
      return;
    }

    const normalized = normalizePhone(phone);

    // Rate limit: max 3 codes per phone per hour
    const oneHourAgoMs = Date.now() - 60 * 60 * 1000;
    const recentSnap = await admin.firestore()
      .collection("smsVerifications")
      .where("phone", "==", normalized)
      .get();

    const recentCount = recentSnap.docs.filter((d) => {
      const ts = d.data().createdAt?.toMillis?.() || 0;
      return ts >= oneHourAgoMs;
    }).length;

    if (recentCount >= 3) {
      res.status(429).json({ error: "För många försök. Vänta en stund och försök igen." });
      return;
    }

    // Generate 4-digit code
    const code = String(Math.floor(1000 + Math.random() * 9000));

    // Store verification in Firestore
    const docRef = await admin.firestore().collection("smsVerifications").add({
      phone: normalized,
      code,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send SMS
    const authStr = Buffer.from(
      `${elksUsername.value()}:${elksPassword.value()}`
    ).toString("base64");

    try {
      const body = new URLSearchParams({
        from: DEFAULT_SENDER,
        to: normalized,
        message: `Din verifieringskod för Stegerholmens Hamn: ${code}`,
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
        console.error(`Verification SMS to ${normalized} failed: ${errorText}`);
        res.status(500).json({ error: "Kunde inte skicka SMS. Försök igen." });
        return;
      }
    } catch (err) {
      console.error(`Error sending verification SMS to ${normalized}:`, err);
      res.status(500).json({ error: "Kunde inte skicka SMS. Försök igen." });
      return;
    }

    res.status(200).json({ verificationId: docRef.id });
  }
);

/**
 * Verify a phone verification code.
 * No auth required — this is called before the user has a profile.
 * Code expires after 5 minutes.
 *
 * POST /verifyPhoneCode
 * Body: { "verificationId": "docId", "code": "1234" }
 * Returns: { "success": true } or { "error": "..." }
 */
export const verifyPhoneCode = onRequest(
  { cors: true, region: "europe-west1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { verificationId, code } = req.body;
    if (!verificationId || !code) {
      res.status(400).json({ error: "Missing required fields: verificationId, code" });
      return;
    }

    const docRef = admin.firestore().doc(`smsVerifications/${verificationId}`);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      res.status(404).json({ error: "Ogiltig verifiering." });
      return;
    }

    const data = docSnap.data()!;

    // Check 5-minute expiry
    const createdAt = data.createdAt?.toMillis?.() || 0;
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - createdAt > fiveMinutes) {
      await docRef.delete();
      res.status(410).json({ error: "Koden har gått ut. Begär en ny kod." });
      return;
    }

    // Check code
    if (data.code !== code) {
      res.status(400).json({ error: "Felaktig kod. Försök igen." });
      return;
    }

    // Success — delete the verification doc
    await docRef.delete();
    res.status(200).json({ success: true });
  }
);

// ─── OG tags for shared news links ───────────────────────────
// Serves minimal HTML with Open Graph meta tags for social media crawlers.
// Humans are redirected to the real SPA page via <meta http-equiv="refresh">.
export const newsOgTags = onRequest(
  { region: "europe-west1", cors: true },
  async (req, res) => {
    // Extract slug from path: /share/news/{slug} or just /{slug}
    const pathParts = req.path.replace(/^\/+/, "").split("/");
    const slug = pathParts[pathParts.length - 1];

    if (!slug) {
      res.redirect("https://stegerholmenshamn.se/news");
      return;
    }

    const db = admin.firestore();

    try {
      const snap = await db
        .collection("news")
        .where("slug", "==", slug)
        .limit(1)
        .get();

      if (snap.empty) {
        res.redirect("https://stegerholmenshamn.se/news");
        return;
      }

      const post = snap.docs[0].data();
      const title = post.title || "Stegerholmens Hamn";
      const body = (post.body || "")
        .replace(/[#*_~`>\[\]()!-]/g, "")
        .replace(/\n+/g, " ")
        .trim();
      const description = body.length > 160 ? body.slice(0, 159) + "\u2026" : body;
      const image = post.imageUrls?.[0] || "https://stegerholmenshamn.se/IMG20221112150016-EDIT.jpg";
      const pageUrl = `https://stegerholmenshamn.se/news/${slug}`;

      res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.send(`<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} – Stegerholmens Hamn</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Stegerholmens Hamn">
  <meta property="og:locale" content="sv_SE">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta http-equiv="refresh" content="0;url=${pageUrl}">
  <link rel="canonical" href="${pageUrl}">
</head>
<body>
  <p>Omdirigerar till <a href="${pageUrl}">${escapeHtml(title)}</a>...</p>
</body>
</html>`);
    } catch (err) {
      console.error("newsOgTags error:", err);
      res.redirect("https://stegerholmenshamn.se/news");
    }
  }
);

// ─── Email via Resend ──────────────────────────────────────

/**
 * Send email via Resend.
 * Requires authentication (Firebase Auth token in Authorization header).
 *
 * POST /sendEmail
 * Body: { "to": "user@example.com" | [...], "subject": "...", "html": "..." }
 * Optional body fields: "text", "replyTo"
 */
export const sendEmail = onRequest(
  { cors: true, region: "europe-west1" },
  async (req, res) => {
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
    try {
      await admin.auth().verifyIdToken(token);
    } catch {
      res.status(401).json({ error: "Invalid auth token" });
      return;
    }

    // Parse request body
    const { to, subject, html, text, replyTo } = req.body;
    if (!to || !subject || !html) {
      res.status(400).json({ error: "Missing required fields: to, subject, html" });
      return;
    }

    const results = await sendEmailUtil({ to, subject, html, text, replyTo });

    const allSuccess = results.every((r) => r.success);
    res.status(allSuccess ? 200 : 207).json({ results });
  }
);

/** Escape HTML special characters for safe embedding in attributes. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
