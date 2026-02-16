"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Berth, Dock, Resource } from "@/lib/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import MapIcon from "@mui/icons-material/Map";
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { computeRectCorners, HARBOR_CENTER } from "@/lib/mapUtils";

const DEFAULT_ZOOM = 18;

// Get color based on berth status
function getBerthColor(berth: Berth): string {
  if (berth.status === "Available") return "#4CAF50"; // green
  // Occupied — check if occupantIds has any registered users
  if (berth.occupantIds && berth.occupantIds.length > 0) return "#F44336"; // red
  return "#FFC107"; // yellow — occupied but no registered tenant
}

function getBerthColorLabel(berth: Berth): string {
  if (berth.status === "Available") return "Ledig";
  if (berth.occupantIds && berth.occupantIds.length > 0) return "Upptagen (registrerad)";
  return "Upptagen (ej registrerad)";
}

// Component that draws polygons + labels using the Maps API directly
function BerthPolygons({
  berths,
  docks,
  onSelect,
}: {
  berths: Berth[];
  docks: Dock[];
  onSelect: (b: Berth | null) => void;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map || !coreLib || !markerLib) return;

    const cleanups: (() => void)[] = [];

    berths.forEach((berth) => {
      if (!berth.lat || !berth.lng) return;

      const w = berth.maxWidth || 3;
      const l = berth.maxLength || 10;
      const h = berth.heading || 0;

      const corners = computeRectCorners(berth.lat, berth.lng, w, l, h);
      const color = getBerthColor(berth);

      const polygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.45,
        map,
        zIndex: 1,
      });

      polygon.addListener("click", () => onSelect(berth));

      // Hover effects
      polygon.addListener("mouseover", () => {
        polygon.setOptions({ fillOpacity: 0.7, strokeWeight: 3 });
      });
      polygon.addListener("mouseout", () => {
        polygon.setOptions({ fillOpacity: 0.45, strokeWeight: 2 });
      });

      // Label with marking code
      const labelEl = document.createElement("div");
      labelEl.textContent = berth.markingCode;
      labelEl.style.cssText = `
        font-size: 10px;
        font-weight: 700;
        color: #fff;
        background: rgba(0,0,0,0.55);
        padding: 1px 3px;
        border-radius: 2px;
        white-space: nowrap;
        pointer-events: none;
        text-shadow: 0 1px 2px rgba(0,0,0,0.9);
      `;
      const labelMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: berth.lat, lng: berth.lng },
        map,
        content: labelEl,
        zIndex: 2,
      });

      cleanups.push(() => {
        polygon.setMap(null);
        labelMarker.map = null;
      });
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [map, coreLib, markerLib, berths, docks, onSelect]);

  return null;
}

