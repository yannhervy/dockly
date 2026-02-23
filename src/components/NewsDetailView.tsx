"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default.Markdown),
  { ssr: false }
);

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  limit,
  Timestamp,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { NewsPost } from "@/lib/types";
import { REACTION_EMOJIS } from "@/lib/types";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Snackbar from "@mui/material/Snackbar";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShareIcon from "@mui/icons-material/Share";
import CloseIcon from "@mui/icons-material/Close";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────
function formatDate(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString("sv-SE");
}

function stripMarkdown(md: string, maxLen = 160): string {
  const plain = md
    .replace(/[#*_~`>\[\]()!-]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen - 1) + "\u2026" : plain;
}

// ─── Component ──────────────────────────────────────────────
interface NewsDetailViewProps {
  /** The slug from the URL, e.g. "storm-pa-naset-abc123" */
  slug: string;
}

export default function NewsDetailView({ slug }: NewsDetailViewProps) {
  const router = useRouter();
  const { firebaseUser } = useAuth();

  const [post, setPost] = useState<NewsPost | null>(null);
  const [otherPosts, setOtherPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [snackMsg, setSnackMsg] = useState("");

  // Fetch the post by slug, fallback to document ID
  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      try {
        let found: NewsPost | null = null;

        // 1. Try finding by slug field
        const q = query(
          collection(db, "news"),
          where("slug", "==", slug),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          found = { id: snap.docs[0].id, ...snap.docs[0].data() } as NewsPost;
        }

        // 2. Fallback: try by document ID (for old posts without slugs)
        if (!found) {
          const docRef = doc(db, "news", slug);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            found = { id: docSnap.id, ...docSnap.data() } as NewsPost;
          }
        }

        if (found) {
          setPost(found);

          // Fetch other recent posts
          const otherQ = query(
            collection(db, "news"),
            orderBy("createdAt", "desc"),
            limit(6)
          );
          const otherSnap = await getDocs(otherQ);
          setOtherPosts(
            otherSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }) as NewsPost)
              .filter((p) => p.id !== found!.id)
              .slice(0, 5)
          );
        }
      } catch (err) {
        console.error("Error fetching news post:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // Reaction handler
  const handleReaction = async (postId: string, emoji: string) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const postRef = doc(db, "news", postId);
    const current = post?.reactions?.[emoji] || [];
    const hasReacted = current.includes(uid);

    try {
      await updateDoc(postRef, {
        [`reactions.${emoji}`]: hasReacted
          ? arrayRemove(uid)
          : arrayUnion(uid),
      });
      setPost((prev) => {
        if (!prev) return prev;
        const reactions = { ...prev.reactions };
        const list = [...(reactions[emoji] || [])];
        if (hasReacted) {
          reactions[emoji] = list.filter((id) => id !== uid);
        } else {
          reactions[emoji] = [...list, uid];
        }
        return { ...prev, reactions };
      });
    } catch (err) {
      console.error("Error toggling reaction:", err);
    }
  };

  // Share handler
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/share/news/${slug}`;
    if (navigator.share) {
      navigator.share({ title: post?.title, url: shareUrl }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setSnackMsg("Länk kopierad!");
    }
  };

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Not found
  if (!post) {
    return (
      <Box sx={{ maxWidth: 800, mx: "auto", px: 3, py: 5, textAlign: "center" }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Nyheten hittades inte
        </Typography>
        <Button
          component={Link}
          href="/news"
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: "none" }}
        >
          Tillbaka till nyheter
        </Button>
      </Box>
    );
  }

  const isReport = post.postType === "report";

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", px: 3, py: 5 }}>
      {/* Back button */}
      <Button
        component={Link}
        href="/news"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2, textTransform: "none" }}
      >
        Alla nyheter
      </Button>

      {/* Main post card */}
      <Card
        sx={{
          mb: 4,
          bgcolor: "rgba(13, 33, 55, 0.6)",
          backdropFilter: "blur(12px)",
          border: isReport
            ? "1px solid rgba(255, 183, 77, 0.2)"
            : "1px solid rgba(79,195,247,0.08)",
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          {/* Title & meta */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                {isReport && (
                  <ReportProblemIcon sx={{ fontSize: 24, color: "warning.main" }} />
                )}
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  {post.title}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {post.authorName} &middot; {formatDate(post.createdAt)}
              </Typography>
            </Box>
            <Tooltip title="Dela nyhet">
              <IconButton onClick={handleShare} sx={{ color: "primary.main" }}>
                <ShareIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Body */}
          <Box
            sx={{
              lineHeight: 1.8,
              mb: 2,
              fontSize: "1.05rem",
              "& p": { color: "text.secondary", my: 0.5 },
              "& a": { color: "primary.main" },
              "& strong": { color: "text.primary" },
              "& ul, & ol": { color: "text.secondary", pl: 2 },
              "& li": { mb: 0.3 },
            }}
          >
            <MDPreview source={post.body} style={{ background: "transparent", color: "inherit" }} />
          </Box>

          {/* Images gallery */}
          {post.imageUrls && post.imageUrls.length > 0 && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
              {post.imageUrls.map((url, i) => (
                <Box
                  key={i}
                  component="img"
                  src={url}
                  alt={`${post.title} - bild ${i + 1}`}
                  sx={{
                    width: post.imageUrls.length === 1 ? "100%" : { xs: "100%", sm: "calc(50% - 4px)" },
                    maxHeight: 500,
                    objectFit: "cover",
                    borderRadius: 2,
                    cursor: "pointer",
                    transition: "transform 0.2s",
                    "&:hover": { transform: "scale(1.01)" },
                  }}
                  onClick={() => setLightboxUrl(url)}
                />
              ))}
            </Box>
          )}

          {/* Reactions */}
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
            {REACTION_EMOJIS.map((emoji) => {
              const reactors = post.reactions?.[emoji] || [];
              const hasReacted = firebaseUser ? reactors.includes(firebaseUser.uid) : false;
              const count = reactors.length;

              return (
                <Tooltip
                  key={emoji}
                  title={firebaseUser ? (hasReacted ? "Ta bort reaktion" : "Reagera") : "Logga in för att reagera"}
                >
                  <span>
                    <Chip
                      label={`${emoji}${count > 0 ? ` ${count}` : ""}`}
                      size="small"
                      clickable={!!firebaseUser}
                      onClick={() => handleReaction(post.id, emoji)}
                      disabled={!firebaseUser}
                      variant={hasReacted ? "filled" : "outlined"}
                      sx={{
                        fontSize: "1rem",
                        borderColor: hasReacted ? "primary.main" : "rgba(79,195,247,0.15)",
                        bgcolor: hasReacted ? "rgba(79,195,247,0.15)" : "transparent",
                        "&:hover": { bgcolor: "rgba(79,195,247,0.1)" },
                        ...(count === 0 && !firebaseUser ? { display: "none" } : {}),
                      }}
                    />
                  </span>
                </Tooltip>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {/* Other posts */}
      {otherPosts.length > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Fler nyheter
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {otherPosts.map((other) => (
              <Card
                key={other.id}
                onClick={() => {
                  // Use window.location for SPA navigation via firebase.json fallback
                  window.location.href = `/news/${other.slug || other.id}`;
                }}
                sx={{
                  cursor: "pointer",
                  bgcolor: "rgba(13, 33, 55, 0.6)",
                  backdropFilter: "blur(12px)",
                  border: other.postType === "report"
                    ? "1px solid rgba(255, 183, 77, 0.15)"
                    : "1px solid rgba(79,195,247,0.08)",
                  transition: "all 0.3s",
                  "&:hover": {
                    border: "1px solid rgba(79,195,247,0.25)",
                    boxShadow: "0 4px 24px rgba(79,195,247,0.06)",
                  },
                }}
              >
                <Box sx={{ display: "flex" }}>
                  {other.imageUrls?.[0] && (
                    <CardMedia
                      component="img"
                      image={other.imageUrls[0]}
                      alt={other.title}
                      sx={{
                        width: 120,
                        minHeight: 90,
                        objectFit: "cover",
                        display: { xs: "none", sm: "block" },
                      }}
                    />
                  )}
                  <CardContent sx={{ p: 2, flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.25 }}>
                      {other.postType === "report" && (
                        <ReportProblemIcon sx={{ fontSize: 16, color: "warning.main" }} />
                      )}
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {other.title}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {other.authorName} &middot; {formatDate(other.createdAt)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {stripMarkdown(other.body, 120)}
                    </Typography>
                  </CardContent>
                </Box>
              </Card>
            ))}
          </Box>
        </>
      )}

      {/* Lightbox */}
      <Dialog
        open={!!lightboxUrl}
        onClose={() => setLightboxUrl(null)}
        maxWidth="lg"
      >
        <IconButton
          onClick={() => setLightboxUrl(null)}
          sx={{ position: "absolute", top: 8, right: 8, color: "white", zIndex: 1 }}
        >
          <CloseIcon />
        </IconButton>
        {lightboxUrl && (
          <Box
            component="img"
            src={lightboxUrl}
            alt="Fullsize"
            sx={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" }}
          />
        )}
      </Dialog>

      {/* Snackbar for clipboard copy feedback */}
      <Snackbar
        open={!!snackMsg}
        autoHideDuration={2000}
        onClose={() => setSnackMsg("")}
        message={snackMsg}
      />
    </Box>
  );
}
