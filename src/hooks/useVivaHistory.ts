"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────
export interface HistoryPoint {
  value: number;
  time: Date;
}

interface VivaHistoryResponse {
  GetHistoryResult: {
    StationHistory: { Value: string; Time: string }[];
    Felmeddelande: string | null;
    WaterLevelRef: string | null;
  };
}

export interface VivaHistoryData {
  avgWind: HistoryPoint[];
  gustWind: HistoryPoint[];
  direction: HistoryPoint[];
  waterLevel: HistoryPoint[];
  waterLevelRef: string | null;
}

// ─── Fetch single series ──────────────────────────────────
async function fetchSeries(
  seriesName: string,
  stationId: number
): Promise<{ points: HistoryPoint[]; ref: string | null }> {
  const encoded = encodeURIComponent(seriesName);
  const url = `https://services.viva.sjofartsverket.se/output/vivaoutputservice.svc/ViVaStationHistory/${encoded}/${stationId}?isMVY=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${seriesName}: ${res.status}`);
  const data: VivaHistoryResponse = await res.json();
  if (data.GetHistoryResult.Felmeddelande) {
    throw new Error(data.GetHistoryResult.Felmeddelande);
  }
  const points = data.GetHistoryResult.StationHistory.map((s) => ({
    value: parseFloat(s.Value),
    time: new Date(s.Time.replace(" ", "T")),
  }));
  return { points, ref: data.GetHistoryResult.WaterLevelRef };
}

// ─── Hook ─────────────────────────────────────────────────
export function useVivaHistory(stationId: number = 114) {
  const [data, setData] = useState<VivaHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [avg, gust, dir, level] = await Promise.all([
        fetchSeries("Medelvind", stationId),
        fetchSeries("Byvind", stationId),
        fetchSeries("Vindriktning", stationId),
        fetchSeries("Vattenstånd", stationId),
      ]);
      setData({
        avgWind: avg.points,
        gustWind: gust.points,
        direction: dir.points,
        waterLevel: level.points,
        waterLevelRef: level.ref,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10 * 60 * 1000); // Refresh every 10 min
    return () => clearInterval(interval);
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}
