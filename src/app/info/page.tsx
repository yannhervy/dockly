"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import InfoIcon from "@mui/icons-material/Info";
import SailingIcon from "@mui/icons-material/Sailing";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GroupsIcon from "@mui/icons-material/Groups";
import GavelIcon from "@mui/icons-material/Gavel";
import RecyclingIcon from "@mui/icons-material/Recycling";
import BuildIcon from "@mui/icons-material/Build";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";

// ─── Helper component for bullet lists ─────────────────────
function BulletList({ items }: { items: { label: string; text: string }[] }) {
  return (
    <Box component="ul" sx={{ pl: 2.5, mt: 1, mb: 0 }}>
      {items.map((item) => (
        <Box component="li" key={item.label} sx={{ mb: 1 }}>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            <strong>{item.label}:</strong> {item.text}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── Card wrapper ───────────────────────────────────────────
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

// ─── Text block helper ──────────────────────────────────────
function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
      {children}
    </Typography>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="subtitle1"
      sx={{ fontWeight: 700, mt: 2, mb: 0.5, color: "primary.light" }}
    >
      {children}
    </Typography>
  );
}

export default function InfoPage() {
  return (
    <Box sx={{ maxWidth: 800, mx: "auto", px: 3, py: 5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <InfoIcon sx={{ fontSize: 36, color: "primary.main" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Om hamnen
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 600 }}>
        Information om hur Stegerholmens Hamn drivs, säsonger och regler.
      </Typography>

      {/* ─── General Information ─────────────────────────── */}

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

      {/* ─── Environment & Comfort Rules ─────────────────── */}

      <Box sx={{ mt: 4, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
          🌿 Miljö och Trivselregler
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 650 }}>
          För att värna om vår unika skärgårdsmiljö och följa Göteborgs Stads
          miljökrav har Stegerholmens Bryggförening upprättat tydliga regler. Som
          medlem och båtägare ansvarar du för att känna till och följa dessa
          riktlinjer.
        </Typography>
      </Box>

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
      </InfoCard>

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

      {/* ─── Report Issues ───────────────────────────────── */}
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
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            Om du upptäcker brister vid sopkärlen eller misstänker utsläpp,
            kontakta styrelsen omgående.
          </Typography>
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              📧{" "}
              <Link href="mailto:whoisyann@gmail.com" color="primary">
                whoisyann@gmail.com
              </Link>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              📞{" "}
              <Link href="tel:+46733619893" color="primary">
                0733-619893
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
