"use client";

import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dock, Resource, User } from "@/lib/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Grid from "@mui/material/Grid";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import AnchorIcon from "@mui/icons-material/Anchor";

export default function DirectoryPage() {
  const [docks, setDocks] = useState<Dock[]>([]);
  const [selectedDockId, setSelectedDockId] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [occupants, setOccupants] = useState<Record<string, User>>({});
  const [loadingDocks, setLoadingDocks] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);

  // Fetch all docks
  useEffect(() => {
    async function fetchDocks() {
      try {
        const snap = await getDocs(collection(db, "docks"));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock);
        setDocks(items);
        if (items.length > 0) {
          setSelectedDockId(items[0].id);
        }
      } catch (err) {
        console.error("Error fetching docks:", err);
      } finally {
        setLoadingDocks(false);
      }
    }
    fetchDocks();
  }, []);

  // Fetch berths for selected dock
  useEffect(() => {
    if (!selectedDockId) return;

    async function fetchResources() {
      setLoadingResources(true);
      try {
        const q = query(
          collection(db, "resources"),
          where("dockId", "==", selectedDockId),
          where("type", "==", "Berth")
        );
        const snap = await getDocs(q);
        const items = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Resource
        );
        setResources(items);

        // Fetch occupant profiles
        const occupantIds = items
          .filter((r) => r.occupantId)
          .map((r) => r.occupantId);
        const uniqueIds = [...new Set(occupantIds)];

        const occupantMap: Record<string, User> = {};
        for (const uid of uniqueIds) {
          try {
            const { doc: docRef, getDoc } = await import("firebase/firestore");
            const userSnap = await getDoc(docRef(db, "users", uid));
            if (userSnap.exists()) {
              occupantMap[uid] = { id: userSnap.id, ...userSnap.data() } as User;
            }
          } catch {
            // Skip users that can't be fetched
          }
        }
        setOccupants(occupantMap);
      } catch (err) {
        console.error("Error fetching resources:", err);
      } finally {
        setLoadingResources(false);
      }
    }
    fetchResources();
  }, [selectedDockId]);

  const handleDockChange = (event: SelectChangeEvent) => {
    setSelectedDockId(event.target.value);
  };

  const getOccupantDisplayName = (occupantId: string): string => {
    if (!occupantId) return "—";
    const user = occupants[occupantId];
    if (!user) return "—";
    return user.isPublic ? user.name : "Dold medlem";
  };

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            mb: 1,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <AnchorIcon sx={{ color: "primary.main" }} />
          Harbor Directory
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Browse berths and see who is moored at each dock.
        </Typography>
      </Box>

      {/* Dock selector */}
      <FormControl fullWidth sx={{ mb: 4, maxWidth: 400 }}>
        <InputLabel>Select Dock</InputLabel>
        <Select
          value={selectedDockId}
          label="Select Dock"
          onChange={handleDockChange}
          disabled={loadingDocks}
        >
          {docks.map((dock) => (
            <MenuItem key={dock.id} value={dock.id}>
              {dock.name}
              <Chip
                label={dock.type}
                size="small"
                sx={{
                  ml: 1,
                  height: 20,
                  fontSize: 11,
                  bgcolor:
                    dock.type === "Association"
                      ? "rgba(102, 187, 106, 0.15)"
                      : "rgba(255, 183, 77, 0.15)",
                  color:
                    dock.type === "Association"
                      ? "success.main"
                      : "secondary.main",
                }}
              />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Berths grid */}
      {loadingResources ? (
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton
                variant="rectangular"
                height={280}
                sx={{ borderRadius: 3 }}
              />
            </Grid>
          ))}
        </Grid>
      ) : resources.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            py: 8,
            color: "text.secondary",
          }}
        >
          <DirectionsBoatIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6">No berths found</Typography>
          <Typography variant="body2">
            {selectedDockId
              ? "This dock has no berths registered yet."
              : "Select a dock to view its berths."}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {resources.map((resource) => {
            const occupant = resource.occupantId
              ? occupants[resource.occupantId]
              : null;
            const isPrivate = occupant && !occupant.isPublic;

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={resource.id}>
                <Card
                  sx={{
                    height: "100%",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 8px 32px rgba(79, 195, 247, 0.15)",
                    },
                  }}
                >
                  {/* Boat image */}
                  {resource.boatImageUrl ? (
                    <CardMedia
                      component="img"
                      height="180"
                      image={resource.boatImageUrl}
                      alt={`Boat at ${resource.markingCode}`}
                      sx={{ objectFit: "cover" }}
                    />
                  ) : (
                    <Box
                      sx={{
                        height: 180,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        bgcolor: "rgba(79, 195, 247, 0.05)",
                      }}
                    >
                      <DirectionsBoatIcon
                        sx={{ fontSize: 64, color: "text.secondary", opacity: 0.3 }}
                      />
                    </Box>
                  )}
                  <CardContent>
                    {/* Marking code */}
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {resource.markingCode}
                      </Typography>
                      <Chip
                        label={resource.status}
                        size="small"
                        color={
                          resource.status === "Available" ? "success" : "warning"
                        }
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>

                    {/* Occupant name */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        color: isPrivate ? "text.secondary" : "text.primary",
                      }}
                    >
                      {isPrivate && (
                        <VisibilityOffIcon fontSize="small" sx={{ opacity: 0.6 }} />
                      )}
                      <Typography variant="body2">
                        {resource.status === "Occupied"
                          ? getOccupantDisplayName(resource.occupantId)
                          : "Available"}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
