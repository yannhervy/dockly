"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, doc, updateDoc, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { Berth, Dock, Resource, LandStorageEntry, SeaHut, Box as BoxType, AbandonedObject, POI } from "@/lib/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import PersonIcon from "@mui/icons-material/Person";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import CloseIcon from "@mui/icons-material/Close";
import MapIcon from "@mui/icons-material/Map";
import HomeIcon from "@mui/icons-material/Home";
import SmsIcon from "@mui/icons-material/Sms";
import DangerousIcon from "@mui/icons-material/Dangerous";
import SailingIcon from "@mui/icons-material/Sailing";
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { computeRectCorners, computeBoatHull, HARBOR_CENTER } from "@/lib/mapUtils";
import { normalizePhone } from "@/lib/phoneUtils";
import ProtectedRoute from "@/components/ProtectedRoute";

const DEFAULT_ZOOM = 17;

// Discriminated union for any clickable map object
type SelectedObject =
  | { kind: "berth"; data: Berth }
  | { kind: "resource"; data: Resource }
  | { kind: "landStorage"; data: LandStorageEntry }
  | { kind: "abandonedObject"; data: AbandonedObject }
  | { kind: "poi"; data: POI };

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
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: ${isMine ? "#00E5FF" : colors.bg};
        border: 2px solid ${isMine ? "#00B8D4" : colors.border};
        color: ${isMine ? "#000" : "#fff"};
        font-size: 10px;
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
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: ${isMine ? "#00E5FF" : isOccupied ? "#F57C00" : "#66BB6A"};
        border: 2px solid ${isMine ? "#00B8D4" : isOccupied ? "#E65100" : "#388E3C"};
        color: ${isMine ? "#000" : "#fff"};
        font-size: 10px;
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

// Component that draws abandoned objects as skull emoji markers
function AbandonedObjectMarkers({ entries, onSelect }: { entries: AbandonedObject[]; onSelect: (e: AbandonedObject) => void }) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map || !markerLib) return;

    const cleanups: (() => void)[] = [];

    entries.forEach((entry) => {
      if (!entry.lat || !entry.lng) return;

      const fillColor = entry.claimedByUid ? "#66BB6A" : "#fff";
      const el = document.createElement("div");
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${fillColor}"><path d="M15.73 3H8.27L3 8.27v7.46L8.27 21h7.46L21 15.73V8.27zM17 15.74 15.74 17 12 13.26 8.26 17 7 15.74 10.74 12 7 8.26 8.26 7 12 10.74 15.74 7 17 8.26 13.26 12z"/></svg><span style="font-size:8px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);margin-left:1px;">${entry.abandonedId}</span>`;
      el.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1px;
        cursor: pointer;
        transition: transform 0.15s;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
      `;
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.3)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
      el.addEventListener("click", () => onSelect(entry));

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: entry.lat, lng: entry.lng },
        map,
        content: el,
        title: `#${entry.abandonedId} — Övergiven`,
        zIndex: 5,
      });

      cleanups.push(() => { marker.map = null; });
    });

    return () => { cleanups.forEach((fn) => fn()); };
  }, [map, markerLib, entries, onSelect]);

  return null;
}

