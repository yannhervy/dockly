"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Dock, User } from "@/lib/types";
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

export default function DocksPage() {
  const [docks, setDocks] = useState<Dock[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [dSnap, uSnap] = await Promise.all([
          getDocs(collection(db, "docks")),
          getDocs(collection(db, "users")),
        ]);
        setDocks(dSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock).sort((a, b) => a.name.localeCompare(b.name)));
        setUsers(uSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as User));
      } catch (err) {
        console.error("Error fetching docks:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getManager = (uid: string) => users.find((u) => u.id === uid);

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <DirectionsBoatIcon sx={{ fontSize: 36, color: "primary.main" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Våra bryggor
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 600 }}>
        Nedan ser du bryggorna i Stegerholmens Hamn. Kontakta bryggansvarig
        för frågor om lediga platser.
      </Typography>

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
                      managers.map((mgr) => (
                        <Box key={mgr.id} sx={{ mb: 1.5 }}>
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
                        </Box>
                      ))
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
