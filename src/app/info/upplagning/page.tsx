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
import ConstructionIcon from "@mui/icons-material/Construction";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import PaymentIcon from "@mui/icons-material/Payment";
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

function PriceBox({
  price,
  period,
}: {
  price: string;
  period: string;
}) {
  return (
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
        {price}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {period}
      </Typography>
    </Box>
  );
}

export default function UpplagningPage() {
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
        <ConstructionIcon sx={{ fontSize: 36, color: "#FFB74D" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Båtuppläggning
        </Typography>
      </Box>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 3, maxWidth: 650 }}
      >
        Stegerholmens Bryggförening erbjuder möjlighet till vinter- och
        sommaruppläggning på hamnens mark i mån av plats. Eftersom vi har
        begränsat utrymme och strikta miljökrav gäller specifika regler för
        vilken typ av båtar som får förvaras här.
      </Typography>

      {/* ─── Uppläggningsnummer ────────────────────────────── */}
      <InfoCard
        icon={<AssignmentIcon sx={{ fontSize: 28, color: "#4FC3F7" }} />}
        title="System med uppläggningsnummer"
      >
        <Paragraph>
          För att få nyttja hamnens mark för förvaring måste du ha ett unikt
          uppläggningsnummer.
        </Paragraph>
        <Box component="ol" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
          <Box component="li" sx={{ mb: 0.5 }}>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              Kontakta <strong>Yann Hervy</strong> via SMS (
              <MuiLink href="tel:+46733619893" color="primary">
                0733-61 98 93
              </MuiLink>
              ) och uppge ditt namn för att få en kod.
            </Typography>
          </Box>
          <Box component="li" sx={{ mb: 0.5 }}>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              Koden är <strong>personlig</strong> och återanvänds år från år.
            </Typography>
          </Box>
          <Box component="li" sx={{ mb: 0.5 }}>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              Märk din båt eller trailer tydligt med detta nummer (t.ex. vid
              stävöglan eller kulkopplingen) med <strong>vattenfast penna</strong>.
            </Typography>
          </Box>
        </Box>
        <Alert severity="warning" sx={{ mt: 1 }}>
          Båtar och trailers som saknar märkning betraktas som{" "}
          <strong>övergivna</strong>, anmäls till polisen och kan komma att
          forslas bort.
        </Alert>
      </InfoCard>

      {/* ─── Vinteruppläggning ────────────────────────────── */}
      <InfoCard
        icon={<AcUnitIcon sx={{ fontSize: 28, color: "#90CAF9" }} />}
        title="Vinteruppläggning"
      >
        <Paragraph>
          Vinterförvaring på föreningens mark är <strong>endast tillåten för
          mindre båtar</strong> som kan hanteras för hand.
        </Paragraph>
        <PriceBox price="500 kr" period="/ säsong · 1 sep – 1 jun" />
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: "primary.light", mb: 0.5 }}
        >
          Krav för uppläggning:
        </Typography>
        <BulletList
          items={[
            <>
              <strong>Upp och ner:</strong> Båten ska förvaras liggande upp och
              ner på bockar eller virke. Detta innebär att endast mindre båtar
              (t.ex. ekor och mindre styrpulpetare) kan förvaras här.
            </>,
            <>
              <strong>Inga trailers:</strong> Det är inte tillåtet att
              vinterförvara båten stående på trailer. Båten ska ligga på
              marken/berget.
            </>,
            <>
              <strong>Inga motorer:</strong> Utombordsmotorer får ej sitta kvar
              på båten under uppläggningen. Dessa ska monteras av och förvaras
              på annan plats för att minska stöldrisk och miljöpåverkan.
            </>,
          ]}
        />
      </InfoCard>

      {/* ─── Sommaruppläggning ────────────────────────────── */}
      <InfoCard
        icon={<WbSunnyIcon sx={{ fontSize: 28, color: "#FFD54F" }} />}
        title="Sommaruppläggning"
      >
        <Paragraph>
          Under sommaren används hamnens mark främst för uppställning av{" "}
          <strong>tomma trailers</strong> medan båten ligger i sjön.
        </Paragraph>
        <PriceBox price="500 kr" period="/ säsong · 1 apr – 1 nov" />
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: "primary.light", mb: 0.5 }}
        >
          Regler:
        </Typography>
        <BulletList
          items={[
            "Gäller tom trailer, eller mindre båt som ligger upp och ner/på bockar.",
            <>
              Senast <strong>1 juli</strong> ska båtar vara sjösatta. Behövs
              uppskov måste föreningen kontaktas.
            </>,
          ]}
        />
      </InfoCard>

      {/* ─── Betalning ────────────────────────────────────── */}
      <InfoCard
        icon={<PaymentIcon sx={{ fontSize: 28, color: "#66BB6A" }} />}
        title="Betalning"
      >
        <Paragraph>
          Betalning sker via <strong>Swish</strong>. Ange ditt
          uppläggningsnummer som meddelande vid betalningen.
        </Paragraph>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: "rgba(79,195,247,0.06)",
            border: "1px solid rgba(79,195,247,0.1)",
            mb: 1.5,
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Swish: 123 659 47 74
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Mottagare: Stegerholmens Bryggförening
          </Typography>
        </Box>
      </InfoCard>

      {/* ─── Viktigt att tänka på ─────────────────────────── */}
      <Card
        sx={{
          bgcolor: "rgba(239, 83, 80, 0.08)",
          border: "1px solid rgba(239, 83, 80, 0.2)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <WarningAmberIcon sx={{ fontSize: 28, color: "#EF5350" }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Viktigt att tänka på
            </Typography>
          </Box>
          <BulletList
            items={[
              <>
                <strong>Miljö:</strong> Inget underhåll som oljebyte,
                bottenmålning eller motorservice får ske på hamnens mark.
              </>,
              <>
                <strong>Stöldrisk:</strong> Töm båten på all lös utrustning.
                Bensinstölder och inbrott förekommer tyvärr, varför vi kräver
                att motorer monteras av.
              </>,
            ]}
          />
        </CardContent>
      </Card>
    </Box>
  );
}