// Component that draws POI markers as pill-shaped purple labels
function POIMarkers({ pois, onSelect }: { pois: POI[]; onSelect: (p: POI) => void }) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map || !markerLib) return;

    const cleanups: (() => void)[] = [];

    pois.forEach((poi) => {
      if (!poi.lat || !poi.lng) return;

      const el = document.createElement("div");
      el.innerHTML = `<span>${poi.id}</span>`;
      el.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px 10px;
        border-radius: 12px;
        background: #7C4DFF;
        border: 2px solid #651FFF;
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        text-shadow: 0 1px 2px rgba(0,0,0,0.6);
        transition: transform 0.15s;
        white-space: nowrap;
      `;
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.15)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
      el.addEventListener("click", () => onSelect(poi));

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: poi.lat, lng: poi.lng },
        map,
        content: el,
        title: poi.id,
        zIndex: 5,
      });

      cleanups.push(() => { marker.map = null; });
    });

    return () => { cleanups.forEach((fn) => fn()); };
  }, [map, markerLib, pois, onSelect]);

  return null;
}

export default function MapPage() {
  const { firebaseUser, profile, isSuperadmin, isDockManager } = useAuth();
  const currentUid = firebaseUser?.uid;
  const isManager = isSuperadmin || isDockManager;
  const [berths, setBerths] = useState<Berth[]>([]);
  const [otherResources, setOtherResources] = useState<Resource[]>([]);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [landEntries, setLandEntries] = useState<LandStorageEntry[]>([]);
  const [abandonedObjects, setAbandonedObjects] = useState<AbandonedObject[]>([]);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedObject, setSelectedObject] = useState<SelectedObject | null>(null);
  const [snackMsg, setSnackMsg] = useState("");
  const [userSmsPrefs, setUserSmsPrefs] = useState<globalThis.Map<string, boolean>>(new globalThis.Map());
  const [buyConfirmOpen, setBuyConfirmOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [rSnap, dSnap, lSnap, aSnap, pSnap] = await Promise.all([
          getDocs(collection(db, "resources")),
          getDocs(collection(db, "docks")),
          getDocs(collection(db, "landStorage")),
          getDocs(collection(db, "abandonedObjects")),
          getDocs(collection(db, "pois")),
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
        setAbandonedObjects(
          aSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AbandonedObject)
        );
        setPois(
          pSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as POI)
        );

        // Load SMS preferences for all users
        const uSnap = await getDocs(collection(db, "users"));
        const prefs = new globalThis.Map<string, boolean>();
        uSnap.docs.forEach((d) => {
          const data = d.data();
          prefs.set(d.id, data.allowMapSms ?? true);
        });
        setUserSmsPrefs(prefs);
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

  const handleSelectAbandoned = useCallback((e: AbandonedObject) => {
    setSelectedObject({ kind: "abandonedObject", data: e });
  }, []);

  const handleSelectPOI = useCallback((p: POI) => {
    setSelectedObject({ kind: "poi", data: p });
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
        <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, flexWrap: "wrap" }}>
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
            label="Ej reg."
          />
          <Chip
            size="small"
            sx={{ bgcolor: "#F57C00", color: "#fff", fontWeight: 600 }}
            label="Mark"
          />
          <Chip
            size="small"
            sx={{ bgcolor: "#424242", color: "#fff", fontWeight: 600 }}
            icon={<DangerousIcon sx={{ fontSize: 16, color: "#fff !important" }} />}
            label="Övergiven"
          />
          <Chip
            size="small"
            sx={{ bgcolor: "#7C4DFF", color: "#fff", fontWeight: 600 }}
            label="POI"
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
              defaultTilt={45}
              mapId="harbor-map"
              mapTypeId="satellite"
              style={{ width: "100%", height: "100%" }}
              gestureHandling="greedy"
              disableDefaultUI={false}
              zoomControl={true}
              mapTypeControl={true}
              streetViewControl={false}
              headingInteractionEnabled={true}
              tiltInteractionEnabled={true}
              rotateControl={true}
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
              <AbandonedObjectMarkers entries={abandonedObjects} onSelect={handleSelectAbandoned} />
              <POIMarkers pois={pois} onSelect={handleSelectPOI} />
            </Map>
          </APIProvider>
        )}

        {/* Map hint banner (shown when no object is selected) */}
        {!selectedObject && (
          <Paper
            elevation={4}
            sx={{
              position: "absolute",
              bottom: 24,
              left: 24,
              p: 2,
              maxWidth: 340,
              bgcolor: "rgba(13, 33, 55, 0.95)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(79,195,247,0.15)",
              borderRadius: 2,
              zIndex: 5,
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              Klicka på en markör för mer information.
            </Typography>
          </Paper>
        )}

        {/* Unified Info panel */}
        {selectedObject && (() => {
          // Extract common display data based on selected object kind
          const obj = selectedObject;

          // ─── Abandoned object info panel ─────────────────────────
          if (obj.kind === "abandonedObject") {
            const d = obj.data;
            const objectTypeLabels: Record<string, string> = { Boat: "Båt", SeaHut: "Sjöbod", Box: "Låda", Other: "Övrigt" };
            const abandonedDate = d.abandonedSince?.toDate?.() ?? new Date();
            const isClaimed = !!d.claimedByUid;

            const handleClaimOwnership = async () => {
              if (!firebaseUser || !profile) return;
              try {
                await updateDoc(doc(db, "abandonedObjects", d.id), {
                  claimedByUid: firebaseUser.uid,
                  claimedByName: profile.name || firebaseUser.displayName || firebaseUser.email || "Okänd",
                  claimedByPhone: profile.phone || "",
                  claimedAt: Timestamp.now(),
                });
                // Update local state
                setAbandonedObjects((prev) => prev.map((a) => a.id === d.id ? { ...a, claimedByUid: firebaseUser.uid, claimedByName: profile.name || firebaseUser.displayName || "Okänd", claimedByPhone: profile.phone || "", claimedAt: Timestamp.now() } : a));
                setSelectedObject({ ...obj, data: { ...d, claimedByUid: firebaseUser.uid, claimedByName: profile.name || "Okänd", claimedByPhone: profile.phone || "" } });
                setSnackMsg("Du har registrerats som ägare!");
              } catch (err) {
                console.error("Error claiming ownership:", err);
              }
            };

            const handleWantToBuy = async () => {
              if (!firebaseUser || !profile) return;
              try {
                const typeLabel = objectTypeLabels[d.objectType] || d.objectType;
                const expiresAt = new Date();
                expiresAt.setMonth(expiresAt.getMonth() + 6);
                const listingRef = await addDoc(collection(db, "marketplace"), {
                  title: `Övergiven ${typeLabel.toLowerCase()} #${d.abandonedId} — köpes`,
                  description: `Jag vill köpa denna övergivna ${typeLabel.toLowerCase()} (ID #${d.abandonedId}). Kontakta mig om du är intresserad.`,
                  price: 0,
                  category: "WantedToBuy",
                  imageUrl: d.imageUrl || null,
                  contactEmail: profile.email || firebaseUser.email || "",
                  contactPhone: profile.phone || "",
                  createdBy: firebaseUser.uid,
                  createdAt: Timestamp.now(),
                  expiresAt: Timestamp.fromDate(expiresAt),
                  status: "Active",
                  abandonedObjectId: d.id,
                });
                await updateDoc(doc(db, "abandonedObjects", d.id), { purchaseListingId: listingRef.id });
                setAbandonedObjects((prev) => prev.map((a) => a.id === d.id ? { ...a, purchaseListingId: listingRef.id } : a));
                setSelectedObject({ ...obj, data: { ...d, purchaseListingId: listingRef.id } });
                setSnackMsg("Köpesannons skapad på marknadsplatsen!");
              } catch (err) {
                console.error("Error creating purchase listing:", err);
              }
            };

            return (
              <Paper
                elevation={8}
                sx={{
                  position: "absolute",
                  bottom: { xs: 8, sm: 24 },
                  left: { xs: 8, sm: 24 },
                  right: { xs: 8, sm: "auto" },
                  minWidth: { xs: 0, sm: 300 },
                  maxWidth: { xs: "none", sm: 380 },
                  maxHeight: "calc(100% - 48px)",
                  display: "flex",
                  flexDirection: "column",
                  bgcolor: "rgba(13, 33, 55, 0.95)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(79,195,247,0.15)",
                  borderRadius: 2,
                  zIndex: 5,
                }}
              >
                {/* Sticky header */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", p: { xs: 1.5, sm: 2.5 }, pb: 1, flexShrink: 0 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5 }}><DangerousIcon fontSize="small" /> #{d.abandonedId}</Typography>
                    <Typography variant="caption" color="text.secondary">Övergiven {objectTypeLabels[d.objectType] || d.objectType}</Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setSelectedObject(null)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Scrollable content */}
                <Box sx={{ overflowY: "auto", flex: 1, px: { xs: 1.5, sm: 2.5 }, WebkitOverflowScrolling: "touch" }}>
                <Box sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
                  <Chip label={objectTypeLabels[d.objectType] || d.objectType} size="small" sx={{ bgcolor: "#424242", color: "#fff", fontWeight: 600 }} />
                  {isClaimed ? (
                    <Chip icon={<PersonIcon />} label={`Ägare: ${d.claimedByName}`} size="small" sx={{ bgcolor: "rgba(102,187,106,0.2)", color: "#66BB6A", fontWeight: 600 }} />
                  ) : (
                    <Chip label="Ingen ägare" size="small" sx={{ bgcolor: "rgba(255,167,38,0.2)", color: "#FFA726", fontWeight: 600 }} />
                  )}
                  {d.purchaseListingId && (
                    <Chip icon={<ShoppingCartIcon />} label="Köpesannons" size="small" sx={{ bgcolor: "rgba(79,195,247,0.2)", color: "#4FC3F7", fontWeight: 600 }} />
                  )}
                </Box>

                {d.imageUrl && (
                  <Box
                    component="img"
                    src={d.imageUrl}
                    alt={`Abandoned #${d.abandonedId}`}
                    sx={{ width: "100%", borderRadius: 1, mb: 1.5, border: "1px solid rgba(79,195,247,0.1)" }}
                  />
                )}
                </Box>

                {/* Sticky footer */}
                <Box sx={{ p: { xs: 1.5, sm: 2.5 }, pt: 1, flexShrink: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Övergiven sedan:</strong> {abandonedDate.toLocaleDateString("sv-SE")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Position:</strong> {d.lat.toFixed(6)}, {d.lng.toFixed(6)}
                </Typography>
                {d.comment && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: "italic" }}>{d.comment}</Typography>
                )}

                {/* Action buttons for logged-in users */}
                {firebaseUser && (
                  <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
                    {!isClaimed && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<PersonIcon />}
                        onClick={handleClaimOwnership}
                        sx={{ textTransform: "none", bgcolor: "#66BB6A", "&:hover": { bgcolor: "#4CAF50" } }}
                      >
                        Jag är ägare
                      </Button>
                    )}
                    {!d.purchaseListingId && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ShoppingCartIcon />}
                        onClick={() => setBuyConfirmOpen(true)}
                        sx={{ textTransform: "none" }}
                      >
                        Jag vill köpa
                      </Button>
                    )}
                  </Box>
                )}

                {/* Purchase listing confirmation dialog */}
                <Dialog open={buyConfirmOpen} onClose={() => setBuyConfirmOpen(false)}>
                  <DialogTitle>Bekräfta köpesannons</DialogTitle>
                  <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      Genom att skapa en köpesannons publiceras ditt namn, e-postadress
                      och telefonnummer för alla inloggade medlemmar.
                    </Alert>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setBuyConfirmOpen(false)}>Avbryt</Button>
                    <Button
                      variant="contained"
                      onClick={() => {
                        setBuyConfirmOpen(false);
                        handleWantToBuy();
                      }}
                    >
                      Skapa annons
                    </Button>
                  </DialogActions>
                </Dialog>
                </Box>
              </Paper>
            );
          }

          // ─── POI info panel ───────────────────────────────────
          if (obj.kind === "poi") {
            const p = obj.data;
            return (
              <Paper
                elevation={6}
                sx={{
                  position: "absolute",
                  bottom: { xs: 8, sm: 24 },
                  left: { xs: 8, sm: 24 },
                  right: { xs: 8, sm: "auto" },
                  width: { sm: 340 },
                  maxHeight: "calc(100% - 48px)",
                  display: "flex",
                  flexDirection: "column",
                  bgcolor: "rgba(13, 33, 55, 0.97)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(124,77,255,0.2)",
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", p: { xs: 1.5, sm: 2.5 }, pb: 1, flexShrink: 0 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{p.id}</Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setSelectedObject(null)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Scrollable content */}
                <Box sx={{ overflowY: "auto", flex: 1, px: { xs: 1.5, sm: 2.5 }, WebkitOverflowScrolling: "touch" }}>
                {p.imageUrl && (
                  <Box
                    component="img"
                    src={p.imageUrl}
                    alt={p.id}
                    sx={{ width: "100%", borderRadius: 1, mb: 1.5, border: "1px solid rgba(124,77,255,0.1)" }}
                  />
                )}
                </Box>

                {/* Footer */}
                <Box sx={{ p: { xs: 1.5, sm: 2.5 }, pt: 1, flexShrink: 0 }}>
                {p.comment && (
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{p.comment}</Typography>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                </Typography>
                </Box>
              </Paper>
            );
          }

          // ─── Standard object info panel ──────────────────────────
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
                bottom: { xs: 8, sm: 24 },
                left: { xs: 8, sm: 24 },
                right: { xs: 8, sm: "auto" },
                minWidth: { xs: 0, sm: 300 },
                maxWidth: { xs: "none", sm: 380 },
                maxHeight: "calc(100% - 48px)",
                display: "flex",
                flexDirection: "column",
                bgcolor: "rgba(13, 33, 55, 0.95)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(79,195,247,0.15)",
                borderRadius: 2,
                zIndex: 5,
              }}
            >
              {/* Header */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", p: { xs: 1.5, sm: 2.5 }, pb: 1, flexShrink: 0 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{label}</Typography>
                  <Typography variant="caption" color="text.secondary">{typeLabel}</Typography>
                </Box>
                <IconButton size="small" onClick={() => setSelectedObject(null)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>

              {/* Scrollable content */}
              <Box sx={{ overflowY: "auto", flex: 1, px: { xs: 1.5, sm: 2.5 }, WebkitOverflowScrolling: "touch" }}>
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
                  sx={{ width: "100%", borderRadius: 1, mb: 1.5, border: "1px solid rgba(79,195,247,0.1)" }}
                />
              )}
              </Box>

              {/* Footer - details */}
              <Box sx={{ p: { xs: 1.5, sm: 2.5 }, pt: 1, flexShrink: 0 }}>
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

                  {/* SMS button for managers when valid mobile and user allows it */}
                  {occupantPhone && isMobileNumber(occupantPhone) && (() => {
                    // Check if occupant has opted out of map SMS
                    const occupantId =
                      obj.kind === "berth" ? obj.data.occupantIds?.[0]
                      : obj.kind === "resource" ? (obj.data as Resource).occupantIds?.[0]
                      : (obj.data as LandStorageEntry).occupantId;
                    const smsAllowed = occupantId ? (userSmsPrefs.get(occupantId) ?? true) : true;
                    return smsAllowed ? (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<SmsIcon />}
                        href={toSmsHref(occupantPhone)}
                        sx={{ mt: 1.5 }}
                      >
                        Skicka SMS
                      </Button>
                    ) : null;
                  })()}
                </>
              )}

              {/* Interest button for available berths */}
              {obj.kind === "berth" && obj.data.status === "Available" && firebaseUser && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SailingIcon />}
                  href={`/interest?dockId=${obj.data.dockId}&berthId=${obj.data.id}`}
                  sx={{ mt: 1.5, textTransform: "none", bgcolor: "#1976D2", "&:hover": { bgcolor: "#1565C0" } }}
                >
                  Intresseanmälan
                </Button>
              )}
              </Box>
            </Paper>
          );
        })()}

        {/* Stats */}
        {!loading && (
          <Paper
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
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
              <>
                <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.4 }}>{"•"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {seaHuts.length} sjöbodar
                </Typography>
              </>
            )}
            {boxes.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.4 }}>{"•"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {boxes.length} lådor
                </Typography>
              </>
            )}
            {landEntries.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.4 }}>{"•"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {landWithCoords.length} / {landEntries.length} markplatser
                </Typography>
              </>
            )}
            {abandonedObjects.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.4 }}>{"•"}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                  <DangerousIcon sx={{ fontSize: 14 }} /> {abandonedObjects.length} övergivna
                </Typography>
              </>
            )}
          </Paper>
        )}
      </Box>
    </Box>

    {/* Success snackbar */}
    <Snackbar open={!!snackMsg} autoHideDuration={4000} onClose={() => setSnackMsg("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
      <Alert severity="success" onClose={() => setSnackMsg("")} sx={{ width: "100%" }}>{snackMsg}</Alert>
    </Snackbar>
    </ProtectedRoute>
  );
}
