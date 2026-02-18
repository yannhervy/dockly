"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GroupsIcon from "@mui/icons-material/Groups";
import SailingIcon from "@mui/icons-material/Sailing";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GavelIcon from "@mui/icons-material/Gavel";
import Link from "next/link";

// ─── Reusable card component ──────────────────────────────
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
    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
      {children}
    </Typography>
  );
}

export default function AllmantPage() {
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
        <GroupsIcon sx={{ fontSize: 36, color: "primary.main" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Allmänt
        </Typography>
      </Box>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 4, maxWidth: 600 }}
      >
        Grundläggande information om föreningen, båtplatser och säsonger.
      </Typography>

      <InfoCard
        icon={<GroupsIcon sx={{ fontSize: 28, color: "primary.main" }} />}
        title="Om föreningen"
      >
        <Paragraph>
          Stegerholmens Hamn drivs som en hamnförening av 8 medlemmar där varje
          medlem representeras av en bryggförvaltare, 1 medlem per bryggfäste.
          Föreningen ansvarar för underhåll av bryggor, arrende av kommunen,
          gemensamma ytor och den dagliga driften av hamnen. Respektive brygga
          drivs antingen som en förening eller i privat regi.
        </Paragraph>
      </InfoCard>

      <InfoCard
        icon={<SailingIcon sx={{ fontSize: 28, color: "#FFB74D" }} />}
        title="Båtplatser"
      >
        <Paragraph>
          Båtplatser fördelas av respektive bryggas förvaltare med avseende på
          båtens storlek. Kontakta respektive bryggansvarig för mer information
          om lediga platser. Du kan också göra en intresseanmälan direkt via vår
          webbplats. Tänk på att vår trånga hamn ställer höga krav på att vi inte
          har större båt än vad platsen är avsedd till. Kontakta alltid
          bryggförvaltaren när du planerar att skaffa en större båt.
        </Paragraph>
      </InfoCard>

      <InfoCard
        icon={<CalendarMonthIcon sx={{ fontSize: 28, color: "#66BB6A" }} />}
        title="Säsonger"
      >
        <Paragraph>
          Sommarsäsongen varar normalt från maj till oktober. Under vintern
          erbjuds uppläggningsplatser för båtar. Exakta datum meddelas av
          bryggansvarig inför varje säsong.
        </Paragraph>
      </InfoCard>

      <InfoCard
        icon={<GavelIcon sx={{ fontSize: 28, color: "#EF5350" }} />}
        title="Regler &amp; ordning"
      >
        <Paragraph>
          Alla hamnmedlemmar ska följa hamnens ordningsregler. Fartbegränsning på
          3 knop gäller inom hamnområdet. Varje båtplatsinnehavare ansvarar för
          att sin plats är i gott skick och att förtöjningar är tillräckliga.
          Miljöfarliga ämnen får inte hanteras vid bryggorna.
        </Paragraph>
      </InfoCard>
    </Box>
  );
}
