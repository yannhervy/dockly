"use client";

import React, { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import SailingIcon from "@mui/icons-material/Sailing";
import InfoIcon from "@mui/icons-material/Info";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PlaceIcon from "@mui/icons-material/Place";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import LoginIcon from "@mui/icons-material/Login";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import type { NewsPost } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const isLoggedIn = !!firebaseUser;

  // Carousel state — only carousel when not logged in (2 slides)
  const [activeSlide, setActiveSlide] = useState(0);
  const slideCount = isLoggedIn ? 1 : 2;

  // Auto-advance carousel every 6 seconds
  const advanceSlide = useCallback(() => {
    if (slideCount <= 1) return;
    setActiveSlide((prev) => (prev + 1) % slideCount);
  }, [slideCount]);

  useEffect(() => {
    if (slideCount <= 1) return;
    const timer = setInterval(advanceSlide, 6000);
    return () => clearInterval(timer);
  }, [advanceSlide, slideCount]);

  // ── Fetch latest news posts ──
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const q = query(
          collection(db, "news"),
          orderBy("createdAt", "desc"),
          limit(3)
        );
        const snap = await getDocs(q);
        setNewsPosts(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NewsPost)
        );
      } catch (err) {
        console.error("Error fetching news for homepage:", err);
      }
    })();
  }, []);

  return (
    <Box>
      {/* ─── Hero Section ─────────────────────────────────── */}
      <Box
        sx={{
          position: "relative",
          minHeight: { xs: 420, md: 520 },
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          px: 3,
          py: 8,
          overflow: "hidden",
          backgroundImage: "url('/IMG20221112150016-EDIT.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Semi-transparent text plate */}
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            maxWidth: 700,
            bgcolor: "rgba(10, 25, 41, 0.75)",
            backdropFilter: "blur(16px)",
            borderRadius: 4,
            px: { xs: 3, sm: 5 },
            py: { xs: 4, sm: 5 },
            border: "1px solid rgba(79,195,247,0.15)",
          }}
        >
          <SailingIcon
            sx={{
              fontSize: 56,
              color: "#FFB74D",
              mb: 2,
              filter: "drop-shadow(0 4px 12px rgba(255,183,77,0.3))",
            }}
          />
          <Typography
            variant="h2"
            sx={{
              fontWeight: 800,
              mb: 1,
              fontSize: { xs: "2rem", sm: "2.8rem", md: "3.5rem" },
              background: "linear-gradient(135deg, #fff 0%, #4FC3F7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Stegerholmens Hamn
          </Typography>

          {/* ── Carousel slides ── */}
          <Box sx={{ position: "relative", minHeight: { xs: 150, sm: 130 } }}>
            {/* Slide 0: informational */}
            <Box
              sx={{
                position: activeSlide === 0 ? "relative" : "absolute",
                top: 0,
                left: 0,
                right: 0,
                opacity: activeSlide === 0 ? 1 : 0,
                transition: "opacity 0.6s ease-in-out",
                pointerEvents: activeSlide === 0 ? "auto" : "none",
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  color: "rgba(255,255,255,0.85)",
                  fontWeight: 400,
                  mb: 4,
                  maxWidth: 520,
                  mx: "auto",
                  lineHeight: 1.6,
                }}
              >
                En idyllisk hamn med nära till både skärgården och stan. Båtplatser, sjöbodar och gemenskap
                vid vattnet.
              </Typography>
              <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => router.push("/interest")}
                  sx={{
                    px: 4,
                    py: 1.5,
                    fontSize: "1rem",
                    textTransform: "none",
                    borderRadius: 3,
                    background: "linear-gradient(135deg, #4FC3F7, #0288D1)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #29B6F6, #0277BD)",
                    },
                  }}
                >
                  Intresseanmälan för båtplats
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => router.push("/docks")}
                  sx={{
                    px: 4,
                    py: 1.5,
                    fontSize: "1rem",
                    textTransform: "none",
                    borderRadius: 3,
                    borderColor: "rgba(255,255,255,0.4)",
                    color: "#fff",
                    "&:hover": {
                      borderColor: "rgba(255,255,255,0.7)",
                      bgcolor: "rgba(255,255,255,0.08)",
                    },
                  }}
                >
                  Se våra bryggor
                </Button>
              </Box>
            </Box>

            {/* Slide 1: account CTA (only for non-logged-in users) */}
            {!isLoggedIn && (
              <Box
                sx={{
                  position: activeSlide === 1 ? "relative" : "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  opacity: activeSlide === 1 ? 1 : 0,
                  transition: "opacity 0.6s ease-in-out",
                  pointerEvents: activeSlide === 1 ? "auto" : "none",
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    color: "rgba(255,255,255,0.85)",
                    fontWeight: 400,
                    mb: 4,
                    maxWidth: 520,
                    mx: "auto",
                    lineHeight: 1.6,
                  }}
                >
                  Skapa konto eller logga in för att komma åt samtliga funktioner.
                </Typography>
                <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PersonAddIcon />}
                    onClick={() => router.push("/login")}
                    sx={{
                      px: 4,
                      py: 1.5,
                      fontSize: "1rem",
                      textTransform: "none",
                      borderRadius: 3,
                      background: "linear-gradient(135deg, #4FC3F7, #0288D1)",
                      "&:hover": {
                        background: "linear-gradient(135deg, #29B6F6, #0277BD)",
                      },
                    }}
                  >
                    Skapa konto
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<LoginIcon />}
                    onClick={() => router.push("/login")}
                    sx={{
                      px: 4,
                      py: 1.5,
                      fontSize: "1rem",
                      textTransform: "none",
                      borderRadius: 3,
                      borderColor: "rgba(255,255,255,0.4)",
                      color: "#fff",
                      "&:hover": {
                        borderColor: "rgba(255,255,255,0.7)",
                        bgcolor: "rgba(255,255,255,0.08)",
                      },
                    }}
                  >
                    Logga in
                  </Button>
                </Box>
              </Box>
            )}
          </Box>

          {/* Dot indicators */}
          {slideCount > 1 && (
            <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mt: 3 }}>
              {Array.from({ length: slideCount }).map((_, i) => (
                <Box
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: activeSlide === i ? "#4FC3F7" : "rgba(255,255,255,0.3)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                    "&:hover": { bgcolor: activeSlide === i ? "#4FC3F7" : "rgba(255,255,255,0.5)" },
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* ─── Quick Links Section ──────────────────────────── */}
      <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 6 }}>
        <Grid container spacing={3}>
          {[
            {
              icon: <DirectionsBoatIcon sx={{ fontSize: 36, color: "primary.main" }} />,
              title: "Bryggor",
              desc: "Se vilka bryggor som finns och hur du kontaktar bryggägaren.",
              path: "/docks",
            },
            {
              icon: <InfoIcon sx={{ fontSize: 36, color: "#66BB6A" }} />,
              title: "Om hamnen",
              desc: "Läs om hur hamnen drivs, regler och säsonger.",
              path: "/info",
            },
            {
              icon: <StorefrontIcon sx={{ fontSize: 36, color: "#FFB74D" }} />,
              title: "Köp & Sälj",
              desc: "Marknadsplats för utrustning, tjänster och mer.",
              path: "/marketplace",
            },
          ].map((item) => (
            <Grid size={{ xs: 12, md: 4 }} key={item.title}>
              <Card
                onClick={() => router.push(item.path)}
                sx={{
                  cursor: "pointer",
                  height: "100%",
                  bgcolor: "rgba(13, 33, 55, 0.6)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(79,195,247,0.08)",
                  transition: "all 0.3s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    border: "1px solid rgba(79,195,247,0.25)",
                    boxShadow: "0 8px 32px rgba(79,195,247,0.1)",
                  },
                }}
              >
                <CardContent sx={{ p: 3, textAlign: "center" }}>
                  {item.icon}
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 1.5, mb: 1 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.desc}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* ─── Latest News Section ───────────────────────────── */}
      {newsPosts.length > 0 && (
        <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 6 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 3,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <NewspaperIcon sx={{ color: "primary.main" }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Senaste nytt
              </Typography>
            </Box>
            <Button
              endIcon={<ArrowForwardIcon />}
              onClick={() => router.push("/news")}
              sx={{ textTransform: "none" }}
            >
              Se alla nyheter
            </Button>
          </Box>

          <Grid container spacing={3}>
            {newsPosts.map((post) => (
              <Grid size={{ xs: 12, md: 4 }} key={post.id}>
                <Card
                  onClick={() => router.push("/news")}
                  sx={{
                    cursor: "pointer",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    bgcolor: "rgba(13, 33, 55, 0.6)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(79,195,247,0.08)",
                    transition: "all 0.3s",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      border: "1px solid rgba(79,195,247,0.2)",
                      boxShadow: "0 8px 32px rgba(79,195,247,0.1)",
                    },
                  }}
                >
                  {post.imageUrls?.[0] && (
                    <CardMedia
                      component="img"
                      height="180"
                      image={post.imageUrls[0]}
                      alt={post.title}
                      sx={{ objectFit: "cover" }}
                    />
                  )}
                  <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column" }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {post.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5 }}>
                      {post.authorName} ·{" "}
                      {post.createdAt?.toDate?.()?.toLocaleDateString("sv-SE") || ""}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        lineHeight: 1.6,
                        flex: 1,
                      }}
                    >
                      {post.body.replace(/[#*_~`>\[\]()!]/g, "").slice(0, 200)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* ─── Map Section ──────────────────────────────────── */}
      <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <PlaceIcon sx={{ color: "primary.main" }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Hitta hit
          </Typography>
        </Box>
        <Box
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid rgba(79,195,247,0.12)",
            height: { xs: 300, md: 400 },
          }}
        >
          <iframe
            title="Stegerholmens Hamn"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2070.0!2d11.8797606!3d57.6138617!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x464fed4c872dc499%3A0x9e451918bb806f76!2sStegerholmens%20sm%C3%A5b%C3%A5tshamn!5e1!3m2!1ssv!2sse"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Stegerholmens småbåtshamn, Göteborgs skärgård
        </Typography>
      </Box>

      {/* Bottom spacer */}
      <Box sx={{ height: 40 }} />
    </Box>
  );
}
