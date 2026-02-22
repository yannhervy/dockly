"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import type { Resource, Berth, LandStorageEntry, EngagementType } from "@/lib/types";
import { normalizePhone } from "@/lib/phoneUtils";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import InputAdornment from "@mui/material/InputAdornment";
import AnchorIcon from "@mui/icons-material/Anchor";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SmsIcon from "@mui/icons-material/Sms";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";

const CF_BASE = "https://europe-west1-stegerholmenshamn.cloudfunctions.net";

const ENGAGEMENT_OPTIONS: { value: EngagementType; label: string }[] = [
  { value: "berth", label: "Jag har båtplats" },
  { value: "seahut", label: "Jag har sjöbod" },
  { value: "box", label: "Jag har låda" },
  { value: "landstorage", label: "Jag har uppställning" },
  { value: "interest", label: "Intresserad av båtplats" },
  { value: "other", label: "Övrigt" },
];

/**
 * Profile setup page shown after first login when the user
 * has no Firestore profile yet. Requires name and phone number.
 *
 * Flow:
 * 1. Pre-fill from existing resources (email match)
 * 2. If match found → auto-approve on submit (no SMS verification)
 * 3. If no match → send 4-digit SMS code → verify → save as pending
 */
export default function ProfileSetupPage() {
  const { firebaseUser } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(firebaseUser?.displayName || "");
  const [phone, setPhone] = useState("");
  const [allowMapSms, setAllowMapSms] = useState(true);
  const [engagement, setEngagement] = useState<EngagementType[]>([]);
  const [registrationNote, setRegistrationNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Ids of matching resources/landStorage to link on submit
  const [matchedResourceIds, setMatchedResourceIds] = useState<string[]>([]);
  const [matchedLandIds, setMatchedLandIds] = useState<string[]>([]);

  // SMS verification state
  const [step, setStep] = useState<"form" | "verify" | "done">("form");
  const [verificationId, setVerificationId] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [autoApproved, setAutoApproved] = useState(false);

  const hasMatch = matchedResourceIds.length > 0 || matchedLandIds.length > 0;

  // Try to pre-fill phone and name from existing resources
  useEffect(() => {
    if (!firebaseUser?.email) return;
    const email = firebaseUser.email.trim().toLowerCase();

    async function prefillFromResources() {
      let foundPhone = "";
      let foundName = "";
      const resIds: string[] = [];
      const landIds: string[] = [];

      try {
        // Search resources (berths, sea huts, boxes)
        const resSnap = await getDocs(collection(db, "resources"));
        for (const d of resSnap.docs) {
          const data = d.data() as Resource;
          const berth = data as Berth;
          if (
            berth.occupantEmail &&
            berth.occupantEmail.trim().toLowerCase() === email
          ) {
            resIds.push(d.id);
            if (!foundPhone && berth.occupantPhone) {
              foundPhone = berth.occupantPhone;
            }
            if (!foundName && berth.occupantFirstName) {
              foundName = [berth.occupantFirstName, berth.occupantLastName]
                .filter(Boolean)
                .join(" ");
            }
          }
        }

        // Search land storage
        const landSnap = await getDocs(collection(db, "landStorage"));
        for (const d of landSnap.docs) {
          const data = d.data() as LandStorageEntry;
          if (data.email && data.email.trim().toLowerCase() === email) {
            landIds.push(d.id);
            if (!foundPhone && data.phone) {
              foundPhone = data.phone;
            }
            if (!foundName && data.firstName) {
              foundName = [data.firstName, data.lastName]
                .filter(Boolean)
                .join(" ");
            }
          }
        }
      } catch (err) {
        console.warn("Could not pre-fill from resources:", err);
      }

      if (foundPhone) {
        setPhone(foundPhone);
        setPrefilled(true);
      }
      if (foundName && !name) {
        setName(foundName);
      }
      setMatchedResourceIds(resIds);
      setMatchedLandIds(landIds);
    }

    prefillFromResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.email]);

  // Validate form fields
  const validateForm = (): boolean => {
    setError("");
    if (!name.trim()) {
      setError("Namn krävs.");
      return false;
    }
    if (!phone.trim()) {
      setError("Telefonnummer krävs.");
      return false;
    }
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 6) {
      setError("Ange ett giltigt telefonnummer.");
      return false;
    }
    if (engagement.length === 0) {
      setError("Välj minst ett engagemang.");
      return false;
    }
    return true;
  };

  // Save user profile to Firestore
  const saveProfile = async (approved: boolean, phoneVerified: boolean) => {
    if (!firebaseUser) return;

    const userRef = doc(db, "users", firebaseUser.uid);
    const existingDoc = await getDoc(userRef);

    const profileData: Record<string, unknown> = {
      email: firebaseUser.email || "",
      name: name.trim(),
      isPublic: true,
      allowMapSms,
      phone: phone.trim(),
      engagement,
      registrationNote: registrationNote.trim() || null,
    };

    // Only set role, approved, and createdAt for genuinely new users
    if (!existingDoc.exists()) {
      profileData.role = "Tenant";
      profileData.approved = approved;
      profileData.phoneVerified = phoneVerified;
      profileData.createdAt = Timestamp.now();
    }

    await setDoc(userRef, profileData, { merge: true });

    // Link matching resources to this user
    const uid = firebaseUser.uid;
    for (const resId of matchedResourceIds) {
      await updateDoc(doc(db, "resources", resId), {
        occupantIds: arrayUnion(uid),
      });
    }
    for (const landId of matchedLandIds) {
      await updateDoc(doc(db, "landStorage", landId), {
        occupantId: uid,
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!firebaseUser) return;

    setSaving(true);
    try {
      if (hasMatch) {
        // Auto-approve: email matched existing resources
        await saveProfile(true, false);
        setAutoApproved(true);
        setStep("done");
        setSubmitted(true);
      } else {
        // No match: send SMS verification code
        setSendingSms(true);
        const res = await fetch(`${CF_BASE}/sendVerificationSms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalizePhone(phone.trim()) }),
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { error: text }; }
        if (!res.ok) {
          throw new Error(data.error || "Kunde inte skicka SMS.");
        }
        setVerificationId(data.verificationId);
        setStep("verify");
        setSendingSms(false);
      }
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      setError(err instanceof Error ? err.message : "Något gick fel. Försök igen.");
    } finally {
      setSaving(false);
      setSendingSms(false);
    }
  };

  // Handle SMS code verification
  const handleVerifyCode = async () => {
    if (!smsCode.trim() || smsCode.length !== 4) {
      setError("Ange den 4-siffriga koden.");
      return;
    }

    setError("");
    setVerifying(true);
    try {
      const res = await fetch(`${CF_BASE}/verifyPhoneCode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationId, code: smsCode.trim() }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      if (!res.ok) {
        throw new Error(data.error || "Verifiering misslyckades.");
      }

      // Code verified — save profile as pending approval
      await saveProfile(false, true);
      setStep("done");
      setSubmitted(true);
    } catch (err) {
      console.error("Error verifying code:", err);
      setError(err instanceof Error ? err.message : "Verifiering misslyckades.");
    } finally {
      setVerifying(false);
    }
  };

  // Resend SMS code
  const handleResendCode = async () => {
    setError("");
    setSendingSms(true);
    try {
      const res = await fetch(`${CF_BASE}/sendVerificationSms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizePhone(phone.trim()) }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      if (!res.ok) {
        throw new Error(data.error || "Kunde inte skicka SMS.");
      }
      setVerificationId(data.verificationId);
      setSmsCode("");
    } catch (err) {
      console.error("Error resending SMS:", err);
      setError(err instanceof Error ? err.message : "Kunde inte skicka ny kod.");
    } finally {
      setSendingSms(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background:
          "radial-gradient(ellipse at 20% 50%, rgba(79,195,247,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(255,183,77,0.06) 0%, transparent 60%)",
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 460,
          mx: 2,
          bgcolor: "rgba(13, 33, 55, 0.9)",
          backdropFilter: "blur(24px)",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <AnchorIcon sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              Välkommen till Dockly!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Fyll i din profil för att fortsätta.
              <br />
              Ditt telefonnummer behövs för hamnens kommunikation.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* ─── Step 1: Profile form ─── */}
          {step === "form" && (
            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Namn"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                sx={{ mb: 2.5 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon fontSize="small" sx={{ color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <TextField
                fullWidth
                label="Telefonnummer"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="070-123 45 67"
                sx={{ mb: 3 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon fontSize="small" sx={{ color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                  },
                }}
                helperText={
                  prefilled
                    ? "Ifyllt automatiskt från befintliga hamnuppgifter"
                    : "Behövs för föreningens kommunikation"
                }
              />

              {/* Engagement chips */}
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Mitt engagemang i hamnen
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {ENGAGEMENT_OPTIONS.map((opt) => {
                    const selected = engagement.includes(opt.value);
                    return (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        variant={selected ? "filled" : "outlined"}
                        color={selected ? "primary" : "default"}
                        onClick={() =>
                          setEngagement((prev) =>
                            selected
                              ? prev.filter((v) => v !== opt.value)
                              : [...prev, opt.value]
                          )
                        }
                        sx={{ cursor: "pointer" }}
                      />
                    );
                  })}
                </Box>
              </Box>

              {/* Free-text note */}
              <TextField
                fullWidth
                label="Fritext"
                placeholder="T.ex. Brygga C plats 12, sjöbod 5, låda 3..."
                multiline
                minRows={2}
                maxRows={4}
                value={registrationNote}
                onChange={(e) => setRegistrationNote(e.target.value)}
                sx={{ mb: 2.5 }}
                helperText="Här får du gärna skriva vilken brygga, låda eller sjöbod du har så vi kan säkerställa att den knyts till dig."
              />

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  p: 1.5,
                  mb: 2,
                  borderRadius: 2,
                  bgcolor: "rgba(79, 195, 247, 0.05)",
                  border: "1px solid rgba(79,195,247,0.08)",
                }}
              >
                <SmsIcon fontSize="small" color="primary" />
                <FormControlLabel
                  control={
                    <Switch
                      checked={allowMapSms}
                      onChange={(e) => setAllowMapSms(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        SMS-kontakt från kartan
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Bryggförvaltare kan kontakta dig via SMS vid oväntade
                        händelser (inga personuppgifter publiceras)
                      </Typography>
                    </Box>
                  }
                  sx={{ m: 0 }}
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={saving || sendingSms}
                startIcon={sendingSms ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                sx={{ py: 1.2 }}
              >
                {sendingSms ? "Skickar SMS..." : saving ? "Sparar..." : "Skapa profil"}
              </Button>
            </Box>
          )}

          {/* ─── Step 2: SMS verification ─── */}
          {step === "verify" && (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <SmsIcon sx={{ fontSize: 48, color: "primary.main", mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Verifiera ditt telefonnummer
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Vi har skickat en 4-siffrig kod till <strong>{phone}</strong>.
                <br />
                Ange koden nedan för att verifiera ditt nummer.
              </Typography>

              <TextField
                fullWidth
                label="Verifieringskod"
                value={smsCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setSmsCode(v);
                }}
                placeholder="1234"
                slotProps={{
                  input: {
                    sx: { textAlign: "center", fontSize: "1.5rem", letterSpacing: "0.5rem" },
                  },
                }}
                sx={{ mb: 2 }}
              />

              <Button
                variant="contained"
                fullWidth
                size="large"
                disabled={verifying || smsCode.length !== 4}
                onClick={handleVerifyCode}
                startIcon={verifying ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                sx={{ py: 1.2, mb: 2 }}
              >
                {verifying ? "Verifierar..." : "Verifiera"}
              </Button>

              <Button
                variant="text"
                size="small"
                disabled={sendingSms}
                onClick={handleResendCode}
                sx={{ textTransform: "none" }}
              >
                {sendingSms ? "Skickar..." : "Skicka ny kod"}
              </Button>
            </Box>
          )}

          {/* ─── Step 3: Done ─── */}
          {step === "done" && submitted && (
            <Box sx={{ textAlign: "center", py: 3 }}>
              {autoApproved ? (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                    ✅ Profilen är skapad!
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Din e-post matchade befintliga hamnuppgifter.
                    Ditt konto är automatiskt godkänt!
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => router.push("/dashboard")}
                    sx={{ mt: 1 }}
                  >
                    Gå till Mina grejer →
                  </Button>
                </>
              ) : (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                    ✅ Profilen är skapad!
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                    Ditt telefonnummer är verifierat. Ditt konto behöver nu godkännas
                    av en bryggansvarig.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Du kan under tiden fortsätta att utforska sidan som gäst.
                    Du kommer få ett SMS när ditt konto är godkänt — ladda då om
                    sidan för att se ändringarna.
                  </Typography>
                  <a href="/" style={{ color: "#4FC3F7", fontWeight: 600, textDecoration: "none" }}>
                    Gå till startsidan →
                  </a>
                </>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
