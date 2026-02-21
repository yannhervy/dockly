"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import MenuIcon from "@mui/icons-material/Menu";
import AnchorIcon from "@mui/icons-material/Anchor";
import LoginIcon from "@mui/icons-material/Login";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LogoutIcon from "@mui/icons-material/Logout";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonOffIcon from "@mui/icons-material/PersonOff";

const PUBLIC_NAV = [
  { label: "Hem", path: "/" },
  { label: "Nyheter", path: "/news" },
  { label: "Bryggor", path: "/docks" },
  { label: "Karta", path: "/map", requiresAuth: true },
  { label: "Väder", path: "/weather" },
  { label: "Info", path: "/info" },
  { label: "FAQ", path: "/faq" },
  { label: "Köp & Sälj", path: "/marketplace" },
];

export default function PublicNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { firebaseUser, profile, logout, isViewingAs, stopViewingAs, viewingAsProfile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleNav = (path: string) => {
    router.push(path);
    setMobileOpen(false);
  };

  const handleUserMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: "rgba(10, 25, 41, 0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(79,195,247,0.1)",
        }}
      >
        <Toolbar sx={{ maxWidth: 1200, width: "100%", mx: "auto", px: { xs: 2, md: 3 } }}>
          {/* Logo */}
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }}
            onClick={() => handleNav("/")}
          >
            <AnchorIcon sx={{ fontSize: 28, color: "primary.main" }} />
            <Typography
              variant="h6"
              sx={{
                background: "linear-gradient(135deg, #4FC3F7 0%, #FFB74D 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 700,
                fontSize: { xs: "1rem", sm: "1.25rem" },
              }}
            >
              Stegerholmens Hamn
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Desktop nav links */}
          <Box sx={{ display: { xs: "none", md: "flex" }, gap: 0.5, mr: 2 }}>
            {PUBLIC_NAV.map((item) => (
              <Button
                key={item.path}
                onClick={() => handleNav(item.path)}
                sx={{
                  color: pathname === item.path ? "primary.main" : "text.secondary",
                  fontWeight: pathname === item.path ? 700 : 400,
                  textTransform: "none",
                  fontSize: "0.95rem",
                  position: "relative",
                  "&::after": pathname === item.path
                    ? {
                        content: '""',
                        position: "absolute",
                        bottom: 6,
                        left: "20%",
                        right: "20%",
                        height: 2,
                        borderRadius: 1,
                        bgcolor: "primary.main",
                      }
                    : {},
                }}
              >
                {item.label}
                {item.requiresAuth && !firebaseUser && (
                  <LockOutlinedIcon sx={{ fontSize: 12, ml: 0.3, opacity: 0.5 }} />
                )}
              </Button>
            ))}
          </Box>

          {/* User area */}
          {firebaseUser ? (
            <>
              <IconButton onClick={handleUserMenuOpen} size="small">
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: isViewingAs ? "error.main" : "primary.main",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {(profile?.name || firebaseUser.email || "U").charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={!!anchorEl}
                onClose={handleUserMenuClose}
                transformOrigin={{ horizontal: "right", vertical: "top" }}
                anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              >
                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    router.push("/dashboard");
                  }}
                >
                  <DashboardIcon fontSize="small" sx={{ mr: 1 }} />
                  Mina sidor
                </MenuItem>
                {profile && (profile.role === "Superadmin" || profile.role === "Dock Manager") && (
                  <MenuItem
                    onClick={() => {
                      handleUserMenuClose();
                      router.push("/admin");
                    }}
                  >
                    <AdminPanelSettingsIcon fontSize="small" sx={{ mr: 1 }} />
                    Administration
                  </MenuItem>
                )}
                <Divider />
                {isViewingAs && (
                  <MenuItem
                    onClick={() => {
                      handleUserMenuClose();
                      stopViewingAs();
                    }}
                    sx={{ color: "error.main" }}
                  >
                    <PersonOffIcon fontSize="small" sx={{ mr: 1 }} />
                    Sluta impersonifiera
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    logout();
                  }}
                >
                  <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                  Logga ut
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              variant="outlined"
              size="small"
              startIcon={<LoginIcon />}
              onClick={() => handleNav("/login")}
              sx={{
                textTransform: "none",
                borderColor: "rgba(79,195,247,0.4)",
                color: "primary.light",
                display: { xs: "none", md: "flex" },
              }}
            >
              Logga in
            </Button>
          )}

          {/* Mobile hamburger */}
          <IconButton
            color="inherit"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { md: "none" }, ml: 1 }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ "& .MuiDrawer-paper": { width: 260 } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Meny
          </Typography>
        </Box>
        <Divider />
        <List>
          {PUBLIC_NAV.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={pathname === item.path}
                onClick={() => handleNav(item.path)}
                sx={{ borderRadius: 1, mx: 1 }}
              >
                <ListItemText primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {item.label}
                    {item.requiresAuth && !firebaseUser && (
                      <LockOutlinedIcon sx={{ fontSize: 14, opacity: 0.5 }} />
                    )}
                  </Box>
                } />
              </ListItemButton>
            </ListItem>
          ))}
          <Divider sx={{ my: 1 }} />
          {firebaseUser ? (
            <>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleNav("/dashboard")} sx={{ borderRadius: 1, mx: 1 }}>
                  <ListItemText primary="Mina sidor" />
                </ListItemButton>
              </ListItem>
              {profile && (profile.role === "Superadmin" || profile.role === "Dock Manager") && (
                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleNav("/admin")} sx={{ borderRadius: 1, mx: 1 }}>
                    <ListItemText primary="Administration" />
                  </ListItemButton>
                </ListItem>
              )}
              {isViewingAs && (
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => {
                      setMobileOpen(false);
                      stopViewingAs();
                    }}
                    sx={{ borderRadius: 1, mx: 1, color: "error.main" }}
                  >
                    <ListItemText primary="Sluta impersonifiera" />
                  </ListItemButton>
                </ListItem>
              )}
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  sx={{ borderRadius: 1, mx: 1 }}
                >
                  <ListItemText primary="Logga ut" />
                </ListItemButton>
              </ListItem>
            </>
          ) : (
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNav("/login")} sx={{ borderRadius: 1, mx: 1 }}>
                <ListItemText primary="Logga in" />
              </ListItemButton>
            </ListItem>
          )}
        </List>
      </Drawer>
    </>
  );
}
