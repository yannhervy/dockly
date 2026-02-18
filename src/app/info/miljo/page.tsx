"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ForestIcon from "@mui/icons-material/Forest";
import RecyclingIcon from "@mui/icons-material/Recycling";
import BuildIcon from "@mui/icons-material/Build";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
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
    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
      {children}
    </Typography>
  );
}

function BulletList({ items }: { items: { label: string; text: string }[] }) {
  return (
    <Box component="ul" sx={{ pl: 2.5, mt: 1, mb: 0 }}>
      {items.map((item) => (
        <Box component="li" key={item.label} sx={{ mb: 1 }}>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ lineHeight: 1.8 }}
          >
            <strong>{item.label}:</strong> {item.text}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function MiljoPage() {
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
        <ForestIcon sx={{ fontSize: 36, color: "#66BB6A" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Miljö &amp; Trivsel
        </Typography>
      </Box>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 4, maxWidth: 650 }}
      >
        För att värna om vår unika skärgårdsmiljö och följa Göteborgs Stads
        miljökrav har Stegerholmens Bryggförening upprättat tydliga regler. Som
        medlem och båtägare ansvarar du för att känna till och följa dessa
        riktlinjer.
      </Typography>

      {/* ─── Avfallshantering ─────────────────────────────── */}
      <InfoCard
        icon={<RecyclingIcon sx={{ fontSize: 28, color: "#66BB6A" }} />}
        title="Avfallshantering"
      >
        <Paragraph>
          Vi har en godkänd avfallshanteringsplan i samråd med
          Miljöförvaltningen. För att denna ska fungera krävs att alla tar ansvar
          för sitt eget skräp.
        </Paragraph>
        <BulletList
          items={[
            {
              label: "Hushållssopor",
              text: "Kärl för vanligt hushållsavfall (som uppstår under en båttur) finns placerade vid slutet på grusplanen innan hamnområdet.",
            },
            {
              label: "Farligt avfall",
              text: "Det är strängt förbjudet att slänga farligt avfall i hamnens kärl. Detta inkluderar spillolja, färgburkar, penslar, batterier, glykol och elektronik.",
            },
            {
              label: "Ditt ansvar",
              text: "Allt farligt avfall samt grovsopor måste du själv transportera till närmaste återvinningscentral (ÅVC). Lämna aldrig skräp på marken bredvid soptunnorna.",
            },
          ]}
        />
        <Alert severity="error" sx={{ mt: 2 }}>
          Vi har haft återkommande problem med dumpning av skräp och avfall på
          hamnområdet. Detta medför onödiga kostnader som slår mot oss alla.
          Framöver kommer <strong>all dumpning att polisanmälas</strong>.
        </Alert>
      </InfoCard>

      {/* ─── Båtunderhåll ─────────────────────────────────── */}
      <InfoCard
        icon={<BuildIcon sx={{ fontSize: 28, color: "#FFB74D" }} />}
        title="Båtunderhåll i hamnen"
      >
        <Paragraph>
          För att förhindra utsläpp i havet gäller särskilda regler vid
          underhåll av din båt på land och vid brygga:
        </Paragraph>
        <BulletList
          items={[
            {
              label: "Oljebyte & Service",
              text: "Det är ej tillåtet att utföra oljebyten eller motorservice inom hamnområdet.",
            },
            {
              label: "Bottenfärg",
              text: "Vid skrapning av bottenfärg är det krav på att marken under båten täcks med presenning. Alla färgrester och skrap måste samlas upp och får absolut inte slängas i hamnens kärl utan ska hanteras som farligt avfall.",
            },
            {
              label: "Vinterförvaring",
              text: "Vid uppläggning av båt på land (vilket endast är tillåtet för mindre båtar utan trailer) får motorn ej sitta kvar på båten. Detta för att minimera risken för olje- eller bränsleläckage.",
            },
          ]}
        />
      </InfoCard>

      {/* ─── Båttyper & Motorer ───────────────────────────── */}
      <InfoCard
        icon={<DirectionsBoatIcon sx={{ fontSize: 28, color: "#4FC3F7" }} />}
        title="Båttyper och Motorer"
      >
        <Paragraph>
          Stegerholmens hamn är en småbåtshamn anpassad för mindre fritidsbåtar.
        </Paragraph>
        <BulletList
          items={[
            {
              label: "Förbud mot inombordare",
              text: "Föreningen tillåter inte båtar med inombordsmotorer (bensin eller diesel) på grund av miljörisker.",
            },
            {
              label: "Toalettavfall",
              text: "Hamnen saknar sugtömningsstation. Båtar med toalettsystem som kräver tömning hänvisas till andra hamnar.",
            },
            {
              label: "Storleksbegränsning",
              text: "Båtar får generellt ej vara längre än 5 meter.",
            },
          ]}
        />
      </InfoCard>

      {/* ─── Trivsel & Säkerhet ───────────────────────────── */}
      <InfoCard
        icon={<VolunteerActivismIcon sx={{ fontSize: 28, color: "#CE93D8" }} />}
        title="Trivsel och Säkerhet"
      >
        <BulletList
          items={[
            {
              label: "Hastighet",
              text: "I hamnområdet råder en hastighetsbegränsning på max 3 knop för att undvika svall och olyckor.",
            },
            {
              label: "Grillning",
              text: "Grillning är endast tillåtet med gasolgrill. Användning av kol- eller vedgrill är förbjudet på grund av brandrisken och nedskräpning.",
            },
          ]}
        />
      </InfoCard>

      {/* ─── Report Issues ────────────────────────────────── */}
      <Card
        sx={{
          bgcolor: "rgba(239, 83, 80, 0.08)",
          border: "1px solid rgba(239, 83, 80, 0.2)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <ReportProblemIcon sx={{ fontSize: 28, color: "#EF5350" }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Ser du något som är fel eller trasigt?
            </Typography>
          </Box>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ lineHeight: 1.8 }}
          >
            Om du upptäcker brister vid sopkärlen eller misstänker utsläpp,
            kontakta styrelsen omgående.
          </Typography>
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              📧{" "}
              <MuiLink href="mailto:whoisyann@gmail.com" color="primary">
                whoisyann@gmail.com
              </MuiLink>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              📞{" "}
              <MuiLink href="tel:+46733619893" color="primary">
                0733-619893
              </MuiLink>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
