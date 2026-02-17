"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { Berth, Dock, Resource, LandStorageEntry, SeaHut, Box as BoxType } from "@/lib/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import CloseIcon from "@mui/icons-material/Close";
import MapIcon from "@mui/icons-material/Map";
import HomeIcon from "@mui/icons-material/Home";
import SmsIcon from "@mui/icons-material/Sms";
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { computeRectCorners, computeBoatHull, HARBOR_CENTER } from "@/lib/mapUtils";
import { normalizePhone } from "@/lib/phoneUtils";
import ProtectedRoute from "@/components/ProtectedRoute";

const DEFAULT_ZOOM = 18;

// Discriminated union for any clickable map object
type SelectedObject =
  | { kind: "berth"; data: Berth }
  | { kind: "resource"; data: Resource }
  | { kind: "landStorage"; data: LandStorageEntry };

// Check if a normalized phone number is a valid Swedish mobile (07x)
function isMobileNumber(phone: string): boolean {
  const n = normalizePhone(phone);
  return n.length === 10 && n.startsWith("07");
}

// Format phone to international E.164 for sms: link
function toSmsHref(phone: string): string {
  const n = normalizePhone(phone);
  return `sms:+46${n.slice(1)}`;
}

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
  return "Upptagen - ej registrerad användare";
}

// Component that draws polygons + labels using the Maps API directly
function BerthPolygons({
  berths,
  docks,
  onSelect,
  currentUid,
}: {
  berths: Berth[];
  docks: Dock[];
  onSelect: (b: Berth | null) => void;
  currentUid?: string;
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

      const corners = computeBoatHull(berth.lat, berth.lng, w, l, h);
      const color = getBerthColor(berth);
      const isMine = !!(currentUid && berth.occupantIds?.includes(currentUid));

      const polygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: isMine ? "#00E5FF" : color,
        strokeOpacity: 0.9,
        strokeWeight: isMine ? 4 : 2,
        fillColor: isMine ? "#00E5FF" : color,
        fillOpacity: isMine ? 0.55 : 0.45,
        map,
        zIndex: isMine ? 10 : 1,
      });

      polygon.addListener("click", () => onSelect(berth));

      // Hover effects
      polygon.addListener("mouseover", () => {
        polygon.setOptions({ fillOpacity: 0.7, strokeWeight: isMine ? 5 : 3 });
      });
      polygon.addListener("mouseout", () => {
        polygon.setOptions({ fillOpacity: isMine ? 0.55 : 0.45, strokeWeight: isMine ? 4 : 2 });
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
  }, [map, coreLib, markerLib, berths, docks, onSelect, currentUid]);

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

