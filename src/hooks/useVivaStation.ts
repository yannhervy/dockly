"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types for VIVA API response ─────────────────────────
export interface VivaSample {
  Name: string;
  Value: string;
  Heading: number;
  Unit: string;
  Type: string; // "level" | "wind" | "heading" | "watertemp"
  Trend: string;
  Msg: string;
  Calm: number;
  Updated: string; // "2026-02-21 07:42:00"
  StationID: number;
  Quality: string;
  WaterLevelReference: string | null;
  WaterLevelOffset: number | null;
}

export interface VivaStationData {
  ID: number;
  Name: string;
  Samples: VivaSample[];
  Felmeddelande: string | null;
}

export interface VivaApiResponse {
  GetSingleStationWithDirectionsAsParametersResult: VivaStationData;
}

// ─── Helpers ─────────────────────────────────────────────
export function getSampleByType(
  data: VivaStationData | null,
  type: string
): VivaSample | undefined {
  return data?.Samples.find((s) => s.Type === type);
}

export function getSampleByName(
  data: VivaStationData | null,
  name: string
): VivaSample | undefined {
  return data?.Samples.find((s) => s.Name === name);
}

export interface ParsedWind {
  direction: string;
  speed: number;
}

export function parseWindValue(val: string): ParsedWind {
  const parts = val.trim().split(/\s+/);
  if (parts.length === 2) {
    return { direction: parts[0], speed: parseFloat(parts[1]) };
  }
  return { direction: "", speed: parseFloat(val) || 0 };
}

export function formatVivaTime(updated: string): string {
  const parts = updated.split(" ");
  if (parts.length === 2) {
    return parts[1].substring(0, 5);
  }
  return updated;
}

// ─── Hook ────────────────────────────────────────────────
const VIVA_URL =
  "https://services.viva.sjofartsverket.se/output/vivaoutputservice.svc/ViVaStationWithDirection";

export function useVivaStation(stationId: number = 100) {
  const [data, setData] = useState<VivaStationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${VIVA_URL}/${stationId}?isMVY=false`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: VivaApiResponse = await res.json();
      setData(json.GetSingleStationWithDirectionsAsParametersResult);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, lastFetched, refetch: fetchData };
}
