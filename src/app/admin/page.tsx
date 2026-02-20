"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Grid from "@mui/material/Grid";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PeopleIcon from "@mui/icons-material/People";
import AnchorIcon from "@mui/icons-material/Anchor";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import SailingIcon from "@mui/icons-material/Sailing";
import ConstructionIcon from "@mui/icons-material/Construction";
import DangerousIcon from "@mui/icons-material/Dangerous";
import PlaceIcon from "@mui/icons-material/Place";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import PublicIcon from "@mui/icons-material/Public";

interface SectionCard {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  color: string;
  roles: string[];
}

const SECTIONS: SectionCard[] = [
  {
    title: "Hamnkatalog",
    description: "Se och sök bland alla medlemmar i hamnen.",
    path: "/admin/directory",
    icon: <PublicIcon sx={{ fontSize: 40 }} />,
    color: "#4FC3F7",
    roles: ["Superadmin", "Dock Manager", "Tenant"],
  },
  {
    title: "Hamnkapten",
    description: "Hantera bryggplatser per ansvarig hamnkapten.",
    path: "/admin/manager",
    icon: <ManageAccountsIcon sx={{ fontSize: 40 }} />,
    color: "#FFB74D",
    roles: ["Superadmin", "Dock Manager"],
  },
  {
    title: "Intresseanmälningar",
    description: "Hantera anmälningar för båtplats, sjöbod och uppställning.",
    path: "/admin/interests",
    icon: <SailingIcon sx={{ fontSize: 40 }} />,
    color: "#81C784",
    roles: ["Superadmin", "Dock Manager"],
  },
  {
    title: "Användare",
    description: "Hantera användarkonton, roller och godkännanden.",
    path: "/admin/users",
    icon: <PeopleIcon sx={{ fontSize: 40 }} />,
    color: "#BA68C8",
    roles: ["Superadmin"],
  },
  {
    title: "Bryggor",
    description: "Konfigurera bryggor, koordinater och egenskaper.",
    path: "/admin/docks",
    icon: <AnchorIcon sx={{ fontSize: 40 }} />,
    color: "#4DB6AC",
    roles: ["Superadmin"],
  },
  {
    title: "Resurser",
    description: "Hantera båtplatser, sjöbodar och lådor.",
    path: "/admin/resources",
    icon: <DirectionsBoatIcon sx={{ fontSize: 40 }} />,
    color: "#64B5F6",
    roles: ["Superadmin"],
  },
  {
    title: "Markuppställning",
    description: "Hantera uppställningsplatser och tilldelning.",
    path: "/admin/land-storage",
    icon: <ConstructionIcon sx={{ fontSize: 40 }} />,
    color: "#A1887F",
    roles: ["Superadmin", "Dock Manager"],
  },
  {
    title: "Övergivna objekt",
    description: "Registrera och hantera övergivna båtar och föremål.",
    path: "/admin/abandoned",
    icon: <DangerousIcon sx={{ fontSize: 40 }} />,
    color: "#E57373",
    roles: ["Superadmin"],
  },
  {
    title: "Platser (POI)",
    description: "Hantera intressepunkter som visas på kartan.",
    path: "/admin/poi",
    icon: <PlaceIcon sx={{ fontSize: 40 }} />,
    color: "#FF8A65",
    roles: ["Superadmin"],
  },
];

export default function AdminLandingPage() {
  return (
    <ProtectedRoute allowedRoles={["Superadmin", "Dock Manager"]}>
      <AdminLandingContent />
    </ProtectedRoute>
  );
}

function AdminLandingContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const userRole = profile?.role || "";

  const visibleSections = SECTIONS.filter((s) => s.roles.includes(userRole));

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <AdminPanelSettingsIcon sx={{ color: "primary.main" }} />
          Administration
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Välj en sektion nedan för att hantera hamnens resurser och medlemmar.
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        {visibleSections.map((section) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={section.path}>
            <Card
              sx={{
                height: "100%",
                bgcolor: "background.paper",
                backgroundImage: "none",
                border: "1px solid",
                borderColor: "divider",
                transition: "all 0.2s ease",
                "&:hover": {
                  borderColor: section.color,
                  transform: "translateY(-2px)",
                  boxShadow: `0 4px 20px ${section.color}22`,
                },
              }}
            >
              <CardActionArea
                onClick={() => router.push(section.path)}
                sx={{ height: "100%", p: 0 }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      mb: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        color: section.color,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {section.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {section.title}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {section.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
