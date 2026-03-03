"use client";

import { useEffect, useRef } from "react";
import { Berth } from "@/lib/types";
import { computeBoatHull } from "@/lib/mapUtils";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

// ─── Props ──────────────────────────────────────────────────

interface EditBerthPolygonProps {
  /** Current berth lat/lng */
  lat?: number;
  lng?: number;
  /** Dimensions for current berth polygon */
  width: number;
  length: number;
  heading: number;
  /** Label shown on the map marker */
  label: string;
  /** Resource type — SeaHut/Box renders as circle, Berth renders as boat hull */
  resourceType?: string;
  /** Called when the CURRENT berth polygon is dragged to a new position */
  onMove?: (lat: number, lng: number) => void;
  /** Called when an OTHER berth polygon is dragged to a new position */
  onMoveOther?: (id: string, lat: number, lng: number) => void;
  /** All berths on the same dock (used to draw context overlays) */
  allBerths: Berth[];
  /** ID of the current berth being edited (excluded from "other" berths) */
  currentId: string;
}

// ─── Label Helper ───────────────────────────────────────────

function createLabelElement(text: string, isCurrent: boolean): HTMLElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = `
    font-size: 11px;
    font-weight: 700;
    color: ${isCurrent ? "#00E5FF" : "#CFD8DC"};
    background: ${isCurrent ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)"};
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid ${isCurrent ? "#00E5FF" : "transparent"};
    white-space: nowrap;
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  `;
  return el;
}

// ─── Component ──────────────────────────────────────────────

/**
 * Renders berth polygons on a Google Map:
 * - Current berth as a bright cyan boat-hull polygon (draggable)
 * - All other berths as grey boat-hull polygons (also draggable for repositioning)
 *
 * Uses refs for callbacks to prevent unnecessary re-renders when dragging.
 * Tracks drag delta from original center for maximum GPS precision.
 *
 * Must be rendered as a child of a <Map> from @vis.gl/react-google-maps.
 */
export default function EditBerthPolygon({
  lat,
  lng,
  width,
  length,
  heading,
  label,
  resourceType,
  onMove,
  onMoveOther,
  allBerths,
  currentId,
}: EditBerthPolygonProps) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const markerLib = useMapsLibrary("marker");

  // Store callbacks in refs so the effect doesn't re-run when they change
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onMoveOtherRef = useRef(onMoveOther);
  onMoveOtherRef.current = onMoveOther;

  // Store allBerths in ref so dragging other berths doesn't trigger a full redraw
  const allBerthsRef = useRef(allBerths);
  allBerthsRef.current = allBerths;

  useEffect(() => {
    if (!map || !coreLib || !markerLib) return;

    const cleanups: (() => void)[] = [];

    // Helper: compute polygon centroid (for drag delta calculation)
    const getPolygonCentroid = (polygon: google.maps.Polygon) => {
      const path = polygon.getPath();
      let sumLat = 0,
        sumLng = 0;
      const len = path.getLength();
      for (let i = 0; i < len; i++) {
        const pt = path.getAt(i);
        sumLat += pt.lat();
        sumLng += pt.lng();
      }
      return { lat: sumLat / len, lng: sumLng / len };
    };

    // Draw all OTHER berths (draggable, grey styling)
    const berths = allBerthsRef.current;
    berths.forEach((b) => {
      if (!b.lat || !b.lng || b.id === currentId) return;

      const bw = b.maxWidth || 2;
      const bl = b.maxLength || 5;
      const bh = b.heading || 0;
      // Remember original center for delta-based dragging
      const originalCenter = { lat: b.lat, lng: b.lng };
      const corners = computeBoatHull(originalCenter.lat, originalCenter.lng, bw, bl, bh);

      const polygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: "#90A4AE",
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: "#78909C",
        fillOpacity: 0.3,
        map,
        zIndex: 1,
        draggable: true,
        geodesic: false,
      });

      // Compute the centroid of the drawn polygon before any drag
      const drawnCentroid = getPolygonCentroid(polygon);

      // Label for other berth
      const labelMarker = new google.maps.marker.AdvancedMarkerElement({
        position: originalCenter,
        map,
        content: createLabelElement(b.markingCode, false),
        zIndex: 2,
      });

      polygon.addListener("dragend", () => {
        // Use delta: how far the polygon centroid moved from its original drawn position
        const newCentroid = getPolygonCentroid(polygon);
        const deltaLat = newCentroid.lat - drawnCentroid.lat;
        const deltaLng = newCentroid.lng - drawnCentroid.lng;
        const newLat = originalCenter.lat + deltaLat;
        const newLng = originalCenter.lng + deltaLng;

        if (onMoveOtherRef.current) {
          onMoveOtherRef.current(b.id, newLat, newLng);
        }
        // Update the label position
        labelMarker.position = { lat: newLat, lng: newLng };
      });

      cleanups.push(() => {
        polygon.setMap(null);
        labelMarker.map = null;
      });
    });

    // Draw CURRENT resource (draggable, cyan)
    if (lat && lng) {
      const isNonBerth = resourceType === "SeaHut" || resourceType === "Box";
      const originalCenter = { lat, lng };

      if (isNonBerth) {
        // Draw a circle marker for SeaHuts and Boxes
        const circle = new google.maps.Circle({
          center: originalCenter,
          radius: 2,
          strokeColor: resourceType === "SeaHut" ? "#FF9800" : "#8BC34A",
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: resourceType === "SeaHut" ? "#FF9800" : "#8BC34A",
          fillOpacity: 0.4,
          map,
          zIndex: 10,
          draggable: true,
        });

        const labelMarker = new google.maps.marker.AdvancedMarkerElement({
          position: originalCenter,
          map,
          content: createLabelElement(label, true),
          zIndex: 11,
        });

        circle.addListener("dragend", () => {
          const center = circle.getCenter();
          if (center && onMoveRef.current) {
            onMoveRef.current(center.lat(), center.lng());
          }
          labelMarker.position = center;
        });

        cleanups.push(() => {
          circle.setMap(null);
          labelMarker.map = null;
        });
      } else {
        // Draw a boat-hull polygon for Berths
        const corners = computeBoatHull(lat, lng, width, length, heading);
        const polygon = new google.maps.Polygon({
          paths: corners,
          strokeColor: "#00E5FF",
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: "#00E5FF",
          fillOpacity: 0.35,
          map,
          zIndex: 10,
          draggable: true,
          geodesic: false,
        });

        // Compute initial centroid for delta tracking
        const drawnCentroid = getPolygonCentroid(polygon);

        const labelMarker = new google.maps.marker.AdvancedMarkerElement({
          position: originalCenter,
          map,
          content: createLabelElement(label, true),
          zIndex: 11,
        });

        polygon.addListener("dragend", () => {
          // Delta-based: calculate how far the centroid moved and apply to original center
          const newCentroid = getPolygonCentroid(polygon);
          const deltaLat = newCentroid.lat - drawnCentroid.lat;
          const deltaLng = newCentroid.lng - drawnCentroid.lng;
          const newLat = originalCenter.lat + deltaLat;
          const newLng = originalCenter.lng + deltaLng;

          if (onMoveRef.current) {
            onMoveRef.current(newLat, newLng);
          }
          labelMarker.position = { lat: newLat, lng: newLng };
        });

        cleanups.push(() => {
          polygon.setMap(null);
          labelMarker.map = null;
        });
      }
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
    // Only re-run when the map is ready or the CURRENT berth geometry changes.
    // Callbacks are accessed via refs, allBerths via ref — no re-run on drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, coreLib, markerLib, lat, lng, width, length, heading, label, currentId, resourceType]);

  return null;
}