// Component that draws SeaHuts and Boxes as circle markers (like land storage)
function ResourceMarkers({ resources, currentUid, onSelect }: { resources: Resource[]; currentUid?: string; onSelect: (r: Resource) => void }) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map || !markerLib) return;

    const cleanups: (() => void)[] = [];

    const getColor = (res: Resource) => {
      if (res.status === "Available") return { bg: "#4CAF50", border: "#388E3C" };
      if (res.occupantIds && res.occupantIds.length > 0) return { bg: "#F44336", border: "#C62828" };
      return { bg: "#FFC107", border: "#F9A825" };
    };

    resources.forEach((res) => {
      if (!res.lat || !res.lng) return;

      const isMine = !!(currentUid && res.occupantIds?.includes(currentUid));
      const colors = getColor(res);

      const el = document.createElement("div");
      el.innerHTML = `<span>${res.markingCode}</span>`;
      el.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${isMine ? "#00E5FF" : colors.bg};
        border: 2px solid ${isMine ? "#00B8D4" : colors.border};
        color: ${isMine ? "#000" : "#fff"};
        font-size: 7px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: ${isMine ? "0 0 10px 3px rgba(0,229,255,0.6)" : "0 2px 6px rgba(0,0,0,0.5)"};
        text-shadow: ${isMine ? "none" : "0 1px 2px rgba(0,0,0,0.6)"};
        transition: transform 0.15s;
      `;
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.3)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
      el.addEventListener("click", () => onSelect(res));

      const typeLabel = res.type === "SeaHut" ? "Sjöbod" : "Låda";
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: res.lat, lng: res.lng },
        map,
        content: el,
        title: `${res.markingCode} (${typeLabel})`,
        zIndex: isMine ? 10 : 1,
      });

      cleanups.push(() => { marker.map = null; });
    });

    return () => { cleanups.forEach((fn) => fn()); };
  }, [map, markerLib, resources, currentUid, onSelect]);

  return null;
}

// Component that draws land storage entries as orange circle markers
function LandStorageMarkers({ entries, currentUid, onSelect }: { entries: LandStorageEntry[]; currentUid?: string; onSelect: (e: LandStorageEntry) => void }) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map || !markerLib) return;

    const cleanups: (() => void)[] = [];

    entries.forEach((entry) => {
      if (!entry.lat || !entry.lng) return;

      const isOccupied = entry.status === "Occupied";
      const isMine = !!(currentUid && entry.occupantId === currentUid);

      // Create a styled circle marker
      const el = document.createElement("div");
      el.innerHTML = `<span>${entry.code}</span>`;
      el.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${isMine ? "#00E5FF" : isOccupied ? "#F57C00" : "#66BB6A"};
        border: 2px solid ${isMine ? "#00B8D4" : isOccupied ? "#E65100" : "#388E3C"};
        color: ${isMine ? "#000" : "#fff"};
        font-size: 8px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: ${isMine ? "0 0 10px 3px rgba(0,229,255,0.6)" : "0 2px 6px rgba(0,0,0,0.5)"};
        text-shadow: ${isMine ? "none" : "0 1px 2px rgba(0,0,0,0.6)"};
        transition: transform 0.15s;
      `;
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.3)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
      el.addEventListener("click", () => onSelect(entry));

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: entry.lat, lng: entry.lng },
        map,
        content: el,
        title: `${entry.code} — Markförvaring`,
        zIndex: 4,
      });

      cleanups.push(() => { marker.map = null; });
    });

    return () => { cleanups.forEach((fn) => fn()); };
  }, [map, markerLib, entries, currentUid, onSelect]);

  return null;
}

