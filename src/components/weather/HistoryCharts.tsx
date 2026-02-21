"use client";

import { useRef, useEffect, useCallback } from "react";
import type { HistoryPoint } from "@/hooks/useVivaHistory";

// ─── Shared helpers ───────────────────────────────────────
function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  return ctx;
}

/** Convert degrees to compass label */
function degreesToCompass(deg: number): string {
  const labels = ["N", "NNÖ", "NÖ", "ÖNÖ", "Ö", "ÖSÖ", "SÖ", "SSÖ", "S", "SSV", "SV", "VSV", "V", "VNV", "NV", "NNV"];
  return labels[Math.round(deg / 22.5) % 16];
}

/** Find the closest point in a series to a given time */
function closestPoint(series: HistoryPoint[], target: Date): HistoryPoint | null {
  if (!series.length) return null;
  let best = series[0];
  let bestDiff = Math.abs(series[0].time.getTime() - target.getTime());
  for (let i = 1; i < series.length; i++) {
    const diff = Math.abs(series[i].time.getTime() - target.getTime());
    if (diff < bestDiff) {
      best = series[i];
      bestDiff = diff;
    }
  }
  // Only use if within 15 minutes
  return bestDiff < 15 * 60 * 1000 ? best : null;
}

/** Downsample a dense series (1-min water level) to ~10 min intervals */
function downsample(points: HistoryPoint[], intervalMs: number): HistoryPoint[] {
  if (!points.length) return [];
  const result: HistoryPoint[] = [points[0]];
  let lastTime = points[0].time.getTime();
  for (let i = 1; i < points.length; i++) {
    if (points[i].time.getTime() - lastTime >= intervalMs) {
      result.push(points[i]);
      lastTime = points[i].time.getTime();
    }
  }
  return result;
}

