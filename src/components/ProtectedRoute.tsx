"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@/lib/types";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Allowed roles. If empty, any authenticated user may access. */
  allowedRoles?: UserRole[];
}

/**
 * Wrapper that guards routes:
 * - Redirects to /login if not authenticated
 * - Shows "Access Denied" if role is insufficient
 */
export default function ProtectedRoute({
  children,
  allowedRoles = [],
}: ProtectedRouteProps) {
  const { firebaseUser, profile, loading, needsApproval } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace("/login");
    }
  }, [loading, firebaseUser, router]);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!firebaseUser) return null;

  // Pending approval gate
  if (needsApproval) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
          gap: 2,
          px: 3,
          textAlign: "center",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          ⏳ Väntar på godkännande
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500 }}>
          Ditt konto har skapats men behöver godkännas av en bryggansvarig innan
          du kan använda tjänsten. Du får ett SMS när ditt konto är godkänt.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500, mt: 1 }}>
          Under tiden kan du utforska sidan som gäst.
        </Typography>
        <a href="/" style={{ color: "#4FC3F7", fontWeight: 600, textDecoration: "none" }}>
          Gå till startsidan →
        </a>
      </Box>
    );
  }

  // Role check
  if (
    allowedRoles.length > 0 &&
    profile &&
    !allowedRoles.includes(profile.role)
  ) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
        }}
      >
        <Typography variant="h5" color="error">
          Access Denied
        </Typography>
      </Box>
    );
  }

  return <>{children}</>;
}
