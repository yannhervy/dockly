"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
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

/**
 * Profile setup page shown after first login when the user
 * has no Firestore profile yet. Requires name and phone number.
 */
export default function ProfileSetupPage() {
  const { firebaseUser } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(firebaseUser?.displayName || "");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
        phone: phone.trim(),
      };

      // Only set role and createdAt for genuinely new users
      if (!existingDoc.exists()) {
        profileData.role = "Tenant";
        profileData.createdAt = Timestamp.now();
      }

      await setDoc(userRef, profileData, { merge: true });
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
              helperText="Required for harbor association communication"
            />

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
