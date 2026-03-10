"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import ImagePickerDialog from "@/components/ImagePickerDialog";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  arrayUnion,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { resizeImage, deleteStorageFile } from "@/lib/storage";
import { useAuth } from "@/context/AuthContext";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";
import type { Dock, Berth, BerthInterest, InterestReply, OfferedBerth, User } from "@/lib/types";
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
  return ts.toDate().toLocaleDateString("sv-SE");
}

function formatDateTime(ts: Timestamp): string {
  return ts.toDate().toLocaleString("sv-SE");
}

const statusLabel = (s: string) =>
  s === "Pending" ? "Väntande" : s === "Contacted" ? "Kontaktad" : "Avslutad";

const statusColor = (s: string): "warning" | "info" | "success" =>
  s === "Pending" ? "warning" : s === "Contacted" ? "info" : "success";

export default function InterestPage() {
  return (
    <Suspense fallback={null}>
      <InterestPageInner />
    </Suspense>
  );
}

function InterestPageInner() {
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [docks, setDocks] = useState<Dock[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Available berths for the selected docks
  const [availableBerths, setAvailableBerths] = useState<Berth[]>([]);
  const [loadingBerths, setLoadingBerths] = useState(false);

  // User's existing submissions
  const [myInterests, setMyInterests] = useState<BerthInterest[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(false);

  const [form, setForm] = useState({
    boatWidth: "",
    boatLength: "",
    preferredDockIds: [] as string[],
    preferredBerthIds: [] as string[],
    phone: "",
    message: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const paramsApplied = useRef(false);

  // Helper: replace comma with dot for Swedish decimal input
  const handleDecimalInput = (field: "boatWidth" | "boatLength") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(",", ".");
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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

  // Pre-fill from URL query params (e.g. from map)
  useEffect(() => {
    if (paramsApplied.current || docks.length === 0) return;
    const qDock = searchParams.get("dockId");
    const qBerth = searchParams.get("berthId");
    if (qDock) {
      setForm((prev) => ({
        ...prev,
        preferredDockIds: [qDock],
        preferredBerthIds: qBerth ? [qBerth] : [],
      }));
      paramsApplied.current = true;
    }
  }, [searchParams, docks]);

  // Fetch available berths when selected docks change
  useEffect(() => {
    if (form.preferredDockIds.length === 0) {
      setAvailableBerths([]);
      return;
    }
    async function fetchBerths() {
      setLoadingBerths(true);
      try {
        // Firestore 'in' operator supports up to 30 values
        const q = query(
          collection(db, "resources"),
          where("type", "==", "Berth"),
          where("dockId", "in", form.preferredDockIds)
        );
        const snap = await getDocs(q);
        const berths = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Berth)
          .filter((b) => b.status === "Available")
          .sort((a, b) => a.berthNumber - b.berthNumber);
        setAvailableBerths(berths);
      } catch (err) {
        console.error("Error fetching berths:", err);
        setAvailableBerths([]);
      } finally {
        setLoadingBerths(false);
      }
    }
    fetchBerths();
    // Clear berth selections that no longer match selected docks
    setForm((prev) => {
      const validBerthIds = availableBerths
        .filter((b) => prev.preferredDockIds.includes(b.dockId))
        .map((b) => b.id);
      const filtered = prev.preferredBerthIds.filter((id) => validBerthIds.includes(id));
      return filtered.length !== prev.preferredBerthIds.length
        ? { ...prev, preferredBerthIds: filtered }
        : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.preferredDockIds.join(",")]);

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

    const width = parseFloat(form.boatWidth.replace(",", "."));
    const length = parseFloat(form.boatLength.replace(",", "."));

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
        const resizedBlob = await resizeImage(imageFile);
        await uploadBytes(storageRef, resizedBlob, { contentType: "image/jpeg" });
        imageUrl = await getDownloadURL(storageRef);
      }

      // Build dock names for notifications
      const selectedDockNames = form.preferredDockIds
        .map((id) => docks.find((d) => d.id === id)?.name)
        .filter(Boolean)
        .join(", ");

      const selectedBerthCodes = form.preferredBerthIds
        .map((id) => availableBerths.find((b) => b.id === id)?.markingCode)
        .filter(Boolean)
        .join(", ");

      await addDoc(collection(db, "interests"), {
        userId: firebaseUser.uid,
        userName: profile.name,
        email: profile.email || firebaseUser.email,
        phone: form.phone,
        boatWidth: width,
        boatLength: length,
        preferredDockIds: form.preferredDockIds.length > 0 ? form.preferredDockIds : null,
        preferredBerthIds: form.preferredBerthIds.length > 0 ? form.preferredBerthIds : null,
        // Legacy single fields (first selection for backward compat)
        preferredDockId: form.preferredDockIds[0] || null,
        preferredBerthId: form.preferredBerthIds[0] || null,
        message: form.message || null,
        imageUrl: imageUrl,
        createdAt: Timestamp.now(),
        status: "Pending",
      });

      // ── Notifications ──
      const emailBody = `
        <h2>Ny intresseanmälan</h2>
        <p><strong>${profile.name}</strong> har skickat en intresseanmälan.</p>
        <ul>
          <li><strong>Båtmått:</strong> ${width} × ${length} m</li>
          ${selectedDockNames ? `<li><strong>Önskade bryggor:</strong> ${selectedDockNames}</li>` : ""}
          ${selectedBerthCodes ? `<li><strong>Önskade platser:</strong> ${selectedBerthCodes}</li>` : ""}
          <li><strong>Telefon:</strong> ${form.phone || "—"}</li>
          <li><strong>E-post:</strong> ${profile.email || firebaseUser.email || "—"}</li>
          ${form.message ? `<li><strong>Meddelande:</strong> ${form.message}</li>` : ""}
        </ul>
      `.trim();

      // 1. Email to dock managers for selected docks
      const managerIds = new Set<string>();
      for (const dockId of form.preferredDockIds) {
        const dock = docks.find((d) => d.id === dockId);
        if (dock?.managerIds) {
          dock.managerIds.forEach((id) => managerIds.add(id));
        }
      }
      if (managerIds.size > 0) {
        // Fetch manager emails
        const managerEmails: string[] = [];
        await Promise.all(
          [...managerIds].map(async (uid) => {
            try {
              const uSnap = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
              uSnap.docs.forEach((d) => {
                const email = d.data().email;
                if (email) managerEmails.push(email);
              });
            } catch { /* ignore */ }
          })
        );
        if (managerEmails.length > 0) {
          try {
            await sendEmail(
              managerEmails,
              `Ny intresseanmälan${selectedDockNames ? ` för ${selectedDockNames}` : ""}`,
              emailBody
            );
          } catch (e) { console.error("Email to managers failed:", e); }
        }
      }

      // 2. SMS + email to superadmins only
      try {
        const saSnap = await getDocs(query(collection(db, "users"), where("role", "==", "Superadmin")));
        const saPhones: string[] = [];
        const saEmails: string[] = [];
        saSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.phone) saPhones.push(data.phone);
          if (data.email) saEmails.push(data.email);
        });
        const smsText = `Ny intresseanmälan från ${profile.name}: ${width}×${length}m${selectedDockNames ? `, brygga ${selectedDockNames}` : ""}. Tel: ${form.phone || "—"}`;
        if (saPhones.length > 0) {
          try { await sendSms(saPhones, smsText); }
          catch (e) { console.error("SMS to superadmins failed:", e); }
        }
        if (saEmails.length > 0) {
          // Don't duplicate emails already sent to dock managers
          const uniqueSaEmails = saEmails.filter((e) => !managerIds.has(e));
          if (uniqueSaEmails.length > 0) {
            try {
              await sendEmail(
                uniqueSaEmails,
                `Ny intresseanmälan${selectedDockNames ? ` för ${selectedDockNames}` : ""}`,
                emailBody
              );
            } catch (e) { console.error("Email to superadmins failed:", e); }
          }
        }
      } catch (e) { console.error("Superadmin notification failed:", e); }

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
                type="text"
                inputMode="decimal"
                required
                value={form.boatWidth}
                onChange={handleDecimalInput("boatWidth")}
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
                }}
                placeholder="t.ex. 2,1"
              />
              <TextField
                fullWidth
                label="Längd"
                type="text"
                inputMode="decimal"
                required
                value={form.boatLength}
                onChange={handleDecimalInput("boatLength")}
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
                }}
                placeholder="t.ex. 4,5"
              />
            </Box>

            {/* Preferred docks (multi-select) */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Önskade bryggor (valfritt)</InputLabel>
              <Select
                multiple
                value={form.preferredDockIds}
                label="Önskade bryggor (valfritt)"
                onChange={(e) => {
                  const value = e.target.value;
                  setForm({
                    ...form,
                    preferredDockIds: typeof value === "string" ? value.split(",") : value,
                  });
                }}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(selected as string[]).map((id) => {
                      const dock = docks.find((d) => d.id === id);
                      return <Chip key={id} label={dock?.name || id} size="small" />;
                    })}
                  </Box>
                )}
              >
                {docks.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Available berths for the selected docks (multi-select) */}
            {form.preferredDockIds.length > 0 && (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Lediga platser (valfritt)</InputLabel>
                <Select
                  multiple
                  value={form.preferredBerthIds}
                  label="Lediga platser (valfritt)"
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm({
                      ...form,
                      preferredBerthIds: typeof value === "string" ? value.split(",") : value,
                    });
                  }}
                  disabled={loadingBerths}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {(selected as string[]).map((id) => {
                        const berth = availableBerths.find((b) => b.id === id);
                        return <Chip key={id} label={berth?.markingCode || id} size="small" />;
                      })}
                    </Box>
                  )}
                >
                  {availableBerths.length === 0 && !loadingBerths && (
                    <MenuItem disabled>Inga lediga platser just nu</MenuItem>
                  )}
                  {availableBerths.map((b) => {
                    const dock = docks.find((d) => d.id === b.dockId);
                    return (
                      <MenuItem key={b.id} value={b.id}>
                        {dock?.name ? `${dock.name} — ` : ""}Plats {b.markingCode}{b.width && b.length ? ` (${b.length}×${b.width}m)` : ""}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            )}

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
              <ImagePickerDialog
                open={imagePickerOpen}
                onClose={() => setImagePickerOpen(false)}
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
                onClick={() => setImagePickerOpen(true)}
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
                  const interest = myInterests.find((i) => i.id === id);
                  if (interest?.imageUrl) await deleteStorageFile(interest.imageUrl);
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
  const { firebaseUser, profile } = useAuth();
  const [replies, setReplies] = useState<InterestReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [localInterest, setLocalInterest] = useState(interest);
  const [pendingAccept, setPendingAccept] = useState<{ ob: OfferedBerth; reply: InterestReply } | null>(null);

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

  const getDockNames = () => {
    // Support both new multi-dock and legacy single-dock
    const ids = interest.preferredDockIds?.length
      ? interest.preferredDockIds
      : interest.preferredDockId ? [interest.preferredDockId] : [];
    if (ids.length === 0) return "Ingen preferens";
    return ids.map((id) => docks.find((d) => d.id === id)?.name || id).join(", ");
  };

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
            Bryggor: {getDockNames()}
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
            {replies.map((reply) => {
              const offeredBerths: OfferedBerth[] = reply.offeredBerths
                ?? (reply.offeredBerthId
                  ? [{ berthId: reply.offeredBerthId, berthCode: reply.offeredBerthCode || reply.offeredBerthId, dockName: reply.offeredDockName || "", price: reply.offeredPrice }]
                  : []);
              const isOffer = offeredBerths.length > 0;
              const isResolved = localInterest.status === "Resolved";
              const isAccepted = reply.offerStatus === "accepted";
              const isDeclined = reply.offerStatus === "declined";
              return (
              <Box
                key={reply.id}
                sx={{
                  mb: 1.5,
                  p: 1.5,
                  bgcolor: isOffer
                    ? isAccepted ? "rgba(102, 187, 106, 0.12)" : isDeclined ? "rgba(255,255,255,0.03)" : "rgba(102, 187, 106, 0.06)"
                    : "rgba(79,195,247,0.04)",
                  borderRadius: 1.5,
                  border: isOffer
                    ? isAccepted ? "1px solid rgba(102, 187, 106, 0.3)" : isDeclined ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(102, 187, 106, 0.2)"
                    : "1px solid rgba(79,195,247,0.1)",
                  opacity: isDeclined ? 0.5 : 1,
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {reply.authorName}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {reply.offerStatus && (
                      <Chip
                        label={
                          reply.offerStatus === "pending" ? "Anbud"
                          : reply.offerStatus === "accepted" ? "Accepterat"
                          : "Avböjt"
                        }
                        size="small"
                        color={
                          reply.offerStatus === "pending" ? "info"
                          : reply.offerStatus === "accepted" ? "success"
                          : "default"
                        }
                        variant={reply.offerStatus === "pending" ? "filled" : "outlined"}
                      />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(reply.createdAt)}
                    </Typography>
                  </Box>
                </Box>
                {/* Multi-berth offer cards */}
                {isOffer && (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1 }}>
                    {offeredBerths.map((ob) => (
                      <Box
                        key={ob.berthId}
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: "rgba(102, 187, 106, 0.08)",
                          border: "1px solid rgba(102, 187, 106, 0.15)",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            ⚓ {ob.berthCode}
                          </Typography>
                          {ob.dockName && (
                            <Typography variant="body2" color="text.secondary">
                              {ob.dockName}
                            </Typography>
                          )}
                          {ob.price != null && (
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "#66BB6A" }}>
                              {ob.price.toLocaleString("sv-SE")} kr/år
                            </Typography>
                          )}
                          {isAccepted && localInterest.acceptedBerthId === ob.berthId && (
                            <Chip label="Accepterat" size="small" color="success" />
                          )}
                        </Box>
                        {reply.offerStatus === "pending" && !isResolved && (
                          <Button
                            variant="contained"
                            size="small"
                            color="success"
                            disabled={accepting}
                            sx={{ mt: 1, textTransform: "none", fontWeight: 700 }}
                            onClick={() => setPendingAccept({ ob, reply })}
                          >
                            {accepting ? "Accepterar..." : `✅ Acceptera ${ob.berthCode}`}
                          </Button>
                        )}
                      </Box>
                    ))}
                    {isDeclined && (
                      <Chip label="Avböjt" size="small" variant="outlined" sx={{ alignSelf: "flex-start" }} />
                    )}
                  </Box>
                )}
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
              );
            })}
          </Box>
        )}
      </CardContent>

      {/* Accept offer confirmation dialog */}
      <Dialog open={!!pendingAccept} onClose={() => setPendingAccept(null)}>
        <DialogTitle>Acceptera plats?</DialogTitle>
        <DialogContent>
          <Typography>
            Vill du acceptera platsen <strong>{pendingAccept?.ob.berthCode}</strong>?
            Du kommer automatiskt sättas upp på platsen.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingAccept(null)} disabled={accepting}>Avbryt</Button>
          <Button
            variant="contained"
            color="success"
            disabled={accepting}
            onClick={async () => {
              if (!pendingAccept) return;
              const { ob, reply } = pendingAccept;
              setAccepting(true);
              try {
                // 1. Update berth: set occupied + add user + write tenant data
                const berthUpdate: Record<string, unknown> = {
                  status: "Occupied",
                  occupantIds: arrayUnion(firebaseUser!.uid),
                  tenants: arrayUnion({
                    uid: firebaseUser!.uid,
                    name: profile?.name || "",
                    phone: profile?.phone || "",
                    email: profile?.email || "",
                  }),
                  invoiceResponsibleId: firebaseUser!.uid,
                };
                if (ob.price != null) {
                  berthUpdate[`prices.${new Date().getFullYear()}`] = ob.price;
                }
                await updateDoc(doc(db, "resources", ob.berthId), berthUpdate);
                // 2. Mark interest as resolved
                await updateDoc(doc(db, "interests", interest.id), {
                  status: "Resolved",
                  acceptedOfferId: reply.id,
                  acceptedBerthId: ob.berthId,
                  acceptedBerthCode: ob.berthCode,
                });
                // 3. Update all offer replies
                const allRepliesSnap = await getDocs(collection(db, "interests", interest.id, "replies"));
                const batch = writeBatch(db);
                const otherManagerPhones: string[] = [];
                let winnerPhone = "";
                allRepliesSnap.docs.forEach((rDoc) => {
                  const rData = rDoc.data();
                  if (rData.offeredBerths?.length || rData.offeredBerthId) {
                    if (rDoc.id === reply.id) {
                      batch.update(rDoc.ref, { offerStatus: "accepted" });
                      winnerPhone = rData.authorPhone || "";
                    } else {
                      batch.update(rDoc.ref, { offerStatus: "declined" });
                      if (rData.authorPhone) otherManagerPhones.push(rData.authorPhone);
                    }
                  }
                });
                await batch.commit();
                // 4. SMS to winning manager
                if (winnerPhone) {
                  try { await sendSms(winnerPhone, `${profile?.name || "En användare"} har accepterat ditt erbjudande på plats ${ob.berthCode}. Kontakt: ${profile?.phone || profile?.email || ""}`); }
                  catch (e) { console.error("SMS to winner failed:", e); }
                }
                // 5. SMS to other managers
                if (otherManagerPhones.length > 0) {
                  try { await sendSms(otherManagerPhones, `${profile?.name || "En användare"} har valt en annan plats (${ob.berthCode}) för sin intresseanmälan.`); }
                  catch (e) { console.error("SMS to others failed:", e); }
                }
                // 6. Update local state
                setLocalInterest((prev) => ({ ...prev, status: "Resolved" as const, acceptedOfferId: reply.id, acceptedBerthId: ob.berthId, acceptedBerthCode: ob.berthCode }));
                setReplies((prev) => prev.map((r) => (r.offeredBerths?.length || r.offeredBerthId) ? { ...r, offerStatus: r.id === reply.id ? "accepted" as const : "declined" as const } : r));
                setPendingAccept(null);
              } catch (err) {
                console.error("Error accepting offer:", err);
                alert("Något gick fel vid acceptering. Försök igen.");
              } finally {
                setAccepting(false);
              }
            }}
          >
            {accepting ? "Accepterar..." : "Ja, acceptera"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
