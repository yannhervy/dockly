"use client";

import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import InfoIcon from "@mui/icons-material/Info";
import GroupsIcon from "@mui/icons-material/Groups";
import ForestIcon from "@mui/icons-material/Forest";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import ConstructionIcon from "@mui/icons-material/Construction";
import AnchorIcon from "@mui/icons-material/Anchor";

const subPages = [
  {
    icon: <GroupsIcon sx={{ fontSize: 40, color: "primary.main" }} />,
    title: "Allmänt",
    description: "Om föreningen, båtplatser, säsonger och ordningsregler.",
    href: "/info/allmant",
  },
  {
    icon: <ForestIcon sx={{ fontSize: 40, color: "#66BB6A" }} />,
    title: "Miljö & Trivsel",
    description:
      "Avfallshantering, båtunderhåll, båttyper, motorer och trivselregler.",
    href: "/info/miljo",
  },
  {
    icon: <LocalParkingIcon sx={{ fontSize: 40, color: "#FFB74D" }} />,
    title: "Parkering",
    description:
      "Parkeringskort, Parakey-appen, regler och betalningsinformation.",
    href: "/info/parkering",
  },
  {
    icon: <ConstructionIcon sx={{ fontSize: 40, color: "#90CAF9" }} />,
    title: "Båtuppläggning",
    description:
      "Vinter- och sommaruppläggning, uppläggningsnummer och betalning.",
    href: "/info/upplagning",
  },
  {
    icon: <AnchorIcon sx={{ fontSize: 40, color: "#CE93D8" }} />,
    title: "Förtöjning",
    description:
      "Akterförtöjning, bojregler, kätting, ryckdämpare och hamnsimulator.",
    href: "/info/fortojning",
  },
];

export default function InfoPage() {
  const router = useRouter();

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", px: 3, py: 5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <InfoIcon sx={{ fontSize: 36, color: "primary.main" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Om hamnen
        </Typography>
      </Box>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 4, maxWidth: 600 }}
      >
        Information om hur Stegerholmens Hamn drivs, säsonger och regler.
      </Typography>

      {/* Sub-page cards */}
      {subPages.map((page) => (
        <Card
          key={page.href}
          sx={{
            mb: 3,
            bgcolor: "rgba(13, 33, 55, 0.6)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(79,195,247,0.08)",
            transition: "border-color 0.2s, transform 0.2s",
            "&:hover": {
              borderColor: "rgba(79,195,247,0.3)",
              transform: "translateY(-2px)",
            },
          }}
        >
          <CardActionArea
            onClick={() => router.push(page.href)}
            sx={{ p: 3, display: "flex", alignItems: "center", gap: 2.5, justifyContent: "flex-start" }}
          >
            {page.icon}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {page.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {page.description}
              </Typography>
            </Box>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
}
