"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import type { Dock, BerthInterest, InterestReply } from "@/lib/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import SailingIcon from "@mui/icons-material/Sailing";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import StraightenIcon from "@mui/icons-material/Straighten";
import LoginIcon from "@mui/icons-material/Login";
import HistoryIcon from "@mui/icons-material/History";
import DeleteIcon from "@mui/icons-material/Delete";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

// ─── Helpers ──────────────────────────────────────────────
function formatDate(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(ts: Timestamp): string {
  return ts.toDate().toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusLabel = (s: string) =>
  s === "Pending" ? "Väntande" : s === "Contacted" ? "Kontaktad" : "Avslutad";

const statusColor = (s: string): "warning" | "info" | "success" =>
  s === "Pending" ? "warning" : s === "Contacted" ? "info" : "success";

export default function InterestPage() {
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [docks, setDocks] = useState<Dock[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // User's existing submissions
  const [myInterests, setMyInterests] = useState<BerthInterest[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(false);

  const [form, setForm] = useState({
    boatWidth: "",
    boatLength: "",
    preferredDockId: "",
    phone: "",
    message: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchDocks() {
      try {
        const snap = await getDocs(collection(db, "docks"));
        setDocks(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error("Error fetching docks:", err);
      }
    }
    fetchDocks();
  }, []);

  // Pre-fill phone from profile
  useEffect(() => {
    if (profile?.phone) {
      setForm((prev) => ({ ...prev, phone: profile.phone }));
    }
  }, [profile]);

  // Fetch user's own interest submissions
  useEffect(() => {
    if (!firebaseUser) return;
    async function fetchMyInterests() {
      setLoadingInterests(true);
      try {
        const q = query(
          collection(db, "interests"),
          where("userId", "==", firebaseUser!.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        setMyInterests(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BerthInterest)
        );
      } catch (err) {
        console.error("Error fetching my interests:", err);
        // Fallback without orderBy (index may not exist)
        try {
          const q2 = query(
            collection(db, "interests"),
            where("userId", "==", firebaseUser!.uid)
          );
          const snap = await getDocs(q2);
          setMyInterests(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BerthInterest)
          );
        } catch {
          // Ignore
        }
      } finally {
        setLoadingInterests(false);
      }
    }
    fetchMyInterests();
  }, [firebaseUser, submitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile) return;

    const width = parseFloat(form.boatWidth);
    const length = parseFloat(form.boatLength);

    if (isNaN(width) || isNaN(length) || width <= 0 || length <= 0) {
      setError("Ange giltiga mått för din båts bredd och längd.");
      return;
    }

    setSending(true);
    setError("");

    try {
      let imageUrl: string | null = null;

      // Upload image if selected
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const fileName = `interest_${Date.now()}.${ext}`;
        const storageRef = ref(storage, `interests/${fileName}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "interests"), {
        userId: firebaseUser.uid,
        userName: profile.name,
        email: profile.email || firebaseUser.email,
        phone: form.phone,
        boatWidth: width,
        boatLength: length,
        preferredDockId: form.preferredDockId || null,
        message: form.message || null,
        imageUrl: imageUrl,
        createdAt: Timestamp.now(),
        status: "Pending",
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Error submitting interest:", err);
      setError("Något gick fel. Försök igen.");
    } finally {
      setSending(false);
    }
  };

  // Not logged in
  if (!authLoading && !firebaseUser) {
    return (
      <Box sx={{ maxWidth: 520, mx: "auto", px: 3, py: 8, textAlign: "center" }}>
        <SailingIcon sx={{ fontSize: 56, color: "primary.main", mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Intresseanmälan för båtplats
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Du behöver logga in för att göra en intresseanmälan.
        </Typography>
        <Button
          variant="contained"
          startIcon={<LoginIcon />}
          onClick={() => router.push("/login")}
          sx={{ textTransform: "none", borderRadius: 2 }}
        >
          Logga in
        </Button>
      </Box>
    );
  }

  // Success state after submit
  if (submitted) {
    return (
      <Box sx={{ maxWidth: 520, mx: "auto", px: 3, py: 8, textAlign: "center" }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: "#66BB6A", mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Tack för din intresseanmälan!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Vi har tagit emot din anmälan och återkommer så snart vi har mer
          information om lediga platser.
        </Typography>
        <Button
          variant="outlined"
          onClick={() => setSubmitted(false)}
          sx={{ textTransform: "none", borderRadius: 2, mr: 1 }}
        >
          Skicka en till anmälan
        </Button>
        <Button
          variant="outlined"
          onClick={() => router.push("/")}
          sx={{ textTransform: "none", borderRadius: 2 }}
        >
          Tillbaka till startsidan
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", px: 3, py: 5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <SailingIcon sx={{ fontSize: 36, color: "primary.main" }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Intresseanmälan
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Fyll i formuläret nedan för att anmäla ditt intresse för en båtplats.
        Ange din båts mått så matchar vi dig med rätt plats.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        På grund av våra miljöregler kan vi inte erbjuda plats åt inombordare
        eller båtar med toalett. Då de allra flesta platser är avsedda för båtar
        på max 5 meter ökar dina chanser markant med en båt i den storleken.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card
        sx={{
          bgcolor: "rgba(13, 33, 55, 0.6)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(79,195,247,0.08)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleSubmit}>
            {/* Boat dimensions */}
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, mb: 1.5, color: "primary.light" }}
            >
              Båtens mått
            </Typography>
            <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                label="Bredd"
                type="number"
                required
                value={form.boatWidth}
                onChange={(e) => setForm({ ...form, boatWidth: e.target.value })}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">m</InputAdornment>
                    ),
                    startAdornment: (
                      <InputAdornment position="start">
                        <StraightenIcon fontSize="small" sx={{ color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { step: "0.1", min: "0" },
                }}
              />
              <TextField
                fullWidth
                label="Längd"
                type="number"
                required
                value={form.boatLength}
                onChange={(e) => setForm({ ...form, boatLength: e.target.value })}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">m</InputAdornment>
                    ),
                    startAdornment: (
                      <InputAdornment position="start">
                        <StraightenIcon
                          fontSize="small"
                          sx={{ color: "text.secondary", transform: "rotate(90deg)" }}
                        />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { step: "0.1", min: "0" },
                }}
              />
            </Box>

            {/* Preferred dock */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Önskad brygga (valfritt)</InputLabel>
              <Select
                value={form.preferredDockId}
                label="Önskad brygga (valfritt)"
                onChange={(e) =>
                  setForm({ ...form, preferredDockId: e.target.value })
                }
              >
                <MenuItem value="">Ingen preferens</MenuItem>
                {docks.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Phone */}
            <TextField
              fullWidth
              label="Telefon"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              sx={{ mb: 3 }}
              helperText="Så att vi kan kontakta dig"
            />

            {/* Message */}
            <TextField
              fullWidth
              label="Meddelande (valfritt)"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              multiline
              rows={3}
              sx={{ mb: 3 }}
              placeholder="Övriga önskemål eller information..."
            />

            {/* Boat image upload */}
            <Box sx={{ mb: 3 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }
                }}
              />
              <Button
                variant="outlined"
                startIcon={<AddPhotoAlternateIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
                sx={{
                  textTransform: "none",
                  py: 1.5,
                  borderStyle: "dashed",
                }}
              >
                {imageFile ? imageFile.name : "Lägg till bild på båten (valfritt)"}
              </Button>
              {imagePreview && (
                <Box sx={{ mt: 1, position: "relative" }}>
                  <Box
                    component="img"
                    src={imagePreview}
                    alt="Preview"
                    sx={{
                      width: "100%",
                      maxHeight: 200,
                      objectFit: "cover",
                      borderRadius: 2,
                    }}
                  />
                  <Button
                    size="small"
                    color="error"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    sx={{ position: "absolute", top: 4, right: 4 }}
                  >
                    Ta bort
                  </Button>
                </Box>
              )}
            </Box>

            {sending && <LinearProgress sx={{ mb: 2 }} />}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={sending}
              startIcon={sending ? undefined : <SendIcon />}
              sx={{
                py: 1.5,
                textTransform: "none",
                borderRadius: 2,
                fontSize: "1rem",
              }}
            >
              {sending ? "Skickar..." : "Skicka intresseanmälan"}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* User's existing submissions */}
      {firebaseUser && (
        <Box sx={{ mt: 5 }}>
          <Divider sx={{ mb: 3 }} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <HistoryIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Mina anmälningar
            </Typography>
          </Box>

          {loadingInterests ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : myInterests.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
              Du har inga tidigare intresseanmälningar.
            </Typography>
          ) : (
            myInterests.map((interest) => (
              <InterestCard
                key={interest.id}
                interest={interest}
                docks={docks}
                onDelete={async (id) => {
                  await deleteDoc(doc(db, "interests", id));
                  setMyInterests((prev) => prev.filter((i) => i.id !== id));
                }}
              />
            ))
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── User's Interest Card with Replies ────────────────────
function InterestCard({
  interest,
  docks,
  onDelete,
}: {
  interest: BerthInterest;
  docks: Dock[];
  onDelete: (id: string) => Promise<void>;
}) {
  const [replies, setReplies] = useState<InterestReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchReplies() {
      setLoadingReplies(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "interests", interest.id, "replies"),
            orderBy("createdAt", "asc")
          )
        );
        setReplies(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InterestReply));
      } catch {
        try {
          const snap = await getDocs(
            collection(db, "interests", interest.id, "replies")
          );
          setReplies(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InterestReply));
        } catch {
          // Ignore
        }
      } finally {
        setLoadingReplies(false);
      }
    }
    fetchReplies();
  }, [interest.id]);

  const getDockName = (dockId?: string) =>
    dockId ? docks.find((d) => d.id === dockId)?.name || "—" : "Ingen preferens";

  return (
    <Card
      sx={{
        mb: 2,
        bgcolor: "rgba(13, 33, 55, 0.6)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(79,195,247,0.08)",
      }}
    >
      {interest.imageUrl && (
        <Box
          component="img"
          src={interest.imageUrl}
          alt="Båtbild"
          sx={{
            width: "100%",
            height: 160,
            objectFit: "cover",
          }}
        />
      )}
      <CardContent sx={{ p: 2.5 }}>
        {/* Header */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {interest.boatWidth} × {interest.boatLength} m
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              label={statusLabel(interest.status)}
              size="small"
              color={statusColor(interest.status)}
            />
            <IconButton
              size="small"
              onClick={() => setConfirmDelete(true)}
              sx={{ color: "error.main" }}
              title="Ta bort anmälan"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Delete confirmation dialog */}
        <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
          <DialogTitle>Ta bort intresseanmälan?</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              Är du säker på att du vill ta bort denna intresseanmälan? Detta kan inte ångras.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDelete(false)}>Avbryt</Button>
            <Button
              color="error"
              variant="contained"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await onDelete(interest.id);
                } finally {
                  setDeleting(false);
                  setConfirmDelete(false);
                }
              }}
            >
              {deleting ? "Tar bort..." : "Ta bort"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Details */}
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Brygga: {getDockName(interest.preferredDockId)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Skickat: {formatDate(interest.createdAt)}
          </Typography>
        </Box>

        {interest.message && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: "italic" }}>
            &quot;{interest.message}&quot;
          </Typography>
        )}

        {/* Replies */}
        {loadingReplies ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
            <CircularProgress size={20} />
          </Box>
        ) : replies.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.light", mb: 1, display: "block" }}>
              Svar ({replies.length})
            </Typography>
            {replies.map((reply) => (
              <Box
                key={reply.id}
                sx={{
                  mb: 1.5,
                  p: 1.5,
                  bgcolor: "rgba(79,195,247,0.04)",
                  borderRadius: 1.5,
                  border: "1px solid rgba(79,195,247,0.1)",
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {reply.authorName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(reply.createdAt)}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mb: 1 }}>
                  {reply.message}
                </Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                  {reply.authorEmail && (
                    <Typography variant="caption" color="text.secondary">
                      📧 {reply.authorEmail}
                    </Typography>
                  )}
                  {reply.authorPhone && (
                    <Typography variant="caption" color="text.secondary">
                      📱 {reply.authorPhone}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