// Component that draws dock rectangles with rotated name labels
function DockPolygons({ docks }: { docks: Dock[] }) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map || !coreLib || !markerLib) return;

    const cleanups: (() => void)[] = [];

    docks.forEach((dock) => {
      if (!dock.lat || !dock.lng) return;

      const w = dock.maxWidth || 3;
      const l = dock.maxLength || 20;
      const h = dock.heading || 0;

      const corners = computeRectCorners(dock.lat, dock.lng, w, l, h);

      const polygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: "#42A5F5",
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: "#1E88E5",
        fillOpacity: 0.15,
        map,
        zIndex: 0,
      });

      // Compute visual rotation angle from projected polygon corners
      // corners[0]=front-left, corners[1]=front-right, corners[2]=back-right, corners[3]=back-left
      const frontMid = { lat: (corners[0].lat + corners[1].lat) / 2, lng: (corners[0].lng + corners[1].lng) / 2 };
      const backMid = { lat: (corners[2].lat + corners[3].lat) / 2, lng: (corners[2].lng + corners[3].lng) / 2 };
      // Screen coords: x=east(right), y=south(down, inverted from lat)
      const cosLat = Math.cos((dock.lat! * Math.PI) / 180);
      const screenDx = (backMid.lng - frontMid.lng) * cosLat;
      const screenDy = -(backMid.lat - frontMid.lat);
      let visualAngleDeg = Math.atan2(screenDy, screenDx) * (180 / Math.PI);
      // Ensure text is readable (not upside down)
      if (visualAngleDeg > 90) visualAngleDeg -= 180;
      else if (visualAngleDeg < -90) visualAngleDeg += 180;

      // Rotated label with dock name
      const labelEl = document.createElement("div");
      labelEl.textContent = dock.name;
      labelEl.style.cssText = `
        font-size: 12px;
        font-weight: 800;
        color: #90CAF9;
        background: rgba(0,0,0,0.55);
        padding: 2px 6px;
        border-radius: 3px;
        white-space: nowrap;
        pointer-events: none;
        text-shadow: 0 1px 3px rgba(0,0,0,0.9);
        transform: rotate(${visualAngleDeg}deg);
        letter-spacing: 1px;
      `;
      const labelMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: dock.lat, lng: dock.lng },
        map,
        content: labelEl,
        zIndex: 3,
      });

      cleanups.push(() => {
        polygon.setMap(null);
        labelMarker.map = null;
      });
    });

    return () => { cleanups.forEach((fn) => fn()); };
  }, [map, coreLib, markerLib, docks]);

  return null;
}

// Component that draws SeaHuts and Boxes as polygons with labels
function ResourcePolygons({ resources }: { resources: Resource[] }) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map || !coreLib || !markerLib) return;

    const cleanups: (() => void)[] = [];

    const colorMap: Record<string, { stroke: string; fill: string; label: string }> = {
      SeaHut: { stroke: "#66BB6A", fill: "#43A047", label: "#A5D6A7" },
      Box:    { stroke: "#FFA726", fill: "#FB8C00", label: "#FFE0B2" },
    };

    resources.forEach((res) => {
      if (!res.lat || !res.lng) return;

      const w = res.maxWidth || 2;
      const l = res.maxLength || 3;
      const h = res.heading || 0;
      const colors = colorMap[res.type] || colorMap.Box;

      const corners = computeRectCorners(res.lat, res.lng, w, l, h);

      const polygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: colors.stroke,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: colors.fill,
        fillOpacity: 0.25,
        map,
        zIndex: 0,
      });

      const labelEl = document.createElement("div");
      labelEl.textContent = res.markingCode;
      labelEl.style.cssText = `
        font-size: 10px;
        font-weight: 700;
        color: ${colors.label};
        background: rgba(0,0,0,0.55);
        padding: 1px 3px;
        border-radius: 2px;
        white-space: nowrap;
        pointer-events: none;
        text-shadow: 0 1px 2px rgba(0,0,0,0.9);
      `;
      const labelMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: res.lat, lng: res.lng },
        map,
        content: labelEl,
        zIndex: 1,
      });

      cleanups.push(() => {
        polygon.setMap(null);
        labelMarker.map = null;
      });
    });

    return () => { cleanups.forEach((fn) => fn()); };
  }, [map, coreLib, markerLib, resources]);

  return null;
}

