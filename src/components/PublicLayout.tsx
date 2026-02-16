"use client";

import Box from "@mui/material/Box";
import PublicNavbar from "./PublicNavbar";
import PublicFooter from "./PublicFooter";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PublicNavbar />
      {/* Spacer for fixed AppBar (64px) */}
      <Box sx={{ mt: "64px", flex: 1 }}>
        {children}
      </Box>
      <PublicFooter />
    </Box>
  );
}
