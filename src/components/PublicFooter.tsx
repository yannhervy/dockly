"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Popover from "@mui/material/Popover";
import AnchorIcon from "@mui/icons-material/Anchor";
import FacebookIcon from "@mui/icons-material/Facebook";

export default function PublicFooter() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

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

        {/* Copyright + Dockly */}
        <Typography variant="caption" color="text.secondary">
          © {new Date().getFullYear()} Stegerholmens Hamn ·{" "}
          <span
            onClick={(e) => setAnchorEl(e.currentTarget)}
            style={{ cursor: "pointer", color: "#4FC3F7" }}
          >
            Dockly
          </span>
        </Typography>
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Box sx={{ p: 2, maxWidth: 280 }}>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>
              Dockly Hamnsystem
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Vill du ha ett Dockly hamnsystem till din hamn?{" "}
              <a href="tel:+46733619893" style={{ color: "#4FC3F7", textDecoration: "none" }}>
                Kontakta Yann Hervy +46 733 61 98 93
              </a>
            </Typography>
          </Box>
        </Popover>
      </Box>
    </Box>
  );
}
