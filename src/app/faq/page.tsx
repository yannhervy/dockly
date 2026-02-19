"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Link from "@mui/material/Link";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const FAQ_ITEMS = [
  {
    q: "Hur ansöker jag om en båtplats?",
    a: 'Du kan göra en intresseanmälan direkt på vår hemsida. Klicka på "Intresseanmälan för båtplats" och fyll i dina uppgifter samt din båts mått. Bryggansvarig återkommer sedan till dig.',
  },
  {
    q: "Vad kostar en båtplats?",
    a: "Priset varierar beroende på platsens storlek och vilken brygga den tillhör. Kontakta bryggansvarig för aktuell prislista.",
  },
  {
    q: "När börjar och slutar säsongen?",
    a: "Sommarsäsongen sträcker sig normalt från maj till oktober. Exakta datum meddelas inför varje säsong.",
  },
  {
    q: "Erbjuds vinterförvaring?",
    a: "Ja, vi erbjuder uppläggningsplatser för båtar under vintern. Kontakta föreningen för mer information om tillgängliga platser och priser.",
  },
  {
    q: "Vilka regler gäller i hamnen?",
    a: "Fartbegränsning gäller inom hamnområdet. Alla medlemmar förväntas underhålla sin plats och ha tillräckliga förtöjningar. Miljöfarliga ämnen får inte hanteras vid bryggorna. Se vår informationssida för fullständiga regler.",
  },
  {
    q: "Hur kan jag kontakta min bryggansvarig?",
    a: 'Under "Bryggor" hittar du kontaktinformation till respektive bryggansvarig. Du kan kontakta dem via e-post direkt från webbplatsen.',
  },
  {
    q: "Kan jag sälja utrustning via hemsidan?",
    a: 'Ja! Under "Köp & Sälj" kan du skapa annonser för begagnad utrustning, båtar och andra marinrelaterade prylar. Du kan även hitta kringtjänster som krympplastning och akterförtöjning.',
  },
  {
    q: "Är jag medlem i hamnföreningen?",
    a: "Hamnföreningen har ett begränsat antal medlemmar som utgör styrelsen. Som båtplats-, sjöbods- eller lådinnehavare är du hyresgäst på området. Du förväntas följa hamnens regler och är välkommen att delta i gemensamma arbetsdagar.",
  },
  {
    q: "Finns det parkering?",
    a: "Stegerholmens småbåtshamn har ingen egen parkering. Badföreningen bredvid tillhandahåller en parkering som kräver ett årsabonnemang (för närvarande 1 500 kr/år). Lösningen innefattar en digital nyckel via mobiltelefon. Mer information finns på stegerholmen.se/praktisk info.",
    link: "https://stegerholmen.se/praktisk%20info",
  },
];

export default function FaqPage() {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (
    _: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", px: 3, py: 5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <HelpOutlineIcon sx={{ fontSize: 36, color: "primary.main" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Vanliga frågor
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 600 }}>
        Svar på de vanligaste frågorna om Stegerholmens Hamn.
      </Typography>

      {/* Accordion FAQ */}
      {FAQ_ITEMS.map((item, i) => (
        <Accordion
          key={i}
          expanded={expanded === `faq-${i}`}
          onChange={handleChange(`faq-${i}`)}
          sx={{
            mb: 1,
            bgcolor: "rgba(13, 33, 55, 0.6)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(79,195,247,0.08)",
            borderRadius: "12px !important",
            "&::before": { display: "none" },
            "&.Mui-expanded": {
              border: "1px solid rgba(79,195,247,0.2)",
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: "primary.main" }} />}
            sx={{ px: 3, py: 0.5 }}
          >
            <Typography sx={{ fontWeight: 600 }}>{item.q}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 3, pb: 3, pt: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {item.a}
            </Typography>
            {item.link && (
              <Link
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 1 }}
              >
                Läs mer <OpenInNewIcon sx={{ fontSize: 14 }} />
              </Link>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
