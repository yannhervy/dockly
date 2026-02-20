"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import AnchorIcon from "@mui/icons-material/Anchor";
import LockIcon from "@mui/icons-material/Lock";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

const FUNCTION_URL =
  "https://europe-west1-stegerholmenshamn.cloudfunctions.net/resetPasswordWithToken";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Validate the token is present
  const [invalidToken, setInvalidToken] = useState(false);
  useEffect(() => {
    if (!token) setInvalidToken(true);
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Lösenordet måste vara minst 6 tecken.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Lösenorden matchar inte.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Något gick fel. Försök igen.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Nätverksfel. Kontrollera din anslutning.");
    } finally {
      setLoading(false);
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
          maxWidth: 420,
          mx: 2,
          bgcolor: "rgba(13, 33, 55, 0.9)",
          backdropFilter: "blur(24px)",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Branding */}
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <AnchorIcon
              sx={{ fontSize: 48, color: "primary.main", mb: 1 }}
            />
            <Typography
              variant="h4"
              sx={{
                background:
                  "linear-gradient(135deg, #4FC3F7 0%, #FFB74D 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 0.5,
              }}
            >
              Stegerholmens Hamn
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Återställ ditt lösenord
            </Typography>
          </Box>

          {invalidToken ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              Ogiltig eller saknad återställningslänk. Begär en ny via inloggningssidan.
            </Alert>
          ) : success ? (
            <Box sx={{ textAlign: "center" }}>
              <CheckCircleOutlineIcon
                sx={{ fontSize: 64, color: "success.main", mb: 2 }}
              />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Lösenordet har uppdaterats!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Du kan nu logga in med ditt nya lösenord.
              </Typography>
              <Button
                variant="contained"
                fullWidth
                size="large"
                href="/login"
                sx={{ py: 1.2 }}
              >
                Gå till inloggning
              </Button>
            </Box>
          ) : (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Nytt lösenord"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  sx={{ mb: 2.5 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon
                            fontSize="small"
                            sx={{ color: "text.secondary" }}
                          />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? (
                              <VisibilityOff fontSize="small" />
                            ) : (
                              <Visibility fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  fullWidth
                  label="Bekräfta lösenord"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  sx={{ mb: 3 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon
                            fontSize="small"
                            sx={{ color: "text.secondary" }}
                          />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={loading}
                  sx={{ py: 1.2 }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    "Spara nytt lösenord"
                  )}
                </Button>
              </Box>
            </>
          )}

          {/* Footer */}
          <Box
            sx={{
              textAlign: "center",
              mt: 3,
              pt: 2,
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Button
              size="small"
              href="/login"
              sx={{ textTransform: "none", color: "text.secondary" }}
            >
              ← Tillbaka till inloggning
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

import { Suspense } from "react";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
