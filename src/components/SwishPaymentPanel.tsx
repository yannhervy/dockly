"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import MuiLink from "@mui/material/Link";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import QrCodeIcon from "@mui/icons-material/QrCode";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import { QRCodeSVG } from "qrcode.react";

// ─── Constants ──────────────────────────────────────────────
const SWISH_NUMBER = "1236594774"; // 123-659 47 74
const AMOUNT = 500;

type Season = "winter" | "summer";

const SEASON_LABELS: Record<Season, string> = {
  winter: "Vinteruppläggning",
  summer: "Sommaruppläggning",
};

const SEASON_PERIODS: Record<Season, string> = {
  winter: "1 sep – 1 jun",
  summer: "1 apr – 1 nov",
};

function buildSwishUrl(season: Season, code: string): string {
  const msg = `${SEASON_LABELS[season]} ${code}`;
  return `https://app.swish.nu/1/p/sw/?sw=${SWISH_NUMBER}&amt=${AMOUNT.toFixed(2)}&cur=SEK&msg=${encodeURIComponent(msg)}&src=qr`;
}

// ─── Component ──────────────────────────────────────────────
interface SwishPaymentPanelProps {
  /** Land storage marking code, e.g. "7894" */
  code: string;
}

export default function SwishPaymentPanel({ code }: SwishPaymentPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm")) ||
    useMediaQuery("(pointer: coarse)");

  const [season, setSeason] = useState<Season>("winter");
  const [forceQr, setForceQr] = useState(false);

  const showQr = !isMobile || forceQr;
  const swishUrl = buildSwishUrl(season, code);

  return (
    <Box
      sx={{
        mt: 2,
        p: 2.5,
        borderRadius: 2,
        bgcolor: "rgba(79,195,247,0.04)",
        border: "1px solid rgba(79,195,247,0.12)",
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Betala uppställningsavgift via Swish
      </Typography>

      {/* Season selector */}
      <ToggleButtonGroup
        value={season}
        exclusive
        onChange={(_, v) => { if (v) setSeason(v as Season); }}
        size="small"
        sx={{ mb: 2, display: "flex", flexWrap: "wrap" }}
      >
        <ToggleButton value="winter" sx={{ textTransform: "none", gap: 0.5 }}>
          <AcUnitIcon sx={{ fontSize: 18 }} />
          Vinter ({SEASON_PERIODS.winter})
        </ToggleButton>
        <ToggleButton value="summer" sx={{ textTransform: "none", gap: 0.5 }}>
          <WbSunnyIcon sx={{ fontSize: 18 }} />
          Sommar ({SEASON_PERIODS.summer})
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Payment info */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Belopp: <strong>{AMOUNT} kr</strong> &middot; Meddelande: <strong>{SEASON_LABELS[season]} {code}</strong>
      </Typography>

      {showQr ? (
        /* ── QR code mode ── */
        <Box sx={{ textAlign: "center" }}>
          <Box
            sx={{
              display: "inline-block",
              bgcolor: "white",
              p: 2,
              borderRadius: 2,
              mb: 1,
            }}
          >
            <QRCodeSVG value={swishUrl} size={200} />
          </Box>
          <Typography variant="caption" color="text.secondary" display="block">
            Skanna med Swish-appen
          </Typography>
          {isMobile && (
            <MuiLink
              component="button"
              variant="caption"
              onClick={() => setForceQr(false)}
              sx={{ mt: 1, display: "inline-flex", alignItems: "center", gap: 0.5, cursor: "pointer" }}
            >
              <PhoneIphoneIcon sx={{ fontSize: 14 }} />
              Visa Swish-länk istället
            </MuiLink>
          )}
        </Box>
      ) : (
        /* ── Mobile deep link mode ── */
        <Box sx={{ textAlign: "center" }}>
          <Button
            variant="contained"
            href={swishUrl}
            target="_blank"
            rel="noopener"
            sx={{
              textTransform: "none",
              fontWeight: 700,
              fontSize: "1rem",
              px: 4,
              py: 1.2,
              bgcolor: "#4FC3F7",
              color: "#0a1929",
              "&:hover": { bgcolor: "#29B6F6" },
            }}
          >
            Öppna Swish &mdash; {AMOUNT} kr
          </Button>
          <Box sx={{ mt: 1 }}>
            <MuiLink
              component="button"
              variant="caption"
              onClick={() => setForceQr(true)}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, cursor: "pointer" }}
            >
              <QrCodeIcon sx={{ fontSize: 14 }} />
              Visa QR-kod istället
            </MuiLink>
          </Box>
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5, textAlign: "center" }}>
        Swish-mottagare: Stegerholmens Bryggförening (123-659 47 74)
      </Typography>
    </Box>
  );
}
