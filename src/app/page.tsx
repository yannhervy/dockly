"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import AnchorIcon from "@mui/icons-material/Anchor";

export default function HomePage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (firebaseUser) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [loading, firebaseUser, router]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "80vh",
        gap: 2,
      }}
    >
      <AnchorIcon sx={{ fontSize: 64, color: "primary.main", animation: "pulse 2s infinite" }} />
      <Typography variant="h5" sx={{ color: "text.secondary" }}>
        Loading Dockly...
      </Typography>
      <CircularProgress size={32} />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
      `}</style>
    </Box>
  );
}
