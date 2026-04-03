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
  deleteDoc,
} from "firebase/firestore";
import { deleteStorageFile } from "@/lib/storage";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { NewsPost } from "@/lib/types";
import ReactionsBar from "@/components/ReactionsBar";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Snackbar from "@mui/material/Snackbar";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShareIcon from "@mui/icons-material/Share";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import Link from "next/link";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

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

/**
 * Extract YouTube video ID from various URL formats.
 */
function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ─── Component ──────────────────────────────────────────────
interface NewsDetailViewProps {
  /** The slug from the URL, e.g. "storm-pa-naset-abc123" */
  slug: string;
}

export default function NewsDetailView({ slug }: NewsDetailViewProps) {
  const router = useRouter();
  const { firebaseUser, profile } = useAuth();

  const [post, setPost] = useState<NewsPost | null>(null);
  const [otherPosts, setOtherPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [snackMsg, setSnackMsg] = useState("");

  // Edit/delete state
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editYoutubeUrl, setEditYoutubeUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Permission check — same as listing page
  const canManage = profile?.role === "Superadmin" || profile?.role === "Dock Manager";
  const canEdit = post ? (canManage || post.authorId === firebaseUser?.uid) : false;
  const canDelete = canEdit;

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


  // Edit handlers
  const openEdit = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditBody(post.body);
    setEditYoutubeUrl(post.youtubeUrl || "");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!post) return;
    setSaving(true);
    try {
      const youtubeUrl = editYoutubeUrl.trim();
      await updateDoc(doc(db, "news", post.id), {
        title: editTitle,
        body: editBody,
        youtubeUrl: youtubeUrl || null,
      });
      setPost({ ...post, title: editTitle, body: editBody, youtubeUrl: youtubeUrl || undefined });
      setEditOpen(false);
      setSnackMsg("Uppdaterad!");
    } catch (err) {
      console.error("Error updating post:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    setDeleting(true);
    try {
      // Delete attached images from storage
      if (post.imageUrls) {
        for (const url of post.imageUrls) {
          await deleteStorageFile(url);
        }
      }
      // Delete attached audio from storage
      if (post.audioUrls) {
        for (const url of post.audioUrls) {
          await deleteStorageFile(url);
        }
      }
      await deleteDoc(doc(db, "news", post.id));
      router.push("/news");
    } catch (err) {
      console.error("Error deleting post:", err);
      setDeleting(false);
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
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                {post.authorPhotoURL ? (
                  <Avatar src={post.authorPhotoURL} alt={post.authorName} sx={{ width: 32, height: 32 }} />
                ) : (
                  <Avatar sx={{ width: 32, height: 32, fontSize: 15, bgcolor: "primary.dark" }}>
                    {post.authorName?.charAt(0)?.toUpperCase()}
                  </Avatar>
                )}
                <Typography variant="body2" color="text.secondary">
                  {post.authorName} &middot; {formatDate(post.createdAt)}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Tooltip title="Dela nyhet">
                <IconButton onClick={handleShare} sx={{ color: "primary.main" }}>
                  <ShareIcon />
                </IconButton>
              </Tooltip>
              {canEdit && (
                <Tooltip title="Redigera">
                  <IconButton onClick={openEdit} sx={{ color: "primary.main" }}>
                    <EditIcon />
                  </IconButton>
                </Tooltip>
              )}
              {canDelete && (
                <Tooltip title="Ta bort">
                  <IconButton onClick={() => setConfirmDeleteOpen(true)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
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

          {/* YouTube embed */}
          {post.youtubeUrl && extractYoutubeId(post.youtubeUrl) && (
            <Box
              sx={{
                position: "relative",
                width: "100%",
                paddingTop: "56.25%",
                mb: 2,
                borderRadius: 2,
                overflow: "hidden",
                bgcolor: "#000",
              }}
            >
              <Box
                component="iframe"
                src={`https://www.youtube.com/embed/${extractYoutubeId(post.youtubeUrl)}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
              />
            </Box>
          )}

          {/* Audio players */}
          {post.audioUrls && post.audioUrls.length > 0 && (
            <Box sx={{ mb: 2, display: "flex", flexDirection: "column", gap: 1 }}>
              {post.audioUrls.map((url, i) => (
                <Box
                  key={i}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "rgba(79,195,247,0.06)",
                    border: "1px solid rgba(79,195,247,0.1)",
                  }}
                >
                  <HeadphonesIcon sx={{ color: "primary.main", fontSize: 22 }} />
                  <Box
                    component="audio"
                    controls
                    preload="metadata"
                    sx={{
                      flex: 1,
                      height: 36,
                      "&::-webkit-media-controls-panel": {
                        bgcolor: "transparent",
                      },
                    }}
                  >
                    <source src={url} type="audio/mpeg" />
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* Reactions */}
          <ReactionsBar
            postId={post.id}
            reactions={post.reactions || {}}
            onReactionsChange={(updated) => setPost((prev) => prev ? { ...prev, reactions: updated } : prev)}
          />
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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      {other.authorPhotoURL ? (
                        <Avatar src={other.authorPhotoURL} alt={other.authorName} sx={{ width: 22, height: 22 }} />
                      ) : (
                        <Avatar sx={{ width: 22, height: 22, fontSize: 11, bgcolor: "primary.dark" }}>
                          {other.authorName?.charAt(0)?.toUpperCase()}
                        </Avatar>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {other.authorName} &middot; {formatDate(other.createdAt)}
                      </Typography>
                    </Box>
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
      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{post?.postType === "report" ? "Redigera rapport" : "Redigera nyhet"}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Rubrik"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <MDEditor value={editBody} onChange={(v) => setEditBody(v || "")} height={300} />
          <TextField
            fullWidth
            label="YouTube-länk (valfritt)"
            placeholder="https://www.youtube.com/watch?v=..."
            value={editYoutubeUrl}
            onChange={(e) => setEditYoutubeUrl(e.target.value)}
            sx={{ mt: 2 }}
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={saving || !editTitle.trim()}
            startIcon={saving ? <CircularProgress size={18} /> : undefined}
          >
            {saving ? "Sparar..." : "Spara"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} maxWidth="xs">
        <DialogTitle>Ta bort {post?.postType === "report" ? "rapport" : "nyhet"}?</DialogTitle>
        <DialogContent>
          <Typography>Är du säker? Detta kan inte ångras.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={18} /> : <DeleteIcon />}
          >
            {deleting ? "Tar bort..." : "Ta bort"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackMsg}
        autoHideDuration={2000}
        onClose={() => setSnackMsg("")}
        message={snackMsg}
      />
    </Box>
  );
}
