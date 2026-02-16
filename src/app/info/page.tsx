"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import InfoIcon from "@mui/icons-material/Info";
import SailingIcon from "@mui/icons-material/Sailing";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GroupsIcon from "@mui/icons-material/Groups";
import GavelIcon from "@mui/icons-material/Gavel";

const sections = [
  {
    icon: <GroupsIcon sx={{ fontSize: 28, color: "primary.main" }} />,
    title: "Om föreningen",
    content:
      "Stegerholmens Hamn drivs som en hamnförening av 8 medlemmar där varje medlem representeras av en bryggförvaltare, 1 medlem per bryggfäste. Föreningen ansvarar för underhåll av bryggor, arrende av kommunen, gemensamma ytor och den dagliga driften av hamnen. Respektive brygga drivs antingen som en förening eller i privat regi.",
  },
  {
    icon: <SailingIcon sx={{ fontSize: 28, color: "#FFB74D" }} />,
    title: "Båtplatser",
    content:
      "Båtplatser fördelas av respektive bryggas förvaltare med avséende på båtens storlek. Kontakta respektive bryggansvarig för mer information om lediga platser. Du kan också göra en intresseanmälan direkt via vår webbplats. Tänk på att vår trånga hamn ställer höga krav på att vi inte har större båt än vad platsen är avsedd till. Kontakta alltid bryggförvaötaren när du planerar att skaffa en större båt.",
  },
  {
    icon: <CalendarMonthIcon sx={{ fontSize: 28, color: "#66BB6A" }} />,
    title: "Säsonger",
    content:
      "Sommarsäsongen varar normalt från maj till oktober. Under vintern erbjuds uppläggningsplatser för båtar. Exakta datum meddelas av bryggansvarig inför varje säsong.",
  },
  {
    icon: <GavelIcon sx={{ fontSize: 28, color: "#EF5350" }} />,
    title: "Regler & ordning",
    content:
      "Alla hamnmedlemmar ska följa hamnens ordningsregler. Fartbegränsning på 3 knop gäller inom hamnområdet. Varje båtplatsinnehavare ansvarar för att sin plats är i gott skick och att förtöjningar är tillräckliga. Miljöfarliga ämnen får inte hanteras vid bryggorna.",
  },
];

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

      {/* Content cards */}
      {sections.map((section, i) => (
        <Card
          key={section.title}
          sx={{
            mb: 3,
            bgcolor: "rgba(13, 33, 55, 0.6)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(79,195,247,0.08)",
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
              {section.icon}
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {section.title}
              </Typography>
            </Box>
            {i > 0 && <Divider sx={{ mb: 1.5 }} />}
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              {section.content}
            </Typography>
          </CardContent>
        </Card>
      ))}

      {/* Placeholder for images */}
      <Card
        sx={{
          bgcolor: "rgba(13, 33, 55, 0.4)",
          border: "1px dashed rgba(79,195,247,0.2)",
          textAlign: "center",
          py: 6,
        }}
      >
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            📷 Här kan fina bilder från Stegerholmen läggas till
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