export default function MapPage() {
  const { firebaseUser, isSuperadmin, isDockManager } = useAuth();
  const currentUid = firebaseUser?.uid;
  const isManager = isSuperadmin || isDockManager;
  const [berths, setBerths] = useState<Berth[]>([]);
  const [otherResources, setOtherResources] = useState<Resource[]>([]);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [landEntries, setLandEntries] = useState<LandStorageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedObject, setSelectedObject] = useState<SelectedObject | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [rSnap, dSnap, lSnap] = await Promise.all([
          getDocs(collection(db, "resources")),
          getDocs(collection(db, "docks")),
          getDocs(collection(db, "landStorage")),
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
        setLandEntries(
          lSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as LandStorageEntry)
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

  const handleSelectBerth = useCallback((b: Berth | null) => {
    if (b) setSelectedObject({ kind: "berth", data: b });
    else setSelectedObject(null);
  }, []);

  const handleSelectResource = useCallback((r: Resource) => {
    setSelectedObject({ kind: "resource", data: r });
  }, []);

  const handleSelectLandStorage = useCallback((e: LandStorageEntry) => {
    setSelectedObject({ kind: "landStorage", data: e });
  }, []);

  const berthsWithCoords = berths.filter((b) => b.lat && b.lng);
  const seaHuts = otherResources.filter((r) => r.type === "SeaHut");
  const boxes = otherResources.filter((r) => r.type === "Box");
  const landWithCoords = landEntries.filter((e) => e.lat && e.lng);

  return (
    <ProtectedRoute>
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
        <IconButton href="/" sx={{ color: "text.secondary" }}>
          <HomeIcon />
        </IconButton>
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
            label="Upptagen - ej reg."
          />
          <Chip
            size="small"
            sx={{ bgcolor: "#F57C00", color: "#fff", fontWeight: 600 }}
            label="Markförvaring"
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
                onSelect={handleSelectBerth}
                currentUid={currentUid}
              />
              <DockPolygons docks={docks} />
              <ResourceMarkers resources={otherResources} currentUid={currentUid} onSelect={handleSelectResource} />
              <LandStorageMarkers entries={landEntries} currentUid={currentUid} onSelect={handleSelectLandStorage} />
            </Map>
          </APIProvider>
        )}

        {/* Unified Info panel */}
        {selectedObject && (() => {
          // Extract common display data based on selected object kind
          const obj = selectedObject;
          const label =
            obj.kind === "berth" ? obj.data.markingCode
            : obj.kind === "resource" ? obj.data.markingCode
            : obj.data.code;
          const typeLabel =
            obj.kind === "berth" ? "Båtplats"
            : obj.kind === "resource" ? (obj.data.type === "SeaHut" ? "Sjöbod" : "Låda")
            : "Markförvaring";
          const statusText =
            obj.kind === "landStorage"
              ? (obj.data.status === "Occupied" ? "Upptagen" : "Ledig")
              : obj.kind === "berth"
                ? getBerthColorLabel(obj.data)
                : (obj.data.status === "Available" ? "Ledig" : ((obj.data.occupantIds?.length ?? 0) > 0 ? "Upptagen" : "Upptagen - ej reg."));
          const statusColor =
            obj.kind === "berth" ? getBerthColor(obj.data)
            : obj.kind === "landStorage"
              ? (obj.data.status === "Occupied" ? "#F57C00" : "#4CAF50")
              : (obj.data.status === "Available" ? "#4CAF50" : ((obj.data.occupantIds?.length ?? 0) > 0 ? "#F44336" : "#FFC107"));

          // Occupant personal data
          let occupantName = "";
          let occupantPhone = "";
          let occupantEmail = "";
          let occupantAddress = "";
          let occupantPostalAddress = "";
          let comment = "";

          if (obj.kind === "resource" && (obj.data.type === "SeaHut" || obj.data.type === "Box")) {
            const d = obj.data as SeaHut | BoxType;
            occupantName = [d.occupantFirstName, d.occupantLastName].filter(Boolean).join(" ");
            occupantPhone = d.occupantPhone || "";
            occupantEmail = d.occupantEmail || "";
            occupantAddress = d.occupantAddress || "";
            occupantPostalAddress = d.occupantPostalAddress || "";
            comment = d.comment || "";
          } else if (obj.kind === "landStorage") {
            occupantName = [obj.data.firstName, obj.data.lastName].filter(Boolean).join(" ");
            occupantPhone = obj.data.phone || "";
            occupantEmail = obj.data.email || "";
            comment = obj.data.comment || "";
          }

          // Image URL
          const imageUrl =
            obj.kind === "landStorage" ? obj.data.imageUrl
            : (obj.data as Resource).objectImageUrl;

          // Dimensions
          const width = obj.kind !== "landStorage" ? (obj.data as Resource).maxWidth : undefined;
          const length = obj.kind !== "landStorage" ? (obj.data as Resource).maxLength : undefined;
          const heading = obj.kind !== "landStorage" ? (obj.data as Resource).heading : undefined;

          // Pricing — never show for berths
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const price2025 = obj.kind !== "berth" ? (obj.data as any).price2025 : undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const price2026 = obj.kind !== "berth" ? (obj.data as any).price2026 : undefined;

          // SeaHut size
          const seaHutSize = obj.kind === "resource" && obj.data.type === "SeaHut" ? (obj.data as SeaHut).size : undefined;

          // Berth-specific
          const direction = obj.kind === "berth" ? obj.data.direction : undefined;
          const dockName = obj.kind === "berth" ? getDockName(obj.data.dockId) : "";

          return (
            <Paper
              elevation={8}
              sx={{
                position: "absolute",
                bottom: 24,
                left: 24,
                p: 2.5,
                minWidth: 300,
                maxWidth: 380,
                maxHeight: "calc(100% - 48px)",
                overflowY: "auto",
                bgcolor: "rgba(13, 33, 55, 0.95)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(79,195,247,0.15)",
                borderRadius: 2,
                zIndex: 5,
              }}
            >
              {/* Header */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{label}</Typography>
                  <Typography variant="caption" color="text.secondary">{typeLabel}</Typography>
                </Box>
                <IconButton size="small" onClick={() => setSelectedObject(null)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>

              {/* Status chips */}
              <Box sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
                <Chip label={statusText} size="small" sx={{ bgcolor: statusColor, color: statusColor === "#FFC107" ? "#000" : "#fff", fontWeight: 600 }} />
                {direction && (
                  <Chip label={direction === "inside" ? "Insida" : "Utsida"} size="small" variant="outlined" color={direction === "inside" ? "info" : "warning"} />
                )}
                {seaHutSize && (
                  <Chip label={seaHutSize === "Large" ? "Stor" : "Liten"} size="small" variant="outlined" color="info" />
                )}
              </Box>

              {/* Image */}
              {imageUrl && (
                <Box
                  component="img"
                  src={imageUrl}
                  alt={label}
                  sx={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 1, mb: 1.5, border: "1px solid rgba(79,195,247,0.1)" }}
                />
              )}

              {/* General info */}
              {dockName && (
                <Typography variant="body2" color="text.secondary"><strong>Brygga:</strong> {dockName}</Typography>
              )}
              {(width || length) && (
                <Typography variant="body2" color="text.secondary">
                  <strong>{obj.kind === "berth" ? "Max mått:" : "Mått:"}</strong>{" "}
                  {length ? `${length}m` : "—"} × {width ? `${width}m` : "—"}
                </Typography>
              )}
              {heading !== undefined && heading !== 0 && (
                <Typography variant="body2" color="text.secondary"><strong>Riktning:</strong> {heading}°</Typography>
              )}

              {/* Pricing — never for berths */}
              {(price2025 || price2026) && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Pris:</strong>{" "}
                  {price2025 ? `${price2025} kr (2025)` : ""}
                  {price2025 && price2026 ? " / " : ""}
                  {price2026 ? `${price2026} kr (2026)` : ""}
                </Typography>
              )}

              {/* Manager-only: Personal info */}
              {isManager && occupantName && (
                <>
                  <Divider sx={{ my: 1.5, borderColor: "rgba(79,195,247,0.15)" }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: "primary.main" }}>Uppgifter</Typography>
                  <Typography variant="body2" color="text.secondary"><strong>Namn:</strong> {occupantName}</Typography>
                  {occupantPhone && (
                    <Typography variant="body2" color="text.secondary"><strong>Telefon:</strong> {occupantPhone}</Typography>
                  )}
                  {occupantEmail && (
                    <Typography variant="body2" color="text.secondary"><strong>E-post:</strong> {occupantEmail}</Typography>
                  )}
                  {occupantAddress && (
                    <Typography variant="body2" color="text.secondary"><strong>Adress:</strong> {occupantAddress}</Typography>
                  )}
                  {occupantPostalAddress && (
                    <Typography variant="body2" color="text.secondary"><strong>Postadress:</strong> {occupantPostalAddress}</Typography>
                  )}
                  {comment && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: "italic" }}>{comment}</Typography>
                  )}

                  {/* SMS button for managers when valid mobile */}
                  {occupantPhone && isMobileNumber(occupantPhone) && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<SmsIcon />}
                      href={toSmsHref(occupantPhone)}
                      sx={{ mt: 1.5 }}
                    >
                      Skicka SMS
                    </Button>
                  )}
                </>
              )}
            </Paper>
          );
        })()}

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
              {berthsWithCoords.length} / {berths.length} båtplatser
            </Typography>
            {seaHuts.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {seaHuts.length} sjöbodar
              </Typography>
            )}
            {boxes.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {boxes.length} lådor
              </Typography>
            )}
            {landEntries.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {landWithCoords.length} / {landEntries.length} markplatser
              </Typography>
            )}
          </Paper>
        )}
      </Box>
    </Box>
    </ProtectedRoute>
  );
}
