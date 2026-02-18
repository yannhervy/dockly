"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import AnchorIcon from "@mui/icons-material/Anchor";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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

function BulletList({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <Box component="ul" sx={{ pl: 2.5, mt: 1, mb: 1.5 }}>
      {items.map((item, i) => (
        <Box component="li" key={i} sx={{ mb: 0.5 }}>
          <Typography
            variant="body1"
            color="text.secondary"
            component="div"
            sx={{ lineHeight: 1.8 }}
          >
            {item}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function FortojningPage() {
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
        <AnchorIcon sx={{ fontSize: 36, color: "#90CAF9" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Regler för båtplats &amp; förtöjning
        </Typography>
      </Box>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 3, maxWidth: 650 }}
      >
        Stegerholmens hamn är en trång och grund småbåtshamn. För allas
        säkerhet och trivsel gäller följande regler kring förtöjning och
        utrustning.
      </Typography>

      {/* ─── Båtstorlek & Fendrar ─────────────────────────── */}
      <InfoCard
        icon={<AnchorIcon sx={{ fontSize: 28, color: "#90CAF9" }} />}
        title="Båtstorlek & Fendrar"
      >
        <BulletList
          items={[
            <>
              <strong>Båtstorlek:</strong> Max längd på båt är 500 cm (ej motor
              inkluderat). Bredden på båten skall vara rimlig med hänsyn till
              båtplatsens bredd och vara okej med dina grannar.
            </>,
            <>
              <strong>Fendrar:</strong> Använd alltid fendrar där det är trångt.
            </>,
          ]}
        />
      </InfoCard>

      {/* ─── Akterförtöjning ──────────────────────────────── */}
      <InfoCard
        icon={<AnchorIcon sx={{ fontSize: 28, color: "#4FC3F7" }} />}
        title="Akterförtöjning (Utrustning)"
      >
        <BulletList
          items={[
            "Använd endast för ändamålet avsedd bojring eller tungt ankare som fäste på botten.",
            "Från bottenfästet ska kätting användas (fungerar som tyngd/ryckdämpare).",
            "Från kättingen upp till båten ska sjunkande tampar användas.",
          ]}
        />
      </InfoCard>

      {/* ─── Bojar & Markörer ─────────────────────────────── */}
      <InfoCard
        icon={<AnchorIcon sx={{ fontSize: 28, color: "#FFB74D" }} />}
        title="Bojar & Markörer"
      >
        <BulletList
          items={[
            <>
              <strong>Förbud mot bojar:</strong> Stora flytande
              förtöjningsbojar är ej tillåtna då de hindrar trafik i hamnen.
            </>,
            <>
              <strong>Undantag (Markör):</strong> En mindre markörboj/flöte på
              linan är tillåtet om det finns plats och grannarna godkänner det.
              Den skall ligga midskepps på båten, så långt in mot bryggan som
              möjligt, för att enkelt kunna fiskas upp med båtshake.
            </>,
          ]}
        />
      </InfoCard>

      {/* ─── Förtöjning mot bryggan ───────────────────────── */}
      <InfoCard
        icon={<AnchorIcon sx={{ fontSize: 28, color: "#CE93D8" }} />}
        title="Förtöjning mot bryggan"
      >
        <BulletList
          items={[
            "Använd ryckdämpare på tamparna mot bryggan.",
            "Tamparna till bryggan skall hållas slaka. Detta är viktigt för att den tunga akterkättingen ska kunna arbeta som dämpare och för att båten ska klara vattenståndsförändringar.",
          ]}
        />
      </InfoCard>

      {/* ─── Hamnsimulator ────────────────────────────────── */}
      <InfoCard
        icon={<AnchorIcon sx={{ fontSize: 28, color: "#66BB6A" }} />}
        title="Hamnsimulator"
      >
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ lineHeight: 1.8, mb: 2 }}
        >
          Vår grunda hamn gör att vi är utsatta för skillnader i vattenstånd. Vi
          har tagit fram en hamnsimulator som ämnar att öka förståelsen för
          vilken skillnad det gör med tjocklek på kätting, avstånd till bojring
          och hur båten beter sig i olika väderlekar.
        </Typography>
        <Button
          variant="contained"
          href="https://yannhervy.github.io/harbor-sim/"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ textTransform: "none" }}
        >
          🔗 Testa Hamnsimulatorn
        </Button>
      </InfoCard>

      {/* ─── Vintertid ────────────────────────────────────── */}
      <Card
        sx={{
          bgcolor: "rgba(239, 83, 80, 0.08)",
          border: "1px solid rgba(239, 83, 80, 0.2)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <AnchorIcon sx={{ fontSize: 28, color: "#EF5350" }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Vintertid
            </Typography>
          </Box>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ lineHeight: 1.8 }}
          >
            Lämna ej kättingar eller tjockare tampar som hänger ner i vattnet
            över vintern. Dessa kan behöva kapas om isen lägger sig.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
