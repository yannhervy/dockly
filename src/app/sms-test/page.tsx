"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { sendSms } from "@/lib/sms";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import SmsIcon from "@mui/icons-material/Sms";
import PhoneIcon from "@mui/icons-material/Phone";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

export default function SmsTestPage() {
  const { profile } = useAuth();

  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    text: string;
  } | null>(null);

  const canSend =
    profile?.role === "Superadmin" || profile?.role === "Dock Manager";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !message.trim()) return;

    setSending(true);
    setResult(null);

    try {
      const results = await sendSms(phone.trim(), message.trim());
      const r = results[0];
      if (r.success) {
        setResult({
          success: true,
          text: `SMS sent successfully to ${r.to} (ID: ${r.id})`,
        });
        setPhone("");
        setMessage("");
      } else {
        setResult({
          success: false,
          text: `Failed to send to ${r.to}: ${r.error}`,
        });
      }
    } catch (err) {
      setResult({
        success: false,
        text: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSending(false);
    }
  };

  if (!canSend) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <Alert severity="warning" sx={{ maxWidth: 400 }}>
          You need Manager or Superadmin role to send SMS.
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 520,
        mx: "auto",
        mt: 4,
        px: 2,
      }}
    >
      <Card
        sx={{
          bgcolor: "rgba(13, 33, 55, 0.85)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(79,195,247,0.12)",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <SmsIcon sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              SMS Test
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Send a test SMS via 46elks
            </Typography>
          </Box>

          {result && (
            <Alert
              severity={result.success ? "success" : "error"}
              icon={result.success ? <CheckCircleIcon /> : <ErrorIcon />}
              sx={{ mb: 2 }}
              onClose={() => setResult(null)}
            >
              {result.text}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSend}>
            <TextField
              fullWidth
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0701234567"
              required
              sx={{ mb: 2.5 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon
                        fontSize="small"
                        sx={{ color: "text.secondary" }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              helperText="Swedish format (0701234567) or E.164 (+46701234567)"
            />

            <TextField
              fullWidth
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              multiline
              rows={4}
              sx={{ mb: 3 }}
              helperText={`${message.length} / 160 characters`}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={sending || !phone.trim() || !message.trim()}
              startIcon={
                sending ? <CircularProgress size={18} /> : <SendIcon />
              }
              sx={{ py: 1.2 }}
            >
              {sending ? "Sending..." : "Send SMS"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
