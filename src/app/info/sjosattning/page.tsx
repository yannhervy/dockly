"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
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

export default function SjosattningPage() {
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
        <DirectionsBoatIcon sx={{ fontSize: 36, color: "#4FC3F7" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Sjösättning &amp; Nyckel
        </Typography>
      </Box>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 3, maxWidth: 650 }}
      >
        Information om sjösättningsrampen och hur du lånar nyckel till bommen.
      </Typography>

      {/* ─── Nyckel till bommen ─────────────────────────────── */}
      <InfoCard
        icon={<VpnKeyIcon sx={{ fontSize: 28, color: "#FFB74D" }} />}
        title="Nyckel till bommen"
      >
        <Paragraph>
          Varje bryggansvarig har en <strong>nyckel som kan lånas över dagen</strong> för
          att köra in med bil på hamnområdet. Nyckeln är personlig och ska
          lämnas tillbaka samma dag.
        </Paragraph>
        <Paragraph>
          I möjligaste mån ska du <strong>låna nyckeln av bryggansvarig på den brygga
          du har din båtplats</strong>. Kontakta din bryggansvarig i god tid för att
          boka nyckel, särskilt under högsäsong.
        </Paragraph>
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Nyckeln ska lämnas tillbaka när du är klar. Det är <strong>inte
          tillåtet att parkera på området över dagen</strong>. Det är
          dessutom <strong>absolut förbjudet att kopiera nyckeln</strong>.
        </Alert>
      </InfoCard>

      {/* ─── Sjösättningsrampen ────────────────────────────── */}
      <InfoCard
        icon={<DirectionsBoatIcon sx={{ fontSize: 28, color: "#4FC3F7" }} />}
        title="Sjösättningsrampen"
      >
        <Paragraph>
          Hamnens sjösättningsramp kan användas för att sjösätta och ta upp
          båtar. Rampen är tillgänglig utan kostnad för alla medlemmar med båtplats.
        </Paragraph>

        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: "primary.light", mt: 1, mb: 0.5 }}
        >
          Begränsningar:
        </Typography>
        <BulletList
          items={[
            "Rampen klarar båtar upp till ca 5 meter.",
            "Vid lågt vattenstånd kan kapaciteten vara begränsad — kontrollera vattenståndet innan.",
          ]}
        />

        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: "primary.light", mt: 1, mb: 0.5 }}
        >
          Bra att veta:
        </Typography>
        <BulletList
          items={[
            "Marken vid rampen är grusad.",
            "Vid relativt tunga båtar rekommenderas fyrhjulsdrift för att dra upp båten.",
            "Se till att din trailer och dragfordon är i gott skick innan sjösättning.",
          ]}
        />
      </InfoCard>

      {/* ─── Sammanfattning ────────────────────────────────── */}
      <InfoCard
        icon={<WarningAmberIcon sx={{ fontSize: 28, color: "#EF5350" }} />}
        title="Kom ihåg"
      >
        <BulletList
          items={[
            "Boka nyckel av din bryggansvarig i förväg.",
            "Lämna tillbaka nyckeln samma dag.",
            "Parkera inte på hamnområdet över dagen.",
            "Kontrollera vattenståndet innan du sjösätter.",
            "Fyrhjulsdrift rekommenderas för tyngre båtar.",
          ]}
        />
      </InfoCard>
    </Box>
  );
}