export default function MapPage() {
  const [berths, setBerths] = useState<Berth[]>([]);
  const [otherResources, setOtherResources] = useState<Resource[]>([]);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBerth, setSelectedBerth] = useState<Berth | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [rSnap, dSnap] = await Promise.all([
          getDocs(collection(db, "resources")),
          getDocs(collection(db, "docks")),
        ]);

        const allResources = rSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Resource
        );
        const berthItems = allResources.filter(
          (r) => r.type === "Berth"
        ) as Berth[];
        const otherItems = allResources.filter(
          (r) => r.type === "SeaHut" || r.type === "Box"
        );

        setBerths(berthItems);
        setOtherResources(otherItems);
        setDocks(
          dSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock)
        );
      } catch (err) {
        console.error("Error fetching map data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getDockName = (dockId?: string) =>
    docks.find((d) => d.id === dockId)?.name || "";

  const handleSelect = useCallback((b: Berth | null) => {
    setSelectedBerth(b);
  }, []);

  const berthsWithCoords = berths.filter((b) => b.lat && b.lng);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          bgcolor: "rgba(13, 33, 55, 0.95)",
          borderBottom: "1px solid rgba(79,195,247,0.1)",
          zIndex: 10,
        }}
      >
        <MapIcon sx={{ color: "primary.main" }} />
        <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Hamnkarta
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Chip
            size="small"
            sx={{ bgcolor: "#4CAF50", color: "#fff", fontWeight: 600 }}
            label="Ledig"
          />
          <Chip
            size="small"
            sx={{ bgcolor: "#F44336", color: "#fff", fontWeight: 600 }}
            label="Upptagen"
          />
          <Chip
            size="small"
            sx={{ bgcolor: "#FFC107", color: "#000", fontWeight: 600 }}
            label="Ej registrerad"
          />
        </Box>
      </Box>

      {/* Map */}
      <Box sx={{ flexGrow: 1, position: "relative" }}>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}>
            <Map
              defaultCenter={HARBOR_CENTER}
              defaultZoom={DEFAULT_ZOOM}
              mapId="harbor-map"
              mapTypeId="satellite"
              style={{ width: "100%", height: "100%" }}
              gestureHandling="greedy"
              disableDefaultUI={false}
              zoomControl={true}
              mapTypeControl={true}
              streetViewControl={false}
            >
              <BerthPolygons
                berths={berthsWithCoords}
                docks={docks}
                onSelect={handleSelect}
              />
              <DockPolygons docks={docks} />
              <ResourcePolygons resources={otherResources} />
            </Map>
          </APIProvider>
        )}

        {/* Info panel */}
        {selectedBerth && (
          <Paper
            elevation={8}
            sx={{
              position: "absolute",
              bottom: 24,
              left: 24,
              p: 2.5,
              minWidth: 280,
              maxWidth: 360,
              bgcolor: "rgba(13, 33, 55, 0.95)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(79,195,247,0.15)",
              borderRadius: 2,
              zIndex: 5,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {selectedBerth.markingCode}
              </Typography>
              <IconButton size="small" onClick={() => setSelectedBerth(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
              <Chip
                label={getBerthColorLabel(selectedBerth)}
                size="small"
                sx={{
                  bgcolor: getBerthColor(selectedBerth),
                  color: selectedBerth.status === "Available" || (selectedBerth.occupantIds?.length ?? 0) > 0 ? "#fff" : "#000",
                  fontWeight: 600,
                }}
              />
              {selectedBerth.direction && (
                <Chip
                  label={selectedBerth.direction === "inside" ? "Insida" : "Utsida"}
                  size="small"
                  variant="outlined"
                  color={selectedBerth.direction === "inside" ? "info" : "warning"}
                />
              )}
            </Box>

            {getDockName(selectedBerth.dockId) && (
              <Typography variant="body2" color="text.secondary">
                <strong>Brygga:</strong> {getDockName(selectedBerth.dockId)}
              </Typography>
            )}
            {(selectedBerth.maxLength || selectedBerth.maxWidth) && (
              <Typography variant="body2" color="text.secondary">
                <strong>Max mått:</strong>{" "}
                {selectedBerth.maxLength ? `${selectedBerth.maxLength}m` : "—"} ×{" "}
                {selectedBerth.maxWidth ? `${selectedBerth.maxWidth}m` : "—"}
              </Typography>
            )}
            {selectedBerth.heading !== undefined && (
              <Typography variant="body2" color="text.secondary">
                <strong>Riktning:</strong> {selectedBerth.heading}°
              </Typography>
            )}
          </Paper>
        )}

        {/* Stats */}
        {!loading && (
          <Paper
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              px: 2,
              py: 1,
              bgcolor: "rgba(13, 33, 55, 0.85)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(79,195,247,0.1)",
              borderRadius: 1,
              zIndex: 5,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {berthsWithCoords.length} / {berths.length} platser på kartan
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
