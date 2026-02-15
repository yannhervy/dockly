"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import MenuIcon from "@mui/icons-material/Menu";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PublicIcon from "@mui/icons-material/Public";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LogoutIcon from "@mui/icons-material/Logout";
import AnchorIcon from "@mui/icons-material/Anchor";

import ConstructionIcon from "@mui/icons-material/Construction";

const DRAWER_WIDTH = 260;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[]; // Empty = visible to all authenticated users
}

const NAV_ITEMS: NavItem[] = [
  { label: "Harbor Directory", path: "/directory", icon: <PublicIcon /> },
  { label: "Land Storage", path: "/land-storage", icon: <ConstructionIcon />, roles: ["Superadmin", "Dock Manager"] },
  { label: "My Pages", path: "/dashboard", icon: <DashboardIcon /> },
  {
    label: "Dock Manager",
    path: "/manager",
    icon: <ManageAccountsIcon />,
    roles: ["Superadmin", "Dock Manager"],
  },
  {
    label: "Admin",
    path: "/admin",
    icon: <AdminPanelSettingsIcon />,
    roles: ["Superadmin"],
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, firebaseUser, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Don't show the shell on the login or setup pages
  if (pathname === "/login" || pathname === "/setup") {
    return <>{children}</>;
  }

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return profile && item.roles.includes(profile.role);
  });

  const handleNav = (path: string) => {
    router.push(path);
    setMobileOpen(false);
  };

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo header — matches AppBar height (64px) */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2.5,
          height: 64,
          minHeight: 64,
        }}
      >
        <AnchorIcon sx={{ fontSize: 32, color: "primary.main" }} />
        <Typography
          variant="h6"
          sx={{
            background: "linear-gradient(135deg, #4FC3F7 0%, #FFB74D 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontWeight: 700,
          }}
        >
          Dockly
        </Typography>
      </Box>

      <Divider />

      {/* Navigation list */}
      <List sx={{ flex: 1, px: 1, py: 1 }}>
        {visibleItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => handleNav(item.path)}
              selected={pathname === item.path}
              sx={{
                borderRadius: 2,
                "&.Mui-selected": {
                  backgroundColor: "rgba(79, 195, 247, 0.12)",
                  "&:hover": {
                    backgroundColor: "rgba(79, 195, 247, 0.18)",
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* User info footer */}
      {firebaseUser && (
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: "primary.main",
                color: "primary.contrastText",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {(profile?.name || firebaseUser.displayName || firebaseUser.email || "U").charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600 }}
                noWrap
              >
                {profile?.name || firebaseUser.displayName || firebaseUser.email}
              </Typography>
              {profile?.role && (
                <Chip
                  label={profile.role}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: 11,
                    bgcolor: "rgba(79, 195, 247, 0.15)",
                    color: "primary.light",
                  }}
                />
              )}
            </Box>
          </Box>
          <ListItemButton
            onClick={logout}
            sx={{ borderRadius: 2, py: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Log out"
              primaryTypographyProps={{ variant: "body2" }}
            />
          </ListItemButton>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar sx={{ px: 3 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <DirectionsBoatIcon sx={{ mr: 1, color: "primary.main" }} />
          <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
            Stegerholmens Hamn
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {firebaseUser && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {firebaseUser.email}
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: "100%", md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { xs: 0, md: `${DRAWER_WIDTH}px` },
          mt: "64px",
          px: 3,
          py: 3,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
