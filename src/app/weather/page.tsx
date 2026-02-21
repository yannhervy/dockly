"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import RefreshIcon from "@mui/icons-material/Refresh";
import WaterIcon from "@mui/icons-material/Water";
import AirIcon from "@mui/icons-material/Air";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import TimelineIcon from "@mui/icons-material/Timeline";
import {
  useVivaStation,
  getSampleByType,
  getSampleByName,
  parseWindValue,
  formatVivaTime,
} from "@/hooks/useVivaStation";
import { useVivaHistory } from "@/hooks/useVivaHistory";
import {
  WaterLevelWidget,
  CombinedWindWidget,
  CombinedWaterWidget,
} from "@/components/weather/WeatherWidgets";
import { WindHistoryChart, WaterLevelHistoryChart } from "@/components/weather/HistoryCharts";

export default function WeatherPage() {
  const { data, loading, error, lastFetched, refetch } = useVivaStation(114);
  const { data: historyData, loading: historyLoading } = useVivaHistory(114);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Quick stats from data
  const levelSample = data ? getSampleByType(data, "level") : null;
  const gustSample = data ? getSampleByName(data, "Byvind") : null;
  const avgSample = data ? getSampleByName(data, "Medelvind") : null;
  const tempSample = data ? getSampleByType(data, "watertemp") : null;
  const headingSample = data ? getSampleByName(data, "Vindriktning") : null;

  const gustWind = gustSample ? parseWindValue(gustSample.Value) : null;
  const avgWind = avgSample ? parseWindValue(avgSample.Value) : null;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", px: 3, py: 5 }}>
      {/* Header */}
      <Box
        sx={{
          textAlign: "center",
          mb: 4,
        }}
      >
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            mb: 1,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: data ? "#00d4aa" : "grey.500",
              boxShadow: data ? "0 0 8px #00d4aa" : "none",
              animation: data ? "pulse 2s ease-in-out infinite" : "none",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1, boxShadow: "0 0 8px #00d4aa" },
                "50%": { opacity: 0.5, boxShadow: "0 0 16px #00d4aa" },
              },
            }}
          />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#00d4aa",
            }}
          >
            Station Live
          </Typography>
        </Box>

        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            letterSpacing: "-0.02em",
            background: "linear-gradient(135deg, #e2e8f0 0%, #00d4aa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {data?.Name || "Vinga"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Sjöfartsverket ViVa — Realtidsdata
        </Typography>

        {lastFetched && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mt: 1 }}>
            <Typography
              variant="caption"
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                color: "text.secondary",
                fontSize: "0.7rem",
              }}
            >
              Uppdaterad {lastFetched.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
            </Typography>
            <Tooltip title="Uppdatera nu">
              <IconButton size="small" onClick={refetch} sx={{ color: "text.secondary" }}>
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {loading && !data && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: "#00d4aa" }} />
        </Box>
      )}

      {error && !data && (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography color="error">
            Kunde inte hämta väderdata: {error}
          </Typography>
        </Box>
      )}

      {data && (
        <>
          {/* Quick stats row */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
              gap: 2,
              mb: 4,
            }}
          >
            {/* Average wind stat */}
            <Card
              sx={{
                bgcolor: "rgba(13, 33, 55, 0.6)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(59,130,246,0.1)",
              }}
            >
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <AirIcon sx={{ fontSize: 18, color: "#3b82f6" }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", fontSize: "0.65rem" }}>
                    Medelvind
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.4rem", fontWeight: 700, color: "#3b82f6" }}>
                  {avgWind ? avgWind.speed.toFixed(1) : "—"} <Typography component="span" sx={{ fontSize: "0.85rem", fontWeight: 400, color: "text.secondary" }}>m/s</Typography>
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem", fontFamily: "'JetBrains Mono', monospace" }}>
                  {avgWind ? avgWind.direction : ""} {headingSample ? headingSample.Value + "°" : ""}
                </Typography>
              </CardContent>
            </Card>

            {/* Gust wind stat */}
            <Card
              sx={{
                bgcolor: "rgba(13, 33, 55, 0.6)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(245,158,11,0.1)",
              }}
            >
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <AirIcon sx={{ fontSize: 18, color: "#f59e0b" }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", fontSize: "0.65rem" }}>
                    Byvind
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.4rem", fontWeight: 700, color: "#f59e0b" }}>
                  {gustWind ? gustWind.speed.toFixed(1) : "—"} <Typography component="span" sx={{ fontSize: "0.85rem", fontWeight: 400, color: "text.secondary" }}>m/s</Typography>
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem", fontFamily: "'JetBrains Mono', monospace" }}>
                  {gustSample ? formatVivaTime(gustSample.Updated) : ""}
                </Typography>
              </CardContent>
            </Card>

            {/* Water level stat */}
            <Card
              sx={{
                bgcolor: "rgba(13, 33, 55, 0.6)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(0,212,170,0.1)",
              }}
            >
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <WaterIcon sx={{ fontSize: 18, color: "#00d4aa" }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", fontSize: "0.65rem" }}>
                    Vattenstånd
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.4rem", fontWeight: 700, color: "#00d4aa" }}>
                  {levelSample?.Value || "—"} <Typography component="span" sx={{ fontSize: "0.85rem", fontWeight: 400, color: "text.secondary" }}>cm</Typography>
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem", fontFamily: "'JetBrains Mono', monospace" }}>
                  {levelSample ? formatVivaTime(levelSample.Updated) : ""}
                </Typography>
              </CardContent>
            </Card>

            {/* Water temperature stat */}
            <Card
              sx={{
                bgcolor: "rgba(13, 33, 55, 0.6)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(6,182,212,0.1)",
              }}
            >
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <ThermostatIcon sx={{ fontSize: 18, color: "#06b6d4" }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", fontSize: "0.65rem" }}>
                    Vattentemp
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.4rem", fontWeight: 700, color: "#06b6d4" }}>
                  {tempSample?.Value || "—"} <Typography component="span" sx={{ fontSize: "0.85rem", fontWeight: 400, color: "text.secondary" }}>°C</Typography>
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem", fontFamily: "'JetBrains Mono', monospace" }}>
                  {tempSample ? formatVivaTime(tempSample.Updated) : ""}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Canvas widgets */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
              gap: 3,
            }}
          >
            {/* Combined Wind */}
            <Card
              sx={{
                bgcolor: "rgba(15, 30, 56, 0.65)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.06)",
                transition: "all 0.3s",
                "&:hover": {
                  transform: "translateY(-3px)",
                  borderColor: "rgba(0,212,170,0.15)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 0 30px rgba(0,212,170,0.08), 0 0 30px rgba(245,158,11,0.08)",
                },
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary" }}>
                    Vind
                  </Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: "rgba(0,212,170,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>
                    🧭
                  </Box>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <CombinedWindWidget data={data} />
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1, pt: 1, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1rem", fontWeight: 500 }}>
                    {avgWind ? `${avgWind.direction} ${avgWind.speed.toFixed(1)} - ${gustWind?.speed.toFixed(1)} m/s` : "—"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem" }}>
                    {gustSample ? formatVivaTime(gustSample.Updated) : ""}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Combined Water */}
            <Card
              sx={{
                bgcolor: "rgba(15, 30, 56, 0.65)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.06)",
                transition: "all 0.3s",
                "&:hover": {
                  transform: "translateY(-3px)",
                  borderColor: "rgba(0,212,170,0.15)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 0 30px rgba(0,212,170,0.08)",
                },
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary" }}>
                    Vatten
                  </Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: "rgba(0,212,170,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>
                    🌊
                  </Box>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <CombinedWaterWidget data={data} />
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1, pt: 1, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1rem", fontWeight: 500 }}>
                    {levelSample ? `${levelSample.Value} cm  /  ${tempSample?.Value} °C` : "—"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem" }}>
                    {levelSample ? formatVivaTime(levelSample.Updated) : ""}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Water Level (full width) */}
            <Card
              sx={{
                gridColumn: { md: "1 / -1" },
                bgcolor: "rgba(15, 30, 56, 0.65)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.06)",
                transition: "all 0.3s",
                "&:hover": {
                  transform: "translateY(-3px)",
                  borderColor: "rgba(0,212,170,0.15)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 0 30px rgba(0,212,170,0.08)",
                },
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary" }}>
                    Vattenstånd
                  </Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: "rgba(0,212,170,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>
                    🌊
                  </Box>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <WaterLevelWidget data={data} />
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1, pt: 1, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1rem", fontWeight: 500 }}>
                    {levelSample ? `${levelSample.Value} ${levelSample.Unit}` : "—"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem" }}>
                    ref: {levelSample?.WaterLevelReference || ""} · {levelSample ? formatVivaTime(levelSample.Updated) : ""}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* ─── Historical Charts ──────────────────────── */}
          <Box sx={{ mt: 5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
              <TimelineIcon sx={{ fontSize: 20, color: "#00d4aa" }} />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  background: "linear-gradient(135deg, #e2e8f0 0%, #00d4aa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Historik (24h)
              </Typography>
            </Box>

            {historyLoading && !historyData && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={24} sx={{ color: "#00d4aa" }} />
              </Box>
            )}

            {historyData && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Wind History */}
                <Card
                  sx={{
                    bgcolor: "rgba(15, 30, 56, 0.65)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary" }}>
                        Vindhistorik
                      </Typography>
                      <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: "rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>
                        💨
                      </Box>
                    </Box>
                    <WindHistoryChart
                      avgWind={historyData.avgWind}
                      gustWind={historyData.gustWind}
                      direction={historyData.direction}
                    />
                  </CardContent>
                </Card>

                {/* Water Level History */}
                <Card
                  sx={{
                    bgcolor: "rgba(15, 30, 56, 0.65)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary" }}>
                        Vattenstånd historik
                      </Typography>
                      <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: "rgba(0,212,170,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>
                        🌊
                      </Box>
                    </Box>
                    <WaterLevelHistoryChart
                      waterLevel={historyData.waterLevel}
                      waterLevelRef={historyData.waterLevelRef}
                    />
                  </CardContent>
                </Card>
              </Box>
            )}
          </Box>

          {/* Data source attribution */}
          <Box sx={{ textAlign: "center", mt: 4, pb: 2 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>
              Data från Sjöfartsverket ViVa · Station {data.ID} · Uppdateras var 5:e minut
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
}
