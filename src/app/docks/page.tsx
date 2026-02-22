"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { Dock, User, Resource } from "@/lib/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import EmailIcon from "@mui/icons-material/Email";
import AnchorIcon from "@mui/icons-material/Anchor";
import LoginIcon from "@mui/icons-material/Login";
import Alert from "@mui/material/Alert";
import Link from "next/link";

export default function DocksPage() {
  const { firebaseUser } = useAuth();
  const isLoggedIn = !!firebaseUser;

  const [docks, setDocks] = useState<Dock[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [dSnap, uSnap, rSnap] = await Promise.all([
          getDocs(collection(db, "docks")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "resources")),
        ]);
        setDocks(dSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock).sort((a, b) => a.name.localeCompare(b.name)));
        setUsers(uSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as User));
        setResources(rSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Resource));
      } catch (err) {
        console.error("Error fetching docks:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getManager = (uid: string) => users.find((u) => u.id === uid);

  // Count berths per dock
  const getBerthCounts = (dockId: string) => {
    const berths = resources.filter((r) => r.type === "Berth" && r.dockId === dockId);
    const total = berths.length;
    const available = berths.filter((r) => r.status === "Available").length;
    return { total, available };
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <DirectionsBoatIcon sx={{ fontSize: 36, color: "primary.main" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Våra bryggor
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 600 }}>
        Nedan ser du bryggorna i Stegerholmens Hamn. Kontakta bryggansvarig
        för frågor om lediga platser.
      </Typography>

      {/* Interest registration CTA */}
      <Button
        component={Link}
        href="/interest"
        variant="contained"
        size="large"
        sx={{
          mb: 3,
          px: 4,
          py: 1.2,
          textTransform: "none",
          borderRadius: 3,
          fontSize: "0.95rem",
          background: "linear-gradient(135deg, #4FC3F7, #0288D1)",
          "&:hover": {
            background: "linear-gradient(135deg, #29B6F6, #0277BD)",
          },
        }}
      >
        Intresseanmälan för båtplats
      </Button>

      {/* Login prompt for unauthenticated visitors */}
      {!isLoggedIn && !loading && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button
              component={Link}
              href="/login"
              color="inherit"
              size="small"
              startIcon={<LoginIcon />}
              sx={{ textTransform: "none" }}
            >
              Logga in
            </Button>
          }
        >
          Logga in eller skapa ett konto för att göra en intresseanmälan för båtplats.
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {docks.map((dock) => {
            const managers = (dock.managerIds || [])
              .map((id) => getManager(id))
              .filter(Boolean) as User[];

            const { total, available } = getBerthCounts(dock.id);

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={dock.id}>
                <Card
                  sx={{
                    height: "100%",
                    bgcolor: "rgba(13, 33, 55, 0.6)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(79,195,247,0.08)",
                    transition: "all 0.3s",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      border: "1px solid rgba(79,195,247,0.2)",
                    },
                  }}
                >
                  {dock.imageUrl && (
                    <Box
                      component="img"
                      src={dock.imageUrl}
                      alt={dock.name}
                      sx={{
                        width: "100%",
                        height: 160,
                        objectFit: "cover",
                      }}
                    />
                  )}
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                      <AnchorIcon sx={{ color: "primary.main" }} />
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {dock.name}
                      </Typography>
                    </Box>

                    {dock.associationName && (
                      <Chip
                        label={dock.associationName}
                        size="small"
                        color="success"
                        sx={{ mb: 2 }}
                      />
                    )}

                    {/* Berth statistics */}
                    <Box sx={{ mb: 2 }}>
                      {total === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                          Inga båtplatser upplagda
                        </Typography>
                      ) : (
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                          <Chip
                            icon={<DirectionsBoatIcon />}
                            label={`${total} platser`}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                          {available > 0 && (
                            <Chip
                              label={`${available} lediga`}
                              size="small"
                              color="success"
                            />
                          )}
                        </Box>
                      )}
                    </Box>

                    {/* Managers */}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", fontWeight: 600, mb: 0.5 }}
                    >
                      Bryggansvarig
                    </Typography>

                    {managers.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", mb: 1.5 }}>
                        Ingen bryggansvarig tilldelad
                      </Typography>
                    ) : (
                      managers.map((mgr) => {
                        // Show contact details if logged in OR if the manager profile is public
                        const showContact = isLoggedIn || mgr.isPublic;

                        return (
                          <Box key={mgr.id} sx={{ mb: 1.5 }}>
                            {showContact ? (
                              <>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {mgr.name}
                                </Typography>
                                {mgr.email && (
                                  <Button
                                    size="small"
                                    startIcon={<EmailIcon />}
                                    href={`mailto:${mgr.email}`}
                                    sx={{ textTransform: "none", mt: 0.5, fontSize: "0.8rem" }}
                                  >
                                    {mgr.email}
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                Logga in för att se kontaktuppgifter
                              </Typography>
                            )}
                          </Box>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {docks.length === 0 && !loading && (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          Inga bryggor har lagts till ännu.
        </Typography>
      )}
    </Box>
  );
}
