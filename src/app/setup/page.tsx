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
import type { Resource, Berth, LandStorageEntry } from "@/lib/types";
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

/**
 * Profile setup page shown after first login when the user
 * has no Firestore profile yet. Requires name and phone number.
 *
 * On mount, searches existing resources and land storage entries
 * by email to pre-fill phone number and name when available.
 */
export default function ProfileSetupPage() {
  const { firebaseUser } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(firebaseUser?.displayName || "");
  const [phone, setPhone] = useState("");
  const [allowMapSms, setAllowMapSms] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Ids of matching resources/landStorage to link on submit
  const [matchedResourceIds, setMatchedResourceIds] = useState<string[]>([]);
  const [matchedLandIds, setMatchedLandIds] = useState<string[]>([]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    // Basic phone validation (at least 6 digits)
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 6) {
      setError("Please enter a valid phone number.");
      return;
    }

    if (!firebaseUser) return;

    setSaving(true);
    try {
      const userRef = doc(db, "users", firebaseUser.uid);
      const existingDoc = await getDoc(userRef);

      const profileData: Record<string, unknown> = {
        email: firebaseUser.email || "",
        name: name.trim(),
        isPublic: true,
        allowMapSms,
        phone: phone.trim(),
      };

      // Only set role and createdAt for genuinely new users
      if (!existingDoc.exists()) {
        profileData.role = "Tenant";
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

      // Force reload to pick up the new profile
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Error creating profile:", err);
      setError("Could not save profile. Please try again.");
      setSaving(false);
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
              Welcome to Dockly!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please complete your profile to continue.
              <br />
              Your phone number is required for harbor communication.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Full Name"
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
              label="Phone Number"
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
                  : "Required for harbor association communication"
              }
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
              disabled={saving}
              startIcon={<CheckCircleIcon />}
              sx={{ py: 1.2 }}
            >
              {saving ? "Saving..." : "Complete Profile"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
