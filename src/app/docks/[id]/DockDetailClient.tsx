"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { collection, getDocs, getDoc, doc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Dock, Berth } from "@/lib/types";

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
import RuleIcon from "@mui/icons-material/Rule";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import Link from "next/link";

import { APIProvider, Map as GMap, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default.Markdown),
  { ssr: false }
);

// Harbor center fallback
const HARBOR_CENTER = { lat: 58.3565, lng: 16.462 };

export default function DockDetailClient() {
  const params = useParams();
  const dockId = params.id as string;

  const [dock, setDock] = useState<Dock | null>(null);
  const [berths, setBerths] = useState<Berth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dockId) return;
    async function fetchData() {
      try {
        const dockSnap = await getDoc(doc(db, "docks", dockId));
        if (!dockSnap.exists()) {
          setLoading(false);
          return;
        }
        const dockData = { id: dockSnap.id, ...dockSnap.data() } as Dock;
        setDock(dockData);

        const berthQ = query(
          collection(db, "resources"),
          where("dockId", "==", dockId),
          where("type", "==", "Berth")
        );
        const berthSnap = await getDocs(berthQ);
        const berthItems = berthSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Berth)
          .sort((a, b) =>
            a.markingCode.localeCompare(b.markingCode, "sv-SE", { numeric: true })
          );
        setBerths(berthItems);
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
            sx={{
              width: "100%",
              height: { xs: 200, md: 300 },
              objectFit: "cover",
            }}
          />
        )}
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <AnchorIcon sx={{ color: "primary.main", fontSize: 32 }} />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {dock.name}
            </Typography>
          </Box>
          {dock.associationName && (
            <Chip label={dock.associationName} size="small" color="success" sx={{ mb: 2 }} />
          )}
          {totalBerths > 0 && (
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 1 }}>
              <Chip
                icon={<DirectionsBoatIcon />}
                label={`${totalBerths} platser`}
                variant="outlined"
                color="primary"
              />
              <Chip
                label={`${occupiedBerths} belagda`}
                variant="outlined"
                color="warning"
              />
              {availableBerths > 0 && (
                <Chip label={`${availableBerths} lediga`} color="success" />
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Map with berth markers */}
      {totalBerths > 0 && (
        <Card
          sx={{
            mb: 4,
            overflow: "hidden",
            border: "1px solid rgba(79,195,247,0.08)",
          }}
        >
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
                <DockBerthMarkers dock={dock} berths={berths} />
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
              <RuleIcon sx={{ color: "primary.main" }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Bryggregler
              </Typography>
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

// ─── Berth Markers Sub-Component ──────────────────────────────
function DockBerthMarkers({ dock, berths }: { dock: Dock; berths: Berth[] }) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map || !coreLib || !markerLib) return;

    const markers: google.maps.marker.AdvancedMarkerElement[] = [];

    for (const berth of berths) {
      if (!berth.lat || !berth.lng) continue;
      const isAvailable = berth.status === "Available";
      const el = document.createElement("div");
      el.innerHTML = `<span>${berth.markingCode}</span>`;
      el.style.cssText = `
        background: ${isAvailable ? "rgba(102, 187, 106, 0.9)" : "rgba(255, 183, 77, 0.9)"};
        color: #000;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
        border: 1px solid rgba(0,0,0,0.2);
      `;

      const marker = new markerLib.AdvancedMarkerElement({
        map,
        position: { lat: berth.lat, lng: berth.lng },
        content: el,
        title: `${berth.markingCode} — ${isAvailable ? "Ledig" : "Belagd"}`,
      });
      markers.push(marker);
    }

    let rect: google.maps.Rectangle | null = null;
    if (dock.lat && dock.lng && dock.maxWidth && dock.maxLength) {
      const { computeOffset } = coreLib as unknown as {
        computeOffset: (
          from: google.maps.LatLng,
          dist: number,
          heading: number
        ) => google.maps.LatLng;
      };
      if (typeof computeOffset === "function") {
        const center = new coreLib.LatLng(dock.lat, dock.lng);
        const heading = dock.heading || 0;
        const halfL = dock.maxLength / 2;
        const halfW = dock.maxWidth / 2;
        const p1 = computeOffset(computeOffset(center, halfL, heading), halfW, heading + 90);
        const p2 = computeOffset(computeOffset(center, halfL, heading), halfW, heading - 90);
        const p3 = computeOffset(computeOffset(center, halfL, heading + 180), halfW, heading - 90);
        const p4 = computeOffset(computeOffset(center, halfL, heading + 180), halfW, heading + 90);
        const bounds = new coreLib.LatLngBounds();
        [p1, p2, p3, p4].forEach((p) => bounds.extend(p));
        rect = new google.maps.Rectangle({
          map,
          bounds,
          strokeColor: "#4FC3F7",
          strokeWeight: 2,
          fillColor: "#4FC3F7",
          fillOpacity: 0.1,
        });
      }
    }

    return () => {
      markers.forEach((m) => (m.map = null));
      rect?.setMap(null);
    };
  }, [map, coreLib, markerLib, dock, berths]);

  return null;
}
