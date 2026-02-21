"use client";

import { useRef, useEffect, useCallback } from "react";
import type { VivaStationData } from "@/hooks/useVivaStation";
import { getSampleByType, getSampleByName, parseWindValue } from "@/hooks/useVivaStation";

// ─── Shared canvas utilities ─────────────────────────────
function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  // Let the parent container handle CSS sizing for responsiveness
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  return ctx;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ═══════════════════════════════════════════════════════════
// 1. WATER LEVEL WIDGET — animated wave fill
// ═══════════════════════════════════════════════════════════

export function WaterLevelWidget({ data }: { data: VivaStationData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sample = getSampleByType(data, "level");
    if (!sample) return;
    const waterLevelRef = sample.WaterLevelReference || "";

    const W = 340;
    const H = 180;
    const ctx = setupCanvas(canvas, W, H);
    const level = parseFloat(sample.Value);

    const absLevel = Math.abs(level);
    let scaleMax: number;
    if (absLevel <= 60) scaleMax = 60;
    else if (absLevel <= 100) scaleMax = 100;
    else if (absLevel <= 150) scaleMax = 150;
    else scaleMax = Math.ceil(absLevel / 50) * 50;
    const minLevel = -scaleMax;
    const maxLevel = scaleMax;

    const scaleStep = scaleMax <= 60 ? 20 : scaleMax <= 100 ? 25 : 50;
    const scaleValues: number[] = [];
    for (let v = minLevel; v <= maxLevel; v += scaleStep) {
      scaleValues.push(v);
    }

    const normalized = Math.max(
      0,
      Math.min(1, (level - minLevel) / (maxLevel - minLevel))
    );
    const targetFillH = 20 + normalized * (H - 50);

    let startTime: number | null = null;
    const animDuration = 1400;

    function draw(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const animProgress = Math.min(1, elapsed / animDuration);
      const easedProgress = easeOutCubic(animProgress);

      ctx.clearRect(0, 0, W, H);
      const currentFillH = easedProgress * targetFillH;
      const waterY = H - currentFillH;

      // Scale marks
      ctx.save();
      ctx.strokeStyle = "rgba(226,232,240,0.12)";
      ctx.lineWidth = 1;
      ctx.font = "500 10px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(226,232,240,0.3)";
      ctx.textAlign = "right";
      for (const v of scaleValues) {
        const norm = (v - minLevel) / (maxLevel - minLevel);
        const y = H - (20 + norm * (H - 50));
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(W - 16, y);
        ctx.stroke();
        ctx.fillText(v + "", 36, y + 4);
      }
      ctx.restore();

      // Water body
      const waterGrad = ctx.createLinearGradient(0, waterY, 0, H);
      waterGrad.addColorStop(0, "rgba(0,212,170,0.35)");
      waterGrad.addColorStop(0.5, "rgba(0,180,160,0.25)");
      waterGrad.addColorStop(1, "rgba(0,100,120,0.15)");
      ctx.fillStyle = waterGrad;
      ctx.fillRect(44, waterY, W - 60, H - waterY);

      // Animated wave
      if (currentFillH > 5) {
        const t = timestamp / 1000;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(44, waterY);
        for (let x = 44; x <= W - 16; x++) {
          const relX = (x - 44) / (W - 60);
          const wave =
            Math.sin(relX * Math.PI * 4 + t * 2.5) * 3 +
            Math.sin(relX * Math.PI * 6 - t * 1.8) * 1.5;
          ctx.lineTo(x, waterY + wave);
        }
        ctx.lineTo(W - 16, H);
        ctx.lineTo(44, H);
        ctx.closePath();
        const waveGrad = ctx.createLinearGradient(0, waterY - 6, 0, waterY + 20);
        waveGrad.addColorStop(0, "rgba(0,212,170,0.5)");
        waveGrad.addColorStop(1, "rgba(0,212,170,0.0)");
        ctx.fillStyle = waveGrad;
        ctx.fill();
        ctx.restore();
      }

      // Level indicator line
      ctx.save();
      ctx.strokeStyle = "#00d4aa";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(44, waterY);
      ctx.lineTo(W - 16, waterY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Level value badge
      const badgeText = level + " cm";
      ctx.save();
      ctx.font = "600 13px 'JetBrains Mono', monospace";
      const badgeW = ctx.measureText(badgeText).width + 16;
      const badgeX = W - 16 - badgeW - 8;
      const badgeY = waterY - 12;
      ctx.fillStyle = "rgba(0,212,170,0.15)";
      roundRect(ctx, badgeX, badgeY - 10, badgeW, 20, 6);
      ctx.fill();
      ctx.fillStyle = "#00d4aa";
      ctx.textAlign = "center";
      ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 4);
      ctx.restore();

      // Reference label
      ctx.save();
      ctx.font = "400 9px 'Inter', sans-serif";
      ctx.fillStyle = "rgba(226,232,240,0.25)";
      ctx.textAlign = "right";
      ctx.fillText("ref: " + waterLevelRef, W - 18, 14);
      ctx.restore();

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
  }, [data]);

  useEffect(() => {
    render();
    return () => cancelAnimationFrame(animRef.current);
  }, [render]);

  return (
    <div style={{ width: "100%", maxWidth: 340, aspectRatio: "340 / 180" }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 2. COMBINED WIND WIDGET — Byvind + Medelvind compass
// ═══════════════════════════════════════════════════════════

export function CombinedWindWidget({ data }: { data: VivaStationData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gustSample = getSampleByName(data, "Byvind");
    const avgSample = getSampleByName(data, "Medelvind");
    const headingSample = getSampleByName(data, "Vindriktning");
    if (!gustSample || !avgSample || !headingSample) return;

    const W = 340;
    const H = 260;
    const ctx = setupCanvas(canvas, W, H);

    const gust = parseWindValue(gustSample.Value);
    const avg = parseWindValue(avgSample.Value);
    const heading = parseFloat(headingSample.Value);
    const maxSpeed = 25;

    const cx = W / 2;
    const cy = H / 2;
    const outerRadius = 82;
    const innerRadius = 64;

    let startTime: number | null = null;
    const animDuration = 1400;

    function draw(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const animProgress = Math.min(1, elapsed / animDuration);
      const easedProgress = easeOutCubic(animProgress);

      ctx.clearRect(0, 0, W, H);

      const currentHeading = easedProgress * heading;
      const currentGust = easedProgress * gust.speed;
      const currentAvg = easedProgress * avg.speed;

      // Outer ring background (gust track)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 14;
      ctx.stroke();
      ctx.restore();

      // Inner ring background (avg track)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.restore();

      // Gust speed arc (outer, amber)
      const gustFrac = Math.min(1, currentGust / maxSpeed);
      const arcStart = -Math.PI / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, arcStart, arcStart + gustFrac * Math.PI * 2);
      const gustGrad = ctx.createLinearGradient(cx - outerRadius, cy, cx + outerRadius, cy);
      gustGrad.addColorStop(0, "#f59e0b");
      gustGrad.addColorStop(1, "#fbbf24");
      ctx.strokeStyle = gustGrad;
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      // Average speed arc (inner, blue)
      const avgFrac = Math.min(1, currentAvg / maxSpeed);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, arcStart, arcStart + avgFrac * Math.PI * 2);
      const avgGrad = ctx.createLinearGradient(cx - innerRadius, cy, cx + innerRadius, cy);
      avgGrad.addColorStop(0, "#3b82f6");
      avgGrad.addColorStop(1, "#60a5fa");
      ctx.strokeStyle = avgGrad;
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      // Inner circle background
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius - 10, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(10,22,40,0.6)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Cardinal directions
      ctx.save();
      ctx.font = "600 10px 'Inter', sans-serif";
      ctx.fillStyle = "rgba(226,232,240,0.4)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const cardinals = [
        { label: "N", angle: -Math.PI / 2 },
        { label: "Ö", angle: 0 },
        { label: "S", angle: Math.PI / 2 },
        { label: "V", angle: Math.PI },
      ];
      for (const c of cardinals) {
        const lx = cx + Math.cos(c.angle) * (innerRadius - 24);
        const ly = cy + Math.sin(c.angle) * (innerRadius - 24);
        ctx.fillText(c.label, lx, ly);
      }
      ctx.restore();

      // Harbor danger zone
      const harborStart = (190 * Math.PI) / 180 - Math.PI / 2;
      const harborEnd = (210 * Math.PI) / 180 - Math.PI / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, harborStart, harborEnd);
      ctx.strokeStyle = "rgba(239,68,68,0.5)";
      ctx.lineWidth = 14;
      ctx.stroke();
      for (const a of [harborStart, harborEnd]) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (innerRadius - 10), cy + Math.sin(a) * (innerRadius - 10));
        ctx.lineTo(cx + Math.cos(a) * (outerRadius + 12), cy + Math.sin(a) * (outerRadius + 12));
        ctx.strokeStyle = "rgba(239,68,68,0.5)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Curved HAMNSEKTOR label
      const hamnText = "HAMNSEKTOR";
      const hamnR = outerRadius + 18;
      const hamnCenter = (200 * Math.PI) / 180 - Math.PI / 2;
      ctx.font = "600 8px 'Inter', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const hamnSpacing = 0.08;
      const hamnTotalW = (hamnText.length - 1) * hamnSpacing;
      const hamnStartA = hamnCenter + hamnTotalW / 2;
      for (let i = 0; i < hamnText.length; i++) {
        const ca = hamnStartA - i * hamnSpacing;
        ctx.save();
        ctx.translate(cx + Math.cos(ca) * hamnR, cy + Math.sin(ca) * hamnR);
        ctx.rotate(ca - Math.PI / 2);
        ctx.fillText(hamnText[i], 0, 0);
        ctx.restore();
      }
      ctx.restore();

      // Tick marks
      ctx.save();
      for (let i = 0; i < 36; i++) {
        const angle = (i * 10 * Math.PI) / 180 - Math.PI / 2;
        const isMajor = i % 9 === 0;
        const innerR = isMajor ? innerRadius - 38 : innerRadius - 34;
        const outerR = innerRadius - 28;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
        ctx.strokeStyle = isMajor ? "rgba(226,232,240,0.25)" : "rgba(226,232,240,0.08)";
        ctx.lineWidth = isMajor ? 2 : 1;
        ctx.stroke();
      }
      ctx.restore();

      // Wind barb — meteorological standard symbol pointing inward
      const needleAngle = (currentHeading * Math.PI) / 180;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(needleAngle);

      // Staff: line from outer edge pointing toward center
      const staffOuterR = outerRadius + 4;
      const staffInnerR = innerRadius - 16;
      const staffColor = "#e2e8f0";

      ctx.strokeStyle = staffColor;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      // Draw the staff line (along negative Y = north before rotation)
      ctx.beginPath();
      ctx.moveTo(0, -staffOuterR);
      ctx.lineTo(0, -staffInnerR);
      ctx.stroke();

      // Small circle at the inner tip
      ctx.beginPath();
      ctx.arc(0, -staffInnerR, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = staffColor;
      ctx.fill();

      // Draw barbs based on average wind speed
      // Pennant (▲) = 25 m/s, long barb = 5 m/s, short barb = 2.5 m/s
      let remaining = currentAvg;
      const barbSpacing = 7;
      let barbY = -staffOuterR; // start from outer end
      const barbLength = 14;
      const shortBarbLength = 8;
      const barbSide = 1; // barbs extend to the right (+x)

      // Pennants (25 m/s each)
      while (remaining >= 25) {
        ctx.beginPath();
        ctx.moveTo(0, barbY);
        ctx.lineTo(barbSide * barbLength, barbY + barbSpacing / 2);
        ctx.lineTo(0, barbY + barbSpacing);
        ctx.closePath();
        ctx.fillStyle = staffColor;
        ctx.fill();
        barbY += barbSpacing;
        remaining -= 25;
      }

      // Long barbs (5 m/s each)
      while (remaining >= 5) {
        ctx.beginPath();
        ctx.moveTo(0, barbY);
        ctx.lineTo(barbSide * barbLength, barbY - 4);
        ctx.strokeStyle = staffColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        barbY += barbSpacing;
        remaining -= 5;
      }

      // Short barb (2.5 m/s)
      if (remaining >= 2.5) {
        ctx.beginPath();
        ctx.moveTo(0, barbY);
        ctx.lineTo(barbSide * shortBarbLength, barbY - 3);
        ctx.strokeStyle = staffColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();

      // Center text — both speeds
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "500 8px 'Inter', sans-serif";
      ctx.fillStyle = "rgba(245,158,11,0.7)";
      ctx.fillText("BYVIND", cx, cy - 22);
      ctx.font = "700 18px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#f59e0b";
      ctx.fillText(currentGust.toFixed(1), cx, cy - 8);
      ctx.font = "500 8px 'Inter', sans-serif";
      ctx.fillStyle = "rgba(59,130,246,0.7)";
      ctx.fillText("MEDEL", cx, cy + 10);
      ctx.font = "700 18px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#3b82f6";
      ctx.fillText(currentAvg.toFixed(1), cx, cy + 24);
      ctx.font = "400 9px 'Inter', sans-serif";
      ctx.fillStyle = "rgba(226,232,240,0.4)";
      ctx.fillText("m/s", cx, cy + 38);
      ctx.restore();

      // Direction label
      ctx.save();
      ctx.font = "600 11px 'Inter', sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(gust.direction + " " + Math.round(currentHeading) + "°", cx, H - 4);
      ctx.restore();

      if (animProgress < 1) {
        animRef.current = requestAnimationFrame(draw);
      }
    }
    animRef.current = requestAnimationFrame(draw);
  }, [data]);

  useEffect(() => {
    render();
    return () => cancelAnimationFrame(animRef.current);
  }, [render]);

  return (
    <div style={{ width: "100%", maxWidth: 340, aspectRatio: "340 / 260" }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 3. COMBINED WATER WIDGET — Water Level + Temperature
// ═══════════════════════════════════════════════════════════

export function CombinedWaterWidget({ data }: { data: VivaStationData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const levelSample = getSampleByType(data, "level");
    const tempSample = getSampleByType(data, "watertemp");
    if (!levelSample || !tempSample) return;

    const W = 340;
    const H = 220;
    const ctx = setupCanvas(canvas, W, H);

    const level = parseFloat(levelSample.Value);
    const temp = parseFloat(tempSample.Value);

    const absLevel = Math.abs(level);
    let scaleMax: number;
    if (absLevel <= 60) scaleMax = 60;
    else if (absLevel <= 100) scaleMax = 100;
    else if (absLevel <= 150) scaleMax = 150;
    else scaleMax = Math.ceil(absLevel / 50) * 50;

    const scaleStep = scaleMax <= 60 ? 20 : scaleMax <= 100 ? 25 : 50;
    const minTemp = -5;
    const maxTemp = 30;

    function getTempColor(t: number): string {
      if (t <= 0) return "#60a5fa";
      if (t <= 10) return "#06b6d4";
      if (t <= 20) return "#00d4aa";
      if (t <= 25) return "#f59e0b";
      return "#ef4444";
    }

    const tempColor = getTempColor(temp);

    const barX = 40;
    const barW = 60;
    const barTop = 20;
    const barBottom = H - 30;
    const barH = barBottom - barTop;

    const arcCx = W * 0.68;
    const arcCy = H / 2 + 10;
    const arcRadius = 68;

    let startTime: number | null = null;
    const animDuration = 1400;

    function draw(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const animProgress = Math.min(1, elapsed / animDuration);
      const eased = easeOutCubic(animProgress);

      ctx.clearRect(0, 0, W, H);
      const currentLevel = eased * level;
      const currentTemp = eased * temp;

      // LEFT: Water Level Bar
      ctx.save();
      roundRect(ctx, barX, barTop, barW, barH, 6);
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Scale marks
      ctx.save();
      ctx.font = "400 9px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(226,232,240,0.3)";
      ctx.textAlign = "right";
      for (let v = -scaleMax; v <= scaleMax; v += scaleStep) {
        const frac = (v - (-scaleMax)) / (scaleMax * 2);
        const y = barBottom - frac * barH;
        ctx.beginPath();
        ctx.moveTo(barX - 2, y);
        ctx.lineTo(barX + barW + 2, y);
        ctx.strokeStyle = v === 0 ? "rgba(226,232,240,0.2)" : "rgba(226,232,240,0.06)";
        ctx.lineWidth = v === 0 ? 1.5 : 1;
        ctx.stroke();
        ctx.fillText(v + "", barX - 6, y + 3);
      }
      ctx.restore();

      // Water fill
      const levelFrac = (currentLevel - (-scaleMax)) / (scaleMax * 2);
      const fillY = barBottom - levelFrac * barH;
      const fillHeight = barBottom - fillY;

      if (fillHeight > 0) {
        ctx.save();
        roundRect(ctx, barX, barTop, barW, barH, 6);
        ctx.clip();
        const waterGrad = ctx.createLinearGradient(0, fillY, 0, barBottom);
        waterGrad.addColorStop(0, "rgba(0,212,170,0.4)");
        waterGrad.addColorStop(0.5, "rgba(0,180,160,0.3)");
        waterGrad.addColorStop(1, "rgba(0,100,120,0.2)");
        ctx.fillStyle = waterGrad;
        ctx.fillRect(barX, fillY, barW, fillHeight);

        // Wave
        ctx.beginPath();
        const waveTime = timestamp / 800;
        ctx.moveTo(barX, fillY);
        for (let x = barX; x <= barX + barW; x++) {
          const waveY = fillY + Math.sin((x - barX) * 0.15 + waveTime) * 2;
          ctx.lineTo(x, waveY);
        }
        ctx.lineTo(barX + barW, barBottom);
        ctx.lineTo(barX, barBottom);
        ctx.closePath();
        ctx.fillStyle = "rgba(0,212,170,0.15)";
        ctx.fill();
        ctx.restore();
      }

      // Level value
      ctx.save();
      ctx.font = "700 20px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#00d4aa";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(Math.round(currentLevel) + "", barX + barW / 2, barTop - 10);
      ctx.font = "400 9px 'Inter', sans-serif";
      ctx.fillStyle = "rgba(226,232,240,0.5)";
      ctx.fillText("cm", barX + barW + 16, barTop - 10);
      ctx.restore();

      ctx.save();
      ctx.font = "600 8px 'Inter', sans-serif";
      ctx.fillStyle = "rgba(226,232,240,0.4)";
      ctx.textAlign = "center";
      ctx.fillText("NIVÅ", barX + barW / 2, barBottom + 16);
      ctx.restore();

      // RIGHT: Temperature Arc
      const gapAngle = Math.PI * 0.35;
      const arcStart = Math.PI / 2 + gapAngle;
      const arcEnd = Math.PI / 2 - gapAngle + Math.PI * 2;
      const totalArc = arcEnd - arcStart;

      ctx.save();
      ctx.beginPath();
      ctx.arc(arcCx, arcCy, arcRadius, arcStart, arcEnd);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      const tempFrac = Math.max(0, Math.min(1, (currentTemp - minTemp) / (maxTemp - minTemp)));
      const tempArcEnd = arcStart + tempFrac * totalArc;

      ctx.save();
      ctx.beginPath();
      ctx.arc(arcCx, arcCy, arcRadius, arcStart, tempArcEnd);
      const tGrad = ctx.createLinearGradient(arcCx - arcRadius, arcCy, arcCx + arcRadius, arcCy);
      tGrad.addColorStop(0, "#60a5fa");
      tGrad.addColorStop(0.35, "#06b6d4");
      tGrad.addColorStop(0.6, "#00d4aa");
      tGrad.addColorStop(0.8, "#f59e0b");
      tGrad.addColorStop(1, "#ef4444");
      ctx.strokeStyle = tGrad;
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      // Glow at arc end
      if (tempFrac > 0.01) {
        const glowX = arcCx + Math.cos(tempArcEnd) * arcRadius;
        const glowY = arcCy + Math.sin(tempArcEnd) * arcRadius;
        ctx.save();
        const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 14);
        glow.addColorStop(0, hexToRgba(tempColor, 0.4));
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(glowX - 16, glowY - 16, 32, 32);
        ctx.restore();
      }

      // Temperature scale ticks
      ctx.save();
      ctx.font = "400 8px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(226,232,240,0.25)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let st = 0; st <= 30; st += 10) {
        const frac = (st - minTemp) / (maxTemp - minTemp);
        const a = arcStart + frac * totalArc;
        ctx.fillText(st + "°", arcCx + Math.cos(a) * (arcRadius + 16), arcCy + Math.sin(a) * (arcRadius + 16));
      }
      ctx.restore();

      // Center temperature value
      ctx.save();
      ctx.font = "700 24px 'JetBrains Mono', monospace";
      ctx.fillStyle = tempColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(currentTemp.toFixed(1) + "°", arcCx, arcCy - 4);
      ctx.font = "400 10px 'Inter', sans-serif";
      ctx.fillStyle = "rgba(226,232,240,0.5)";
      ctx.fillText("Celsius", arcCx, arcCy + 16);
      ctx.restore();

      // Frost indicator
      if (temp <= 0) {
        ctx.save();
        const t = timestamp / 1000;
        const pulseAlpha = 0.4 + Math.sin(t * 2) * 0.15;
        ctx.font = "400 16px sans-serif";
        ctx.fillStyle = `rgba(96,165,250,${pulseAlpha})`;
        ctx.textAlign = "center";
        ctx.fillText("❄", arcCx, arcCy + 36);
        ctx.restore();
      }

      if (animProgress < 1 || temp <= 0) {
        animRef.current = requestAnimationFrame(draw);
      }
    }
    animRef.current = requestAnimationFrame(draw);
  }, [data]);

  useEffect(() => {
    render();
    return () => cancelAnimationFrame(animRef.current);
  }, [render]);

  return (
    <div style={{ width: "100%", maxWidth: 340, aspectRatio: "340 / 220" }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