// ─── Draw wind barb at a specific position ────────────────
function drawWindBarb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  speedMs: number,
  directionDeg: number,
  color: string,
  scale: number = 1
) {
  ctx.save();
  ctx.translate(x, y);
  // Rotate so barb points downward (wind comes FROM this direction)
  ctx.rotate((directionDeg * Math.PI) / 180);

  const staffLen = 18 * scale;
  const barbLen = 10 * scale;
  const shortBarbLen = 6 * scale;
  const barbSpacing = 4 * scale;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5 * scale;
  ctx.lineCap = "round";

  // Staff line pointing downward
  ctx.beginPath();
  ctx.moveTo(0, -staffLen / 2);
  ctx.lineTo(0, staffLen / 2);
  ctx.stroke();

  // Draw barbs from top
  let remaining = speedMs;
  let barbY = -staffLen / 2;

  // Pennants (25 m/s)
  while (remaining >= 25) {
    ctx.beginPath();
    ctx.moveTo(0, barbY);
    ctx.lineTo(barbLen, barbY + barbSpacing / 2);
    ctx.lineTo(0, barbY + barbSpacing);
    ctx.closePath();
    ctx.fill();
    barbY += barbSpacing;
    remaining -= 25;
  }

  // Long barbs (5 m/s)
  while (remaining >= 5) {
    ctx.beginPath();
    ctx.moveTo(0, barbY);
    ctx.lineTo(barbLen, barbY - 2 * scale);
    ctx.stroke();
    barbY += barbSpacing;
    remaining -= 5;
  }

  // Short barb (2.5 m/s)
  if (remaining >= 2.5) {
    ctx.beginPath();
    ctx.moveTo(0, barbY);
    ctx.lineTo(shortBarbLen, barbY - 1.5 * scale);
    ctx.stroke();
  }

  // Calm circle
  if (speedMs < 1) {
    ctx.beginPath();
    ctx.arc(0, 0, 3 * scale, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 * scale;
    ctx.stroke();
  }

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// WIND HISTORY CHART
// ═══════════════════════════════════════════════════════════

interface WindHistoryChartProps {
  avgWind: HistoryPoint[];
  gustWind: HistoryPoint[];
  direction: HistoryPoint[];
}

export function WindHistoryChart({ avgWind, gustWind, direction }: WindHistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    if (!avgWind.length && !gustWind.length) return;

    const W = Math.min(container.clientWidth, 860);
    const H = 280;
    const ctx = setupCanvas(canvas, W, H);

    const paddingLeft = 44;
    const paddingRight = 16;
    const paddingTop = 40; // Space for wind barbs at top
    const paddingBottom = 32;
    const chartW = W - paddingLeft - paddingRight;
    const chartH = H - paddingTop - paddingBottom;

    // Merge all series to find time range
    const allPoints = [...avgWind, ...gustWind];
    const minTime = Math.min(...allPoints.map((p) => p.time.getTime()));
    const maxTime = Math.max(...allPoints.map((p) => p.time.getTime()));
    const timeRange = maxTime - minTime || 1;

    // Find max speed for Y scale
    const allSpeeds = allPoints.map((p) => p.value);
    const maxSpeed = Math.max(...allSpeeds, 10);
    const yMax = Math.ceil(maxSpeed / 5) * 5; // Round up to nearest 5

    // Helper: map data to pixel
    const xOf = (t: number) => paddingLeft + ((t - minTime) / timeRange) * chartW;
    const yOf = (v: number) => paddingTop + chartH - (v / yMax) * chartH;

    // Background
    ctx.clearRect(0, 0, W, H);

    // Y-axis grid + labels
    ctx.save();
    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let v = 0; v <= yMax; v += 5) {
      const y = yOf(v);
      ctx.fillStyle = "rgba(226,232,240,0.3)";
      ctx.fillText(v + "", paddingLeft - 8, y);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(W - paddingRight, y);
      ctx.strokeStyle = v === 0 ? "rgba(226,232,240,0.15)" : "rgba(226,232,240,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // X-axis: time labels every ~2-3 hours
    ctx.save();
    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(226,232,240,0.3)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const hourMs = 60 * 60 * 1000;
    const startHour = new Date(minTime);
    startHour.setMinutes(0, 0, 0);
    for (let t = startHour.getTime(); t <= maxTime; t += 3 * hourMs) {
      if (t < minTime) continue;
      const x = xOf(t);
      const d = new Date(t);
      ctx.fillText(
        d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }),
        x,
        H - paddingBottom + 6
      );
      // Vertical grid line
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, H - paddingBottom);
      ctx.strokeStyle = "rgba(226,232,240,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // Gust area fill (amber, semi-transparent)
    if (gustWind.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xOf(gustWind[0].time.getTime()), yOf(0));
      for (const p of gustWind) {
        ctx.lineTo(xOf(p.time.getTime()), yOf(p.value));
      }
      ctx.lineTo(xOf(gustWind[gustWind.length - 1].time.getTime()), yOf(0));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, paddingTop, 0, H - paddingBottom);
      grad.addColorStop(0, "rgba(245,158,11,0.2)");
      grad.addColorStop(1, "rgba(245,158,11,0.02)");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    // Average wind area fill (blue)
    if (avgWind.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xOf(avgWind[0].time.getTime()), yOf(0));
      for (const p of avgWind) {
        ctx.lineTo(xOf(p.time.getTime()), yOf(p.value));
      }
      ctx.lineTo(xOf(avgWind[avgWind.length - 1].time.getTime()), yOf(0));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, paddingTop, 0, H - paddingBottom);
      grad.addColorStop(0, "rgba(59,130,246,0.25)");
      grad.addColorStop(1, "rgba(59,130,246,0.02)");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    // Gust line
    if (gustWind.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xOf(gustWind[0].time.getTime()), yOf(gustWind[0].value));
      for (let i = 1; i < gustWind.length; i++) {
        ctx.lineTo(xOf(gustWind[i].time.getTime()), yOf(gustWind[i].value));
      }
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Average wind line
    if (avgWind.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xOf(avgWind[0].time.getTime()), yOf(avgWind[0].value));
      for (let i = 1; i < avgWind.length; i++) {
        ctx.lineTo(xOf(avgWind[i].time.getTime()), yOf(avgWind[i].value));
      }
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Wind barbs along top — one per hour
    if (direction.length > 0 && avgWind.length > 0) {
      const firstHour = new Date(minTime);
      firstHour.setMinutes(0, 0, 0);
      if (firstHour.getTime() < minTime) firstHour.setTime(firstHour.getTime() + hourMs);

      for (let t = firstHour.getTime(); t <= maxTime; t += hourMs) {
        const x = xOf(t);
        const dirPoint = closestPoint(direction, new Date(t));
        const avgPoint = closestPoint(avgWind, new Date(t));
        if (dirPoint && avgPoint) {
          drawWindBarb(ctx, x, paddingTop - 18, avgPoint.value, dirPoint.value, "rgba(226,232,240,0.6)", 0.8);
        }
      }
    }

    // Legend
    ctx.save();
    ctx.font = "500 10px 'Inter', sans-serif";
    // Avg
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(paddingLeft, H - 12, 12, 3);
    ctx.fillText("Medelvind", paddingLeft + 16, H - 8);
    // Gust
    const gustLabelX = paddingLeft + 90;
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(gustLabelX, H - 12, 12, 3);
    ctx.fillText("Byvind", gustLabelX + 16, H - 8);
    ctx.restore();

    // Y-axis label
    ctx.save();
    ctx.font = "400 9px 'Inter', sans-serif";
    ctx.fillStyle = "rgba(226,232,240,0.3)";
    ctx.textAlign = "center";
    ctx.translate(12, paddingTop + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("m/s", 0, 0);
    ctx.restore();
  }, [avgWind, gustWind, direction]);

  useEffect(() => {
    render();
    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [render]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <canvas ref={canvasRef} style={{ maxWidth: "100%", height: "auto" }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// WATER LEVEL HISTORY CHART
// ═══════════════════════════════════════════════════════════

interface WaterLevelHistoryChartProps {
  waterLevel: HistoryPoint[];
  waterLevelRef?: string | null;
}

export function WaterLevelHistoryChart({ waterLevel, waterLevelRef }: WaterLevelHistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    if (!waterLevel.length) return;

    // Downsample 1-min data to ~5 min for smoother rendering
    const data = downsample(waterLevel, 5 * 60 * 1000);

    const W = Math.min(container.clientWidth, 860);
    const H = 220;
    const ctx = setupCanvas(canvas, W, H);

    const paddingLeft = 50;
    const paddingRight = 16;
    const paddingTop = 16;
    const paddingBottom = 32;
    const chartW = W - paddingLeft - paddingRight;
    const chartH = H - paddingTop - paddingBottom;

    const minTime = data[0].time.getTime();
    const maxTime = data[data.length - 1].time.getTime();
    const timeRange = maxTime - minTime || 1;

    const values = data.map((p) => p.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal), 20);
    const yMax = Math.ceil(absMax / 10) * 10;
    const yMin = -yMax;
    const yRange = yMax - yMin;

    const xOf = (t: number) => paddingLeft + ((t - minTime) / timeRange) * chartW;
    const yOf = (v: number) => paddingTop + chartH - ((v - yMin) / yRange) * chartH;

    ctx.clearRect(0, 0, W, H);

    // Y-axis grid
    ctx.save();
    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const yStep = yMax <= 30 ? 10 : yMax <= 60 ? 20 : 25;
    for (let v = yMin; v <= yMax; v += yStep) {
      const y = yOf(v);
      ctx.fillStyle = "rgba(226,232,240,0.3)";
      ctx.fillText(v + "", paddingLeft - 8, y);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(W - paddingRight, y);
      ctx.strokeStyle = v === 0 ? "rgba(226,232,240,0.2)" : "rgba(226,232,240,0.06)";
      ctx.lineWidth = v === 0 ? 1.5 : 1;
      ctx.stroke();
    }
    ctx.restore();

    // X-axis labels
    ctx.save();
    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(226,232,240,0.3)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const hourMs = 60 * 60 * 1000;
    const startHour = new Date(minTime);
    startHour.setMinutes(0, 0, 0);
    for (let t = startHour.getTime(); t <= maxTime; t += 3 * hourMs) {
      if (t < minTime) continue;
      const x = xOf(t);
      const d = new Date(t);
      ctx.fillText(
        d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }),
        x,
        H - paddingBottom + 6
      );
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, H - paddingBottom);
      ctx.strokeStyle = "rgba(226,232,240,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // Area fill
    if (data.length > 1) {
      ctx.save();
      const zeroY = yOf(0);
      ctx.beginPath();
      ctx.moveTo(xOf(data[0].time.getTime()), zeroY);
      for (const p of data) {
        ctx.lineTo(xOf(p.time.getTime()), yOf(p.value));
      }
      ctx.lineTo(xOf(data[data.length - 1].time.getTime()), zeroY);
      ctx.closePath();

      // Two gradients: teal above zero, darker below
      const grad = ctx.createLinearGradient(0, paddingTop, 0, H - paddingBottom);
      grad.addColorStop(0, "rgba(0,212,170,0.25)");
      grad.addColorStop(0.5, "rgba(0,212,170,0.08)");
      grad.addColorStop(1, "rgba(0,100,120,0.15)");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    // Line
    if (data.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xOf(data[0].time.getTime()), yOf(data[0].value));
      for (let i = 1; i < data.length; i++) {
        ctx.lineTo(xOf(data[i].time.getTime()), yOf(data[i].value));
      }
      ctx.strokeStyle = "#00d4aa";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Current value dot
    const last = data[data.length - 1];
    ctx.save();
    ctx.beginPath();
    ctx.arc(xOf(last.time.getTime()), yOf(last.value), 4, 0, Math.PI * 2);
    ctx.fillStyle = "#00d4aa";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,212,170,0.3)";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    // Legend / ref label
    ctx.save();
    ctx.font = "500 10px 'Inter', sans-serif";
    ctx.fillStyle = "#00d4aa";
    ctx.fillRect(paddingLeft, H - 12, 12, 3);
    ctx.fillText("Vattenstånd (cm)", paddingLeft + 16, H - 8);
    if (waterLevelRef) {
      ctx.fillStyle = "rgba(226,232,240,0.3)";
      ctx.textAlign = "right";
      ctx.fillText("ref: " + waterLevelRef, W - paddingRight, H - 8);
    }
    ctx.restore();

    // Y-axis label
    ctx.save();
    ctx.font = "400 9px 'Inter', sans-serif";
    ctx.fillStyle = "rgba(226,232,240,0.3)";
    ctx.textAlign = "center";
    ctx.translate(12, paddingTop + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("cm", 0, 0);
    ctx.restore();
  }, [waterLevel, waterLevelRef]);

  useEffect(() => {
    render();
    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [render]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <canvas ref={canvasRef} style={{ maxWidth: "100%", height: "auto" }} />
    </div>
  );
}
