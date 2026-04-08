"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { collection, getDocs, getDoc, doc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Dock, Berth } from "@/lib/types";
import { computeBoatHull, computeRectCorners, HARBOR_CENTER } from "@/lib/mapUtils";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AnchorIcon from "@mui/icons-material/Anchor";
import BalanceIcon from "@mui/icons-material/Balance";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import Link from "next/link";

import { APIProvider, Map as GMap, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default.Markdown),
  { ssr: false }
);

// Color logic — identical to /map page
function getBerthColor(berth: Berth): string {
  if (berth.status === "Available") return "#4CAF50"; // green
  if (berth.occupantIds && berth.occupantIds.length > 0) return "#F44336"; // red
  return "#FFC107"; // yellow — occupied but no registered tenant
}

// Suspense wrapper required for useSearchParams with static export
export default function DockDetailPage() {
  return (
    <Suspense fallback={<Box sx={{ display: "flex", justifyContent: "center", py: 12 }}><CircularProgress /></Box>}>
      <DockDetailContent />
    </Suspense>
  );
}

function DockDetailContent() {
  const searchParams = useSearchParams();
  const dockId = searchParams.get("id");

  const [dock, setDock] = useState<Dock | null>(null);
  const [berths, setBerths] = useState<Berth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dockId) { setLoading(false); return; }
    async function fetchData() {
      try {
        const dockSnap = await getDoc(doc(db, "docks", dockId!));
        if (!dockSnap.exists()) { setLoading(false); return; }
        const dockData = { id: dockSnap.id, ...dockSnap.data() } as Dock;
        setDock(dockData);

        const berthQ = query(
          collection(db, "resources"),
          where("dockId", "==", dockId),
          where("type", "==", "Berth")
        );
        const berthSnap = await getDocs(berthQ);
        setBerths(
          berthSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Berth)
            .sort((a, b) => a.markingCode.localeCompare(b.markingCode, "sv-SE", { numeric: true }))
        );
      } catch (err) {
        console.error("Error fetching dock:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dockId]);

  const mapCenter = dock?.lat && dock?.lng
    ? { lat: dock.lat, lng: dock.lng }
    : berths.length > 0 && berths[0].lat && berths[0].lng
      ? { lat: berths[0].lat, lng: berths[0].lng }
      : HARBOR_CENTER;

  const totalBerths = berths.length;
  const availableBerths = berths.filter((b) => b.status === "Available").length;
  const occupiedBerths = berths.filter((b) => b.status === "Occupied").length;

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!dock) {
    return (
      <Box sx={{ maxWidth: 800, mx: "auto", px: 3, py: 8, textAlign: "center" }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Bryggan hittades inte
        </Typography>
        <Button component={Link} href="/docks" startIcon={<ArrowBackIcon />}>
          Tillbaka till bryggor
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", px: 3, py: 5 }}>
      <Button
        component={Link}
        href="/docks"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3, textTransform: "none" }}
      >
        Tillbaka till bryggor
      </Button>

      {/* Dock header */}
      <Card
        sx={{
          mb: 4,
          bgcolor: "rgba(13, 33, 55, 0.6)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(79,195,247,0.08)",
          overflow: "hidden",
        }}
      >
        {dock.imageUrl && (
          <Box
            component="img"
            src={dock.imageUrl}
            alt={dock.name}
            sx={{ width: "100%", height: { xs: 200, md: 300 }, objectFit: "cover" }}
          />
        )}
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <AnchorIcon sx={{ color: "primary.main", fontSize: 32 }} />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{dock.name}</Typography>
          </Box>
          {dock.associationName && (
            <Chip label={dock.associationName} size="small" color="success" sx={{ mb: 2 }} />
          )}
          {totalBerths > 0 && (
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 1 }}>
              <Chip icon={<DirectionsBoatIcon />} label={`${totalBerths} platser`} variant="outlined" color="primary" />
              <Chip label={`${occupiedBerths} belagda`} variant="outlined" color="warning" />
              {availableBerths > 0 && <Chip label={`${availableBerths} lediga`} color="success" />}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Map with berth polygons + dock rectangle */}
      {totalBerths > 0 && (
        <Card sx={{ mb: 4, overflow: "hidden", border: "1px solid rgba(79,195,247,0.08)" }}>
          {/* Legend — same as /map */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", px: 2, py: 1.5, bgcolor: "rgba(13, 33, 55, 0.95)", borderBottom: "1px solid rgba(79,195,247,0.1)" }}>
            <Chip size="small" sx={{ bgcolor: "#4CAF50", color: "#fff", fontWeight: 600 }} label="Ledig" />
            <Chip size="small" sx={{ bgcolor: "#F44336", color: "#fff", fontWeight: 600 }} label="Upptagen" />
            <Chip size="small" sx={{ bgcolor: "#FFC107", color: "#000", fontWeight: 600 }} label="Upptagen, ej reg. användare" />
          </Box>
          <Box sx={{ height: { xs: 300, md: 450 } }}>
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}>
              <GMap
                defaultCenter={mapCenter}
                defaultZoom={dock?.lat ? 19 : 17}
                mapId="dock-detail-map"
                mapTypeId="satellite"
                style={{ width: "100%", height: "100%" }}
                gestureHandling="cooperative"
                disableDefaultUI
                zoomControl
              >
                <DockBerthPolygons dock={dock} berths={berths} />
              </GMap>
            </APIProvider>
          </Box>
        </Card>
      )}

      {/* Dock Rules */}
      {dock.dockRules && (
        <Card
          sx={{
            bgcolor: "rgba(13, 33, 55, 0.6)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(79,195,247,0.08)",
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <BalanceIcon sx={{ color: "primary.main" }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>Bryggregler</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Box
              sx={{
                lineHeight: 1.8,
                "& p": { color: "text.secondary", my: 0.5 },
                "& a": { color: "primary.main" },
                "& strong": { color: "text.primary" },
                "& ul, & ol": { color: "text.secondary", pl: 2 },
                "& li": { mb: 0.3 },
                "& h1, & h2, & h3": { color: "text.primary", mt: 2, mb: 1 },
              }}
            >
              <MDPreview source={dock.dockRules} style={{ background: "transparent", color: "inherit" }} />
            </Box>
          </CardContent>
        </Card>
      )}

      {!dock.dockRules && totalBerths === 0 && (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography color="text.secondary">
            Inga bryggregler eller platser upplagda för denna brygga ännu.
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── Berth Polygons + Dock Rectangle — same rendering as /map ───
function DockBerthPolygons({ dock, berths }: { dock: Dock; berths: Berth[] }) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map || !markerLib) return;

    const cleanups: (() => void)[] = [];

    // Draw berth polygons using computeBoatHull (same as /map BerthPolygons)
    berths.forEach((berth) => {
      if (!berth.lat || !berth.lng) return;

      const w = berth.maxWidth || 3;
      const l = berth.maxLength || 10;
      const h = berth.heading || 0;

      const corners = computeBoatHull(berth.lat, berth.lng, w, l, h);
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

    // Draw dock rectangle using computeRectCorners (same as /map DockPolygons)
    if (dock.lat && dock.lng && dock.maxWidth && dock.maxLength) {
      const w = dock.maxWidth;
      const l = dock.maxLength;
      const h = dock.heading || 0;

      const corners = computeRectCorners(dock.lat, dock.lng, w, l, h);

      const dockPolygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: "#42A5F5",
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: "#1E88E5",
        fillOpacity: 0.15,
        map,
        zIndex: 0,
      });

      // Rotated dock name label
      const frontMid = { lat: (corners[0].lat + corners[1].lat) / 2, lng: (corners[0].lng + corners[1].lng) / 2 };
      const backMid = { lat: (corners[2].lat + corners[3].lat) / 2, lng: (corners[2].lng + corners[3].lng) / 2 };
      const cosLat = Math.cos((dock.lat * Math.PI) / 180);
      const screenDx = (backMid.lng - frontMid.lng) * cosLat;
      const screenDy = -(backMid.lat - frontMid.lat);
      let visualAngleDeg = Math.atan2(screenDy, screenDx) * (180 / Math.PI);
      if (visualAngleDeg > 90) visualAngleDeg -= 180;
      else if (visualAngleDeg < -90) visualAngleDeg += 180;

      const dockLabelEl = document.createElement("div");
      dockLabelEl.textContent = dock.name;
      dockLabelEl.style.cssText = `
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
      const dockLabel = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: dock.lat, lng: dock.lng },
        map,
        content: dockLabelEl,
        zIndex: 3,
      });

      cleanups.push(() => {
        dockPolygon.setMap(null);
        dockLabel.map = null;
      });
    }

    return () => { cleanups.forEach((fn) => fn()); };
  }, [map, markerLib, dock, berths]);

  return null;
}
