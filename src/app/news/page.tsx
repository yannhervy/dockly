"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { NewsPost, ReactionMap } from "@/lib/types";
import { REACTION_EMOJIS } from "@/lib/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import AddIcon from "@mui/icons-material/Add";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CloseIcon from "@mui/icons-material/Close";

function formatDate(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function NewsPage() {
  const { firebaseUser, profile } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ title: "", body: "" });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const canCreate =
    profile?.role === "Superadmin" || profile?.role === "Dock Manager";

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    setLoading(true);
    try {
      const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setPosts(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NewsPost)
      );
    } catch (err) {
      console.error("Error fetching news:", err);
      try {
        const snap = await getDocs(collection(db, "news"));
        setPosts(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NewsPost)
        );
      } catch {
        // Ignore
      }
    } finally {
      setLoading(false);
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImageFiles((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [
      ...prev,
      ...files.map((f) => URL.createObjectURL(f)),
    ]);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!firebaseUser || !profile || !canCreate) return;
    setUploading(true);

    try {
      // Upload all images
      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `news_${today}_${Date.now()}.${ext}`;
        const storageRef = ref(storage, `news/${fileName}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        imageUrls.push(url);
      }

      await addDoc(collection(db, "news"), {
        title: form.title,
        body: form.body,
        imageUrls,
        authorId: firebaseUser.uid,
        authorName: profile.name,
        createdAt: Timestamp.now(),
        reactions: {},
      });

      setDialogOpen(false);
      resetForm();
      setSuccess("Nyhet publicerad!");
      setTimeout(() => setSuccess(""), 3000);
      fetchPosts();
    } catch (err) {
      console.error("Error creating news:", err);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setForm({ title: "", body: "" });
    setImageFiles([]);
    setImagePreviews([]);
  };

  const handleReaction = async (postId: string, emoji: string) => {
    if (!firebaseUser) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const reactions: ReactionMap = { ...post.reactions };
    const users = reactions[emoji] || [];

    if (users.includes(firebaseUser.uid)) {
      // Remove reaction
      reactions[emoji] = users.filter((u) => u !== firebaseUser.uid);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      // Add reaction
      reactions[emoji] = [...users, firebaseUser.uid];
    }

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, reactions } : p))
    );

    try {
      await updateDoc(doc(db, "news", postId), { reactions });
    } catch (err) {
      console.error("Error updating reaction:", err);
      fetchPosts(); // Revert on error
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", px: 3, py: 5 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <NewspaperIcon sx={{ fontSize: 36, color: "primary.main" }} />
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Nyheter
          </Typography>
        </Box>
        {canCreate && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            Skapa nyhet
          </Button>
        )}
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 600 }}>
        Senaste nytt från Stegerholmens Hamn.
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : posts.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography color="text.secondary">
            Inga nyheter ännu.
          </Typography>
        </Box>
      ) : (
        posts.map((post) => (
          <Card
            key={post.id}
            sx={{
              mb: 3,
              bgcolor: "rgba(13, 33, 55, 0.6)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(79,195,247,0.08)",
            }}
          >
            <CardContent sx={{ p: 3 }}>
              {/* Title & meta */}
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                {post.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                {post.authorName} · {formatDate(post.createdAt)}
              </Typography>

              {/* Body */}
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ lineHeight: 1.8, mb: 2, whiteSpace: "pre-wrap" }}
              >
                {post.body}
              </Typography>

              {/* Images gallery */}
              {post.imageUrls && post.imageUrls.length > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    flexWrap: "wrap",
                    mb: 2,
                  }}
                >
                  {post.imageUrls.map((url, i) => (
                    <Box
                      key={i}
                      component="img"
                      src={url}
                      alt={`${post.title} - bild ${i + 1}`}
                      sx={{
                        width: post.imageUrls.length === 1 ? "100%" : { xs: "100%", sm: "calc(50% - 4px)" },
                        maxHeight: 400,
                        objectFit: "cover",
                        borderRadius: 2,
                        cursor: "pointer",
                        transition: "transform 0.2s",
                        "&:hover": { transform: "scale(1.01)" },
                      }}
                      onClick={() => window.open(url, "_blank")}
                    />
                  ))}
                </Box>
              )}

              {/* Emoji reactions */}
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                {REACTION_EMOJIS.map((emoji) => {
                  const reactors = post.reactions?.[emoji] || [];
                  const hasReacted = firebaseUser
                    ? reactors.includes(firebaseUser.uid)
                    : false;
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
                            borderColor: hasReacted
                              ? "primary.main"
                              : "rgba(79,195,247,0.15)",
                            bgcolor: hasReacted
                              ? "rgba(79,195,247,0.15)"
                              : "transparent",
                            "&:hover": {
                              bgcolor: "rgba(79,195,247,0.1)",
                            },
                            // Hide emojis with 0 reactions unless user can interact
                            ...(count === 0 && !firebaseUser
                              ? { display: "none" }
                              : {}),
                          }}
                        />
                      </span>
                    </Tooltip>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        ))
      )}

      {/* Create News Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          resetForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Skapa nyhet</DialogTitle>
        <DialogContent>
          {uploading && <LinearProgress sx={{ mb: 2 }} />}

          <TextField
            fullWidth
            label="Rubrik"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            sx={{ mt: 1, mb: 2 }}
          />

          <TextField
            fullWidth
            label="Innehåll"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            multiline
            rows={5}
            sx={{ mb: 2 }}
          />

          {/* Multi-image upload */}
          <Box sx={{ mb: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleImageSelect}
            />
            <Button
              variant="outlined"
              startIcon={<AddPhotoAlternateIcon />}
              onClick={() => fileInputRef.current?.click()}
              fullWidth
              sx={{ textTransform: "none", py: 1.5, borderStyle: "dashed" }}
            >
              Lägg till bilder ({imageFiles.length} valda)
            </Button>

            {/* Image previews */}
            {imagePreviews.length > 0 && (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                {imagePreviews.map((preview, i) => (
                  <Box key={i} sx={{ position: "relative", width: 100, height: 80 }}>
                    <Box
                      component="img"
                      src={preview}
                      alt={`Preview ${i + 1}`}
                      sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: 1,
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => removeImage(i)}
                      sx={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        bgcolor: "error.main",
                        color: "#fff",
                        width: 20,
                        height: 20,
                        "&:hover": { bgcolor: "error.dark" },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); resetForm(); }}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!form.title.trim() || !form.body.trim() || uploading}
          >
            {uploading ? "Laddar upp..." : "Publicera"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
