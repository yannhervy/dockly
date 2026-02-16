"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import AnchorIcon from "@mui/icons-material/Anchor";
import FacebookIcon from "@mui/icons-material/Facebook";

export default function PublicFooter() {
  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        py: 4,
        px: 3,
        bgcolor: "rgba(10, 25, 41, 0.95)",
        borderTop: "1px solid rgba(79,195,247,0.08)",
      }}
    >
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "center", md: "flex-start" },
          gap: 3,
        }}
      >
        {/* Brand */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AnchorIcon sx={{ color: "primary.main" }} />
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            Stegerholmens Hamn
          </Typography>
        </Box>

        {/* Links */}
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/info" underline="hover" color="text.secondary" variant="body2">
            Om hamnen
          </Link>
          <Link href="/faq" underline="hover" color="text.secondary" variant="body2">
            FAQ
          </Link>
          <Link href="/docks" underline="hover" color="text.secondary" variant="body2">
            Bryggor
          </Link>
          <Link href="/marketplace" underline="hover" color="text.secondary" variant="body2">
            Köp &amp; Sälj
          </Link>
          <Link
            href="https://www.facebook.com/groups/batsamverkanstegerholmen"
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            color="text.secondary"
            variant="body2"
            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
          >
            <FacebookIcon sx={{ fontSize: 16 }} />
            Facebook
          </Link>
        </Box>

        {/* Copyright */}
        <Typography variant="caption" color="text.secondary">
          © {new Date().getFullYear()} Stegerholmens Hamn
        </Typography>
      </Box>
    </Box>
  );
}
