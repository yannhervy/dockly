"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import PaymentIcon from "@mui/icons-material/Payment";
import EventIcon from "@mui/icons-material/Event";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Link from "next/link";

// ─── Reusable components ────────────────────────────────────

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      sx={{
        mb: 3,
        bgcolor: "rgba(13, 33, 55, 0.6)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(79,195,247,0.08)",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          {icon}
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        </Box>
        <Divider sx={{ mb: 1.5 }} />
        {children}
      </CardContent>
    </Card>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="body1"
      color="text.secondary"
      sx={{ lineHeight: 1.8, mb: 1.5 }}
    >
      {children}
    </Typography>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <Box component="ul" sx={{ pl: 2.5, mt: 1, mb: 1.5 }}>
      {items.map((item, i) => (
        <Box component="li" key={i} sx={{ mb: 0.5 }}>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ lineHeight: 1.8 }}
          >
            {item}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function ParkeringPage() {
  return (
    <Box sx={{ maxWidth: 800, mx: "auto", px: 3, py: 5 }}>
      {/* Back link */}
      <Button
        component={Link}
        href="/info"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2, textTransform: "none" }}
      >
        Tillbaka till Info
      </Button>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <LocalParkingIcon sx={{ fontSize: 36, color: "#FFB74D" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Parkering
        </Typography>
      </Box>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 3, maxWidth: 650 }}
      >
        Information om parkeringsmöjligheter vid Stegerholmen.
      </Typography>

      {/* Disclaimer */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>Observera:</strong> Parkeringen hanteras av{" "}
        <strong>Stegerholmens Badförening</strong>, inte av hamnföreningen. Vi
        återger här den viktigaste informationen i komprimerad form.
        Fullständig information finns på{" "}
        <MuiLink
          href="https://stegerholmen.se/praktisk%20info"
          target="_blank"
          rel="noopener noreferrer"
        >
          badföreningens webbplats
        </MuiLink>
        .
      </Alert>

      {/* ─── Nyckellöst system ────────────────────────────── */}
      <InfoCard
        icon={<PhoneIphoneIcon sx={{ fontSize: 28, color: "#4FC3F7" }} />}
        title="Nyckellöst system — Parakey"
      >
        <Paragraph>
          Från <strong>15 maj 2026</strong> öppnas parkeringsbommen med appen{" "}
          <strong>Parakey</strong> — inga fysiska nycklar, taggar eller
          passerkort behövs. Du använder mobiltelefonen som nyckel. Du behöver
          fortfarande ett <strong>parkeringskort</strong> synligt i framrutan.
        </Paragraph>
        <Paragraph>
          I början av maj får du ett välkomstmejl med instruktioner för att
          installera Parakey-appen och logga in (kontrollera skräppost). 2025 års
          nyckel gäller till 15 maj 2026 — därefter krävs digital nyckel via
          Parakey.
        </Paragraph>
        <Typography variant="body2" color="text.secondary">
          Vanliga frågor om Parakey:{" "}
          <MuiLink
            href="https://help.parakey.co"
            target="_blank"
            rel="noopener noreferrer"
          >
            help.parakey.co <OpenInNewIcon sx={{ fontSize: 12, ml: 0.5 }} />
          </MuiLink>
        </Typography>
      </InfoCard>

      {/* ─── Regler ───────────────────────────────────────── */}
      <InfoCard
        icon={<LocalParkingIcon sx={{ fontSize: 28, color: "#FFB74D" }} />}
        title="Regler"
      >
        <Paragraph>
          Antalet parkeringskort är begränsat på grund av parkeringens storlek.
          Kortet gäller för <strong>en bil, i mån av plats</strong>.
        </Paragraph>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: "primary.light", mt: 1, mb: 0.5 }}
        >
          Ej tillåtet:
        </Typography>
        <BulletList
          items={[
            "Långtidsparkering",
            "Camping med husbil eller husvagn",
            "Uppställning av båt eller trailer",
            "Insläpp av bilar utan parkeringskort vid bommen",
          ]}
        />
        <Paragraph>
          <strong>Lås alltid bommen efter dig.</strong> Securitas genomför
          kontroller av parkerade bilar.
        </Paragraph>
      </InfoCard>

      {/* ─── Betalning ────────────────────────────────────── */}
      <InfoCard
        icon={<PaymentIcon sx={{ fontSize: 28, color: "#66BB6A" }} />}
        title="Betalning & Registrering"
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            mb: 2,
            p: 2,
            borderRadius: 2,
            bgcolor: "rgba(79,195,247,0.06)",
            border: "1px solid rgba(79,195,247,0.1)",
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            1 500 kr
          </Typography>
          <Typography variant="body2" color="text.secondary">
            / år (15 maj 2026 – 15 maj 2027)
          </Typography>
        </Box>

        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: "primary.light", mb: 1 }}
        >
          Så gör du:
        </Typography>
        <Box component="ol" sx={{ pl: 2.5, mt: 0 }}>
          <Box component="li" sx={{ mb: 1 }}>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              Betala till <strong>plusgiro 32 20 73–8</strong> med ditt namn som
              meddelande.
            </Typography>
          </Box>
          <Box component="li" sx={{ mb: 1 }}>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              Mejla{" "}
              <MuiLink href="mailto:parkering.stegerholmen@gmail.com" color="primary">
                parkering.stegerholmen@gmail.com
              </MuiLink>{" "}
              med ditt <strong>namn</strong>, <strong>mejladress</strong> och{" "}
              <strong>telefonnummer</strong>.
            </Typography>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Din mejladress används för att tilldela en digital nyckel via Parakey.
          Ett servicekort ingår i priset.
        </Typography>
      </InfoCard>

      {/* ─── Hämtdagar ────────────────────────────────────── */}
      <InfoCard
        icon={<EventIcon sx={{ fontSize: 28, color: "#CE93D8" }} />}
        title="Hämta parkeringskort"
      >
        <Paragraph>
          Parkeringskortet hämtas på badplatsen vid ett av följande tillfällen:
        </Paragraph>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 1.5 }}>
          <Chip label="Sön 26 apr, kl 9–12" variant="outlined" />
          <Chip label="Lör 9 maj, kl 9–12" variant="outlined" />
          <Chip label="Lör 23 maj, kl 9–12" variant="outlined" />
        </Box>
      </InfoCard>

      {/* ─── Link to original source ─────────────────────── */}
      <Box sx={{ textAlign: "center", mt: 2 }}>
        <Button
          variant="outlined"
          href="https://stegerholmen.se/praktisk%20info"
          target="_blank"
          rel="noopener noreferrer"
          endIcon={<OpenInNewIcon />}
          sx={{ textTransform: "none", borderRadius: 2 }}
        >
          Fullständig info på stegerholmen.se
        </Button>
      </Box>
    </Box>
  );
}
