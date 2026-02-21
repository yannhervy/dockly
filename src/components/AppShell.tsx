"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, orderBy } from "firebase/firestore";
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
import Button from "@mui/material/Button";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Badge from "@mui/material/Badge";
import NotificationsIcon from "@mui/icons-material/Notifications";
import Tooltip from "@mui/material/Tooltip";
import PeopleIcon from "@mui/icons-material/People";
import SailingIcon from "@mui/icons-material/Sailing";
import DangerousIcon from "@mui/icons-material/Dangerous";
import PlaceIcon from "@mui/icons-material/Place";
import VisibilityIcon from "@mui/icons-material/Visibility";

const DRAWER_WIDTH = 260;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[]; // Empty = visible to all authenticated users
  dividerBefore?: string; // Section divider label before this item
}

const NAV_ITEMS: NavItem[] = [
  { label: "Hamnkatalog", path: "/admin/directory", icon: <PublicIcon /> },
  {
    label: "Hamnkapten",
    path: "/admin/manager",
    icon: <ManageAccountsIcon />,
    roles: ["Superadmin", "Dock Manager"],
  },
  {
    label: "Intresseanmälningar",
    path: "/admin/interests",
    icon: <SailingIcon />,
    roles: ["Superadmin", "Dock Manager"],
  },
  {
    label: "Användare",
    path: "/admin/users",
    icon: <PeopleIcon />,
    roles: ["Superadmin"],
    dividerBefore: "Admin",
  },
  {
    label: "Bryggor",
    path: "/admin/docks",
    icon: <AnchorIcon />,
    roles: ["Superadmin"],
  },
  {
    label: "Resurser",
    path: "/admin/resources",
    icon: <DirectionsBoatIcon />,
    roles: ["Superadmin"],
  },
  {
    label: "Markuppställning",
    path: "/admin/land-storage",
    icon: <ConstructionIcon />,
    roles: ["Superadmin", "Dock Manager"],
  },
  {
    label: "Övergivna objekt",
    path: "/admin/abandoned",
    icon: <DangerousIcon />,
    roles: ["Superadmin"],
  },
  {
    label: "Platser (POI)",
    path: "/admin/poi",
    icon: <PlaceIcon />,
    roles: ["Superadmin"],
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, realProfile, firebaseUser, logout, isViewingAs, viewingAsProfile, stopViewingAs } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [unseenReplyCount, setUnseenReplyCount] = useState(0);

  // Use real profile for permission checks in sidebar (not the viewed user's profile)
  const sidebarProfile = realProfile || profile;
  const isManagerOrAdmin = sidebarProfile?.role === "Superadmin" || sidebarProfile?.role === "Dock Manager";

  // Listen for pending users (approved === false)
  useEffect(() => {
    if (!isManagerOrAdmin) return;
    const q = query(collection(db, "users"), where("approved", "==", false));
    const unsub = onSnapshot(q, (snap) => setPendingCount(snap.size));
    return () => unsub();
  }, [isManagerOrAdmin]);

  // Listen for unseen replies on user's interests
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, "interests"),
      where("userId", "==", firebaseUser.uid)
    );
    const unsub = onSnapshot(q, async (snap) => {
      let count = 0;
      for (const d of snap.docs) {
        const data = d.data();
        const lastSeen = data.lastSeenRepliesAt?.toMillis?.() || 0;
        const repliesSnap = await getDocs(
          query(collection(db, "interests", d.id, "replies"), orderBy("createdAt", "desc"))
        );
        for (const r of repliesSnap.docs) {
          if (r.data().createdAt.toMillis() > lastSeen) count++;
        }
      }
      setUnseenReplyCount(count);
    });
    return () => unsub();
  }, [firebaseUser]);

  // Don't show the shell on the login or setup pages
  if (pathname === "/login" || pathname === "/setup") {
    return <>{children}</>;
  }

  // Block tenants from accessing admin pages
  if (profile && profile.role === "Tenant") {
    router.replace("/dashboard");
    return null;
  }

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return sidebarProfile && item.roles.includes(sidebarProfile.role);
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
          <React.Fragment key={item.path}>
            {item.dividerBefore && (
              <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                  {item.dividerBefore}
                </Typography>
              </Box>
            )}
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNav(item.path)}
                selected={pathname.startsWith(item.path)}
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
          </React.Fragment>
        ))}
      </List>

      {/* Link to public website */}
      <List sx={{ px: 1, pb: 0 }}>
        <ListItem disablePadding>
          <ListItemButton
            component="a"
            href="/"
            sx={{ borderRadius: 2 }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
              <OpenInNewIcon />
            </ListItemIcon>
            <ListItemText primary="Hemsida" />
          </ListItemButton>
        </ListItem>
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
                bgcolor: isViewingAs ? "error.main" : "primary.main",
                color: isViewingAs ? "error.contrastText" : "primary.contrastText",
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
          {isViewingAs && (
            <ListItemButton
              onClick={stopViewingAs}
              sx={{ borderRadius: 2, py: 0.5, color: "error.main", mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: "error.main" }}>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Sluta impersonifiera"
                primaryTypographyProps={{ variant: "body2", fontWeight: 600 }}
              />
            </ListItemButton>
          )}
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
          {isManagerOrAdmin && pendingCount > 0 && (
            <Tooltip title={`${pendingCount} konton väntar på godkännande`}>
              <IconButton
                color="inherit"
                onClick={() => router.push("/dashboard")}
                sx={{ ml: 1 }}
              >
                <Badge badgeContent={pendingCount} color="warning">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          {unseenReplyCount > 0 && (
            <Tooltip title={`${unseenReplyCount} nya svar på dina intresseanmälningar`}>
              <IconButton
                color="inherit"
                onClick={() => router.push("/dashboard")}
                sx={{ ml: 0.5 }}
              >
                <Badge badgeContent={unseenReplyCount} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
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
        {/* View-as impersonation banner */}
        {isViewingAs && viewingAsProfile && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              py: 1,
              px: 2,
              bgcolor: "rgba(255, 183, 77, 0.15)",
              borderBottom: "1px solid rgba(255, 183, 77, 0.3)",
              color: "warning.main",
            }}
          >
            <VisibilityIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Du visar appen som {viewingAsProfile.name} ({viewingAsProfile.role})
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={stopViewingAs}
              sx={{ ml: 1, textTransform: "none" }}
            >
              Avsluta
            </Button>
          </Box>
        )}
        {children}
      </Box>
    </Box>
  );
}
