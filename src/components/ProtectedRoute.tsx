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
  const { firebaseUser, profile, loading } = useAuth();
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
