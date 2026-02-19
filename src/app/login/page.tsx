"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import AnchorIcon from "@mui/icons-material/Anchor";
import GoogleIcon from "@mui/icons-material/Google";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import EmailIcon from "@mui/icons-material/Email";
import LockIcon from "@mui/icons-material/Lock";

export default function LoginPage() {
  const { login, register, loginWithGoogle, resetPassword, firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect when auth state confirms user is logged in
  useEffect(() => {
    if (!authLoading && firebaseUser) {
      router.replace("/");
    }
  }, [authLoading, firebaseUser, router]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      // Navigation handled by useEffect above
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : isRegister ? "Registration failed" : "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle();
      // Navigation handled by useEffect above
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Enter your email address first");
      return;
    }
    setError("");
    try {
      await resetPassword(email);
      setSuccess("Password reset email sent! Check your inbox.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reset email";
      setError(msg);
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
              sx={{
                fontSize: 48,
                color: "primary.main",
                mb: 1,
              }}
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
              Logga in för att hantera din båtplats
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {/* Email / Password form */}
          <Box component="form" onSubmit={handleEmailSubmit}>
            <TextField
              fullWidth
              label="E-post"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2.5 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon fontSize="small" sx={{ color: "text.secondary" }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              fullWidth
              label="Lösenord"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 2 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon fontSize="small" sx={{ color: "text.secondary" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Box sx={{ textAlign: "right", mb: 2 }}>
              <Button
                size="small"
                onClick={handleForgotPassword}
                sx={{ textTransform: "none", color: "text.secondary" }}
              >
                Glömt lösenord?
              </Button>
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{ mb: 2, py: 1.2 }}
            >
              {isRegister ? "Skapa konto" : "Logga in"}
            </Button>
          </Box>

          {/* Toggle sign-in / register */}
          <Box sx={{ textAlign: "center", mb: 1 }}>
            <Typography variant="body2" color="text.secondary" component="span">
              {isRegister ? "Har du redan ett konto? " : "Har du inget konto? "}
            </Typography>
            <Button
              size="small"
              onClick={() => { setIsRegister(!isRegister); setError(""); setSuccess(""); }}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {isRegister ? "Logga in" : "Skapa konto"}
            </Button>
          </Box>

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">
              ELLER
            </Typography>
          </Divider>

          {/* Google sign-in */}
          <Button
            variant="outlined"
            fullWidth
            size="large"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleLogin}
            disabled={loading}
            sx={{
              py: 1.2,
              borderColor: "rgba(79, 195, 247, 0.3)",
              "&:hover": {
                borderColor: "primary.main",
                bgcolor: "rgba(79, 195, 247, 0.06)",
              },
            }}
          >
            Logga in med Google
          </Button>

          {/* Dockly footer */}
          <Box sx={{ textAlign: "center", mt: 3, pt: 2, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              Vill du ha ett Dockly hamnsystem till din hamn?{" "}
              <br />
              Kontakta Yann Hervy{" "}
              <a href="tel:+46733619893" style={{ color: "#4FC3F7", textDecoration: "none" }}>
                +46 733 61 98 93
              </a>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
