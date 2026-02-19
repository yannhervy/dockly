"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import HandymanIcon from "@mui/icons-material/Handyman";
import ChecklistIcon from "@mui/icons-material/Checklist";
import OutdoorGrillIcon from "@mui/icons-material/OutdoorGrill";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
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

function BulletList({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <Box component="ul" sx={{ pl: 2.5, mt: 1, mb: 1.5 }}>
      {items.map((item, i) => (
        <Box component="li" key={i} sx={{ mb: 0.5 }}>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ lineHeight: 1.8 }}
            component="span"
          >
            {item}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function StaddagPage() {
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
        <CleaningServicesIcon sx={{ fontSize: 36, color: "#66BB6A" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Städdag
        </Typography>
      </Box>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 3, maxWidth: 650 }}
      >
        Varje år i början av juni hålls en gemensam städdag där alla som
        nyttjar hamnen hjälps åt att göra området fint inför säsongen.
      </Typography>

      {/* ─── Vad gör vi? ───────────────────────────────────── */}
      <InfoCard
        icon={<HandymanIcon sx={{ fontSize: 28, color: "#4FC3F7" }} />}
        title="Vad gör vi under städdagen?"
      >
        <Paragraph>
          Under städdagen tar vi oss an det löpande underhållet av vårt
          gemensamma område. Föreningen ordnar en stor container som finns på
          plats över helgen. Arbetsuppgifterna varierar efter årets behov men
          brukar bland annat innefatta:
        </Paragraph>
        <BulletList
          items={[
            <>
              <strong>Underhåll av Smögenbryggan</strong> — inspektion av
              pelare samt byte av dåliga stöttor och reglar.
            </>,
            <>
              <strong>Målning och snickeri</strong> — skrapning och målning av
              överliggare och staket samt tillsyn av byssor och hamnens
              utemöbler.
            </>,
            <>
              <strong>Röjning och städning</strong> — klippning av kantgräs,
              plockning av skräp och tång samt bortforsling av gammalt skrot.
            </>,
            <>
              <strong>Bortforsling av övergivna båtar</strong> — vid behov
              kapas och avlägsnas gamla övergivna båtar som tagits i beslag av
              föreningen.
            </>,
          ]}
        />
      </InfoCard>

      {/* ─── Vad du kan ta med ─────────────────────────────── */}
      <InfoCard
        icon={<ChecklistIcon sx={{ fontSize: 28, color: "#FFB74D" }} />}
        title="Vad du kan ta med dig"
      >
        <Paragraph>
          Föreningen tillhandahåller det mesta av arbetsmaterialet — färg,
          penslar, tigersåg, elverk och sopsäckar. Men det uppskattas alltid om
          du som medlem tar med:
        </Paragraph>
        <BulletList
          items={[
            "Oömma arbetskläder och arbetshandskar.",
            "Stålborste eller färgskrapa om du hjälper till med målning.",
            "Gärna en egen skottkärra, presenning att samla sågspån och skräp i, eller andra passande handverktyg.",
          ]}
        />
      </InfoCard>

      {/* ─── Grillen är tänd ──────────────────────────────── */}
      <InfoCard
        icon={<OutdoorGrillIcon sx={{ fontSize: 28, color: "#EF5350" }} />}
        title="Föreningen bjuder på grillat!"
      >
        <Paragraph>
          Städdagen ska vara trevlig! Efter väl utfört arbete ser styrelsen till
          att grillen är tänd. Föreningen bjuder alla som hjälper till på korv,
          dricka och lite godis.
        </Paragraph>
      </InfoCard>

      {/* ─── Tid och anslag ───────────────────────────────── */}
      <InfoCard
        icon={<AccessTimeIcon sx={{ fontSize: 28, color: "#CE93D8" }} />}
        title="Tid och plats"
      >
        <Paragraph>
          Städdagen hålls alltid <strong>i början av juni</strong> och drar
          igång <strong>klockan 10:00</strong>. Det exakta datumet beslutas
          under vårmötet (som brukar hållas i mars/april) och anslås därefter
          på anslagstavlorna. När dagen är spikad publiceras den som nyhet här
          på sajten samt i vår Facebookgrupp.
        </Paragraph>
        <Alert severity="info" sx={{ mt: 1 }}>
          Vi ser fram emot en trevlig arbetsdag tillsammans! Allas insats, stor
          som liten, gör stor skillnad för vår vackra lilla skärgårdshamn.
        </Alert>
      </InfoCard>
    </Box>
  );
}
