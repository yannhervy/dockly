"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HomeIcon from "@mui/icons-material/Home";
import StraightenIcon from "@mui/icons-material/Straighten";
import RoofingIcon from "@mui/icons-material/Roofing";
import FormatPaintIcon from "@mui/icons-material/FormatPaint";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import BuildIcon from "@mui/icons-material/Build";
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

export default function SjobodarPage() {
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
        <HomeIcon sx={{ fontSize: 36, color: "#FFB74D" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Sjöbodsregler
        </Typography>
      </Box>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 3, maxWidth: 650 }}
      >
        Regler för uppförande, underhåll och utformning av sjöbodar inom
        hamnområdet.
      </Typography>

      {/* ─── Placering ─────────────────────────────────────── */}
      <InfoCard
        icon={<HomeIcon sx={{ fontSize: 28, color: "#4FC3F7" }} />}
        title="Placering"
      >
        <Paragraph>
          Sjöboden ska uppföras på <strong>samma plats som den tidigare</strong>,
          alternativt på en plats anvisad av styrelsen. Om inget annat avtalats
          ska gaveln (fronten vid pulpettak) så långt det är möjligt vara{" "}
          <strong>riktad mot vattnet</strong>.
        </Paragraph>
      </InfoCard>

      {/* ─── Altan / Trädäck ──────────────────────────────── */}
      <InfoCard
        icon={<HomeIcon sx={{ fontSize: 28, color: "#66BB6A" }} />}
        title="Altan / Trädäck"
      >
        <Paragraph>
          Ett trädäck får byggas utanför dörren och sträcka sig{" "}
          <strong>max 1 meter ut</strong> från sjöboden. Trädäcket får inte
          avskärmas på ett sätt som ger ett privatiserat intryck.
        </Paragraph>
        <BulletList
          items={[
            "Staket tillåts vid fallrisk, men trappsteg ska byggas om möjligt för att skapa en öppen och inbjudande yta.",
            "Styrelsen beslutar vad som är lämpligast för varje sjöbod.",
            "Trädäcket är en allmän plats som alla får nyttja.",
            "Sjöbodsägaren ansvarar för att trädäcket är en säker plats.",
          ]}
        />
      </InfoCard>

      {/* ─── Storlekar ─────────────────────────────────────── */}
      <InfoCard
        icon={<StraightenIcon sx={{ fontSize: 28, color: "#CE93D8" }} />}
        title="Storlekar"
      >
        <Box
          sx={{
            display: "flex",
            gap: 2,
            mb: 2,
            flexWrap: "wrap",
          }}
        >
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: "rgba(79,195,247,0.06)",
              border: "1px solid rgba(79,195,247,0.1)",
              flex: 1,
              minWidth: 140,
              textAlign: "center",
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              6 m²
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Stor sjöbod
            </Typography>
          </Box>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: "rgba(79,195,247,0.06)",
              border: "1px solid rgba(79,195,247,0.1)",
              flex: 1,
              minWidth: 140,
              textAlign: "center",
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              3 m²
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Liten sjöbod
            </Typography>
          </Box>
        </Box>
        <Paragraph>
          Storleken mäts runt de bärande stolparna. Till detta tillkommer panel
          på ca 22 mm tjocklek. Förhållandet längd:bredd ska vara mellan{" "}
          <strong>1:1 och 2:3</strong>, med gaveln/dörren på den kortaste sidan,
          om inget annat avtalats med styrelsen.
        </Paragraph>
      </InfoCard>

      {/* ─── Tak ───────────────────────────────────────────── */}
      <InfoCard
        icon={<RoofingIcon sx={{ fontSize: 28, color: "#FFB74D" }} />}
        title="Tak"
      >
        <Paragraph>
          Taket kan byggas som <strong>sadeltak</strong> eller{" "}
          <strong>pulpettak</strong> (sluttande tak) och ska kläs med{" "}
          <strong>tjärpapp</strong>.
        </Paragraph>
        <BulletList
          items={[
            <>
              <strong>Sadeltak:</strong> Maxhöjd 3 meter till nocken. Takvinkel
              27–45 grader.
            </>,
            <>
              <strong>Pulpettak:</strong> Maxhöjd 2,5 meter. Takvinkel 10–27
              grader.
            </>,
          ]}
        />
      </InfoCard>

      {/* ─── Fönster & Dörr ────────────────────────────────── */}
      <InfoCard
        icon={<HomeIcon sx={{ fontSize: 28, color: "#90CAF9" }} />}
        title="Fönster & Dörr"
      >
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: "primary.light", mb: 0.5 }}
        >
          Fönster
        </Typography>
        <BulletList
          items={[
            "Två mindre fönster tillåts i två olika riktningar.",
            "Minst ett fönster ska täckas med fönsterlucka när sjöboden inte används.",
            "Ett mindre fönster i dörren är tillåtet.",
          ]}
        />

        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: "primary.light", mt: 1, mb: 0.5 }}
        >
          Dörr
        </Typography>
        <BulletList
          items={[
            "Max storlek: 120 × 200 cm.",
            "Glasdörr/dubbeldörr av glas ska hållas täckt med yttre trädörrar (faluröda eller svarta) när man inte befinner sig i sjöboden.",
            "Vanlig dörr ska målas svart.",
            "Dörren ska märkas med sjöbodsnummer — antingen på dörren eller ovanför.",
          ]}
        />
      </InfoCard>

      {/* ─── Panel & Färg ──────────────────────────────────── */}
      <InfoCard
        icon={<FormatPaintIcon sx={{ fontSize: 28, color: "#EF5350" }} />}
        title="Panel & Färg"
      >
        <BulletList
          items={[
            <>
              <strong>Utvändig panel:</strong> Stående panel med lockbrädor
              eller lockläkt.
            </>,
            <>
              <strong>Sjöbodar och lådor:</strong> Ska målas med{" "}
              <strong>Faluröd</strong> med lågt glansvärde.
            </>,
            <>
              <strong>Dörr:</strong> Ska målas <strong>svart</strong>.
            </>,
          ]}
        />
      </InfoCard>

      {/* ─── Brandrisk ─────────────────────────────────────── */}
      <InfoCard
        icon={
          <LocalFireDepartmentIcon sx={{ fontSize: 28, color: "#FF7043" }} />
        }
        title="Brandrisk"
      >
        <Alert severity="warning" sx={{ mb: 1 }}>
          På grund av brandrisken ska det finnas{" "}
          <strong>brandsläckningsutrustning</strong> i varje sjöbod, exempelvis
          pulversläckare eller brandfilt.
        </Alert>
      </InfoCard>

      {/* ─── Underhåll och skötsel ─────────────────────────── */}
      <InfoCard
        icon={<BuildIcon sx={{ fontSize: 28, color: "#4FC3F7" }} />}
        title="Underhåll & Skötsel"
      >
        <Paragraph>
          Ägaren ansvarar för att hålla sin sjöbod i <strong>gott skick</strong>.
          Sjöboden ska målas om vid behov och underhållas för att alltid se
          prydlig och välskött ut. Färgen ska följa de angivna reglerna, och det
          är ägarens ansvar att åtgärda eventuella skador eller byta ut slitna
          delar.
        </Paragraph>
        <Paragraph>
          En väl underhållen sjöbod bidrar till att området förblir estetiskt
          tilltalande och i bra skick för alla som vistas där.
        </Paragraph>
      </InfoCard>
    </Box>
  );
}
