"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import AirIcon from "@mui/icons-material/Air";
import WaterIcon from "@mui/icons-material/Water";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import {
  useVivaStation,
  getSampleByType,
  getSampleByName,
  parseWindValue,
  formatVivaTime,
} from "@/hooks/useVivaStation";

/**
 * Compact weather strip showing 4 live stat cards.
 * Designed for embedding on the homepage or any page.
 */
export default function WeatherStrip() {
  const { data, loading } = useVivaStation(114);

  if (loading || !data) return null;

  const levelSample = getSampleByType(data, "level");
  const tempSample = getSampleByType(data, "watertemp");
  const avgSample = getSampleByName(data, "Medelvind");
  const gustSample = getSampleByName(data, "Byvind");
  const headingSample = getSampleByName(data, "Vindriktning");

  const avgWind = avgSample ? parseWindValue(avgSample.Value) : null;
  const gustWind = gustSample ? parseWindValue(gustSample.Value) : null;

  const stats = [
    {
      label: "Medelvind",
      value: avgWind ? avgWind.speed.toFixed(1) : "—",
      unit: "m/s",
      sub: avgWind ? `${avgWind.direction} ${headingSample?.Value ?? ""}°` : "",
      color: "#3b82f6",
      borderColor: "rgba(59,130,246,0.15)",
      icon: <AirIcon sx={{ fontSize: 16, color: "#3b82f6" }} />,
    },
    {
      label: "Byvind",
      value: gustWind ? gustWind.speed.toFixed(1) : "—",
      unit: "m/s",
      sub: gustSample ? formatVivaTime(gustSample.Updated) : "",
      color: "#f59e0b",
      borderColor: "rgba(245,158,11,0.15)",
      icon: <AirIcon sx={{ fontSize: 16, color: "#f59e0b" }} />,
    },
    {
      label: "Vattenstånd",
      value: levelSample?.Value || "—",
      unit: "cm",
      sub: levelSample ? formatVivaTime(levelSample.Updated) : "",
      color: "#00d4aa",
      borderColor: "rgba(0,212,170,0.15)",
      icon: <WaterIcon sx={{ fontSize: 16, color: "#00d4aa" }} />,
    },
    {
      label: "Vattentemp",
      value: tempSample?.Value || "—",
      unit: "°C",
      sub: tempSample ? formatVivaTime(tempSample.Updated) : "",
      color: "#06b6d4",
      borderColor: "rgba(6,182,212,0.15)",
      icon: <ThermostatIcon sx={{ fontSize: 16, color: "#06b6d4" }} />,
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
        gap: 1.5,
      }}
    >
      {stats.map((s) => (
        <Card
          key={s.label}
          sx={{
            bgcolor: "rgba(13, 33, 55, 0.6)",
            backdropFilter: "blur(12px)",
            border: `1px solid ${s.borderColor}`,
          }}
        >
          <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
              {s.icon}
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "text.secondary",
                  fontSize: "0.6rem",
                }}
              >
                {s.label}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "1.25rem",
                fontWeight: 700,
                color: s.color,
              }}
            >
              {s.value}{" "}
              <Typography
                component="span"
                sx={{ fontSize: "0.75rem", fontWeight: 400, color: "text.secondary" }}
              >
                {s.unit}
              </Typography>
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontSize: "0.55rem",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {s.sub}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
