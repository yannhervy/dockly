"use client";

import { useEffect, useRef } from "react";
import { Berth } from "@/lib/types";
import { computeBoatHull } from "@/lib/mapUtils";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

// ─── Props ──────────────────────────────────────────────────

interface EditBerthPolygonProps {
  lat?: number;
  lng?: number;
  width: number;
  length: number;
  heading: number;
  label: string;
  resourceType?: string;
  onMove?: (lat: number, lng: number) => void;
  onMoveOther?: (id: string, lat: number, lng: number) => void;
  /** Called when any polygon drag starts (suppress map onClick) */
  onDragStart?: () => void;
  allBerths: Berth[];
  currentId: string;
  /** Already-moved berths (so their positions persist across effect re-runs) */
  movedBerths?: Record<string, { lat: number; lng: number }>;
}

// ─── Helpers ────────────────────────────────────────────────

function createLabelElement(text: string, isCurrent: boolean): HTMLElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = `
    font-size: 11px; font-weight: 700;
    color: ${isCurrent ? "#00E5FF" : "#CFD8DC"};
    background: ${isCurrent ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)"};
    padding: 1px 4px; border-radius: 3px;
    border: 1px solid ${isCurrent ? "#00E5FF" : "transparent"};
    white-space: nowrap; pointer-events: none;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  `;
  return el;
}

// ─── Component ──────────────────────────────────────────────

/**
 * Identical logic to the inline EditBerthPolygon in AdminSections.tsx.
 * Single useEffect creates all polygons; re-runs when geometry changes.
 * Added: onDragStart callback + continuous drag updates.
 */
export default function EditBerthPolygon({
  lat, lng, width, length, heading, label, resourceType,
  onMove, onMoveOther, onDragStart, allBerths, currentId, movedBerths,
}: EditBerthPolygonProps) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const markerLib = useMapsLibrary("marker");

  // Stable refs for callbacks only (not geometry — geometry stays in deps)
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onMoveOtherRef = useRef(onMoveOther);
  onMoveOtherRef.current = onMoveOther;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;

  // allBerths and movedBerths in refs to prevent effect re-runs
  const allBerthsRef = useRef(allBerths);
  allBerthsRef.current = allBerths;
  const movedBerthsRef = useRef(movedBerths || {});
  movedBerthsRef.current = movedBerths || {};

  useEffect(() => {
    if (!map || !coreLib || !markerLib) return;

    const cleanups: (() => void)[] = [];

    // Helper: compute center from polygon path
    const getCenterFromPath = (polygon: google.maps.Polygon) => {
      const path = polygon.getPath();
      let sumLat = 0, sumLng = 0;
      const len = path.getLength();
      for (let i = 0; i < len; i++) {
        const pt = path.getAt(i);
        sumLat += pt.lat();
        sumLng += pt.lng();
      }
      return { lat: sumLat / len, lng: sumLng / len };
    };

    // ── Draw all OTHER berths (draggable, grey) ──
    allBerthsRef.current.forEach((b) => {
      if (!b.lat || !b.lng || b.id === currentId) return;

      // Use previously-dragged position if available, otherwise original
      const moved = movedBerthsRef.current[b.id];
      const bLat = moved ? moved.lat : b.lat;
      const bLng = moved ? moved.lng : b.lng;
      const bw = b.maxWidth || 2;
      const bl = b.maxLength || 5;
      const bh = b.heading || 0;
      const corners = computeBoatHull(bLat, bLng, bw, bl, bh);

      const polygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: "#90A4AE", strokeOpacity: 0.8, strokeWeight: 1,
        fillColor: "#78909C", fillOpacity: 0.3,
        map, zIndex: 1, draggable: true, geodesic: false,
      });

      const labelMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: bLat, lng: bLng },
        map, content: createLabelElement(b.markingCode, false), zIndex: 2,
      });

      // Delta-based drag: track centroid offset for precision
      const initCentroid = getCenterFromPath(polygon);

      polygon.addListener("dragstart", () => onDragStartRef.current?.());
      polygon.addListener("dragend", () => {
        if (!onMoveOtherRef.current) return;
        const newCentroid = getCenterFromPath(polygon);
        const newLat = bLat + (newCentroid.lat - initCentroid.lat);
        const newLng = bLng + (newCentroid.lng - initCentroid.lng);
        onMoveOtherRef.current(b.id, newLat, newLng);
        labelMarker.position = { lat: newLat, lng: newLng };
      });

      cleanups.push(() => { polygon.setMap(null); labelMarker.map = null; });
    });

    // ── Draw CURRENT resource (draggable, cyan) ──
    if (lat && lng) {
      const isNonBerth = resourceType === "SeaHut" || resourceType === "Box";

      if (isNonBerth) {
        const circle = new google.maps.Circle({
          center: { lat, lng }, radius: 2,
          strokeColor: resourceType === "SeaHut" ? "#FF9800" : "#8BC34A",
          strokeOpacity: 1, strokeWeight: 2,
          fillColor: resourceType === "SeaHut" ? "#FF9800" : "#8BC34A",
          fillOpacity: 0.4, map, zIndex: 10, draggable: true,
        });

        const labelMarker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat, lng }, map,
          content: createLabelElement(label, true), zIndex: 11,
        });

        circle.addListener("dragstart", () => onDragStartRef.current?.());
        circle.addListener("dragend", () => {
          if (!onMoveRef.current) return;
          const center = circle.getCenter();
          if (center) onMoveRef.current(center.lat(), center.lng());
          labelMarker.position = center;
        });

        cleanups.push(() => { circle.setMap(null); labelMarker.map = null; });
      } else {
        const corners = computeBoatHull(lat, lng, width, length, heading);
        const polygon = new google.maps.Polygon({
          paths: corners,
          strokeColor: "#00E5FF", strokeOpacity: 1, strokeWeight: 2,
          fillColor: "#00E5FF", fillOpacity: 0.35,
          map, zIndex: 10, draggable: true, geodesic: false,
        });

        const labelMarker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat, lng }, map,
          content: createLabelElement(label, true), zIndex: 11,
        });

        // Compute initial centroid — the centroid differs from the center
        // point for asymmetric hull shapes, so we track the delta.
        const initCentroid = getCenterFromPath(polygon);

        polygon.addListener("dragstart", () => onDragStartRef.current?.());
        polygon.addListener("dragend", () => {
          if (!onMoveRef.current) return;
          // Delta: how far the centroid moved = how far ALL points moved
          const newCentroid = getCenterFromPath(polygon);
          const newLat = lat + (newCentroid.lat - initCentroid.lat);
          const newLng = lng + (newCentroid.lng - initCentroid.lng);
          onMoveRef.current(newLat, newLng);
          labelMarker.position = { lat: newLat, lng: newLng };
        });

        cleanups.push(() => { polygon.setMap(null); labelMarker.map = null; });
      }
    }

    return () => { cleanups.forEach((fn) => fn()); };
  }, [map, coreLib, markerLib, lat, lng, width, length, heading, label, currentId, resourceType]);

  return null;
}
