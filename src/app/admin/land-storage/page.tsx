"use client";

import React, { useEffect, useState, useMemo } from "react";
import ImagePickerDialog from "@/components/ImagePickerDialog";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { uploadLandStorageImage } from "@/lib/storage";
import { LandStorageEntry, User, InternalComment, ResourcePayment, PaymentPeriod } from "@/lib/types";
import InternalCommentsPanel from "@/components/InternalCommentsPanel";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import PaymentIcon from "@mui/icons-material/Payment";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import ProtectedRoute from "@/components/ProtectedRoute";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid";
import Autocomplete from "@mui/material/Autocomplete";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import SearchIcon from "@mui/icons-material/Search";
import ConstructionIcon from "@mui/icons-material/Construction";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import QrCodeIcon from "@mui/icons-material/QrCode";
import PersonIcon from "@mui/icons-material/Person";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import PublicIcon from "@mui/icons-material/Public";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { APIProvider, Map as GMap, AdvancedMarker } from "@vis.gl/react-google-maps";
import { HARBOR_CENTER } from "@/lib/mapUtils";
import PlaceIcon from "@mui/icons-material/Place";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import { extractExifGps } from "@/lib/exifGps";

export default function LandStoragePage() {
  return (
    <ProtectedRoute allowedRoles={["Superadmin", "Dock Manager"]}>
      <LandStorageContent />
    </ProtectedRoute>
  );
}

type FilterStatus = "all" | "Available" | "Occupied";

function LandStorageContent() {
  const { isSuperadmin, isDockManager, firebaseUser } = useAuth();
  const canEdit = isSuperadmin || isDockManager;
  const isTouchDevice = useMediaQuery("(pointer: coarse)");

  const [entries, setEntries] = useState<LandStorageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [editEntry, setEditEntry] = useState<LandStorageEntry | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    comment: "",
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editInternalComments, setEditInternalComments] = useState<InternalComment[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [editLat, setEditLat] = useState<number | undefined>(undefined);
  const [editLng, setEditLng] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | undefined>(undefined);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  // Payment state
  const [editPayments, setEditPayments] = useState<ResourcePayment[]>([]);
  const [paymentYear, setPaymentYear] = useState<number>(new Date().getFullYear());
  const [paymentPeriod, setPaymentPeriod] = useState<PaymentPeriod>("Summer");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  // Fetch all land storage entries
  useEffect(() => {
    async function fetchEntries() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "landStorage"));
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as LandStorageEntry
        );
        // Sort: occupied first, then by code
        data.sort((a, b) => {
          if (a.status !== b.status) {
            return a.status === "Occupied" ? -1 : 1;
          }
          return a.code.localeCompare(b.code);
        });
        setEntries(data);
      } catch (err) {
        console.error("Error fetching land storage:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEntries();
  }, []);

  // Filter and search
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      // Status filter
      if (filterStatus !== "all" && e.status !== filterStatus) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.code.toLowerCase().includes(q) ||
          (e.firstName && e.firstName.toLowerCase().includes(q)) ||
          (e.lastName && e.lastName.toLowerCase().includes(q)) ||
          (e.phone && e.phone.toLowerCase().includes(q)) ||
          (e.comment && e.comment.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [entries, search, filterStatus]);

  // Stats
  const totalCount = entries.length;
  const occupiedCount = entries.filter((e) => e.status === "Occupied").length;
  const availableCount = totalCount - occupiedCount;
  const activeCount = entries.filter((e) => e.lat && e.lng).length;
  const withBoatImageCount = entries.filter((e) => !!e.imageUrl).length;
  const withCodeImageCount = entries.filter((e) => !!e.codeImageUrl).length;

  // Edit dialog handlers
  const handleEditOpen = async (entry: LandStorageEntry) => {
    setEditEntry(entry);
    setEditForm({
      firstName: entry.firstName || "",
      lastName: entry.lastName || "",
      phone: entry.phone || "",
      email: entry.email || "",
      comment: entry.comment || "",
    });
    setSelectedUserId(entry.occupantId || null);
    setEditInternalComments(entry.internalComments || []);
    setEditLat(entry.lat);
    setEditLng(entry.lng);
    setEditImageUrl(entry.imageUrl);
    setEditImageFile(null);
    setShowPaymentForm(false);
    setPaymentNote("");
    setPaymentAmount("");

    // Fetch payments subcollection
    try {
      const paySnap = await getDocs(collection(db, "landStorage", entry.code, "payments"));
      const payments = paySnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ResourcePayment);
      payments.sort((a, b) => (b.year - a.year) || (a.period === "Winter" ? -1 : 1));
      setEditPayments(payments);
    } catch (err) {
      console.error("Error fetching payments:", err);
      setEditPayments([]);
    }

    // Fetch users list if not loaded yet
    if (allUsers.length === 0) {
      try {
        const snap = await getDocs(collection(db, "users"));
        setAllUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as User));
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    }
  };

  const handleEditSave = async () => {
    if (!editEntry) return;
    setSaving(true);
    try {
      const isOccupied = editForm.firstName.trim().length > 0;

      // Upload image if a new file was selected
      let imageUrl = editImageUrl;
      if (editImageFile) {
        imageUrl = await uploadLandStorageImage(editImageFile, editEntry.code);
      }

      await updateDoc(doc(db, "landStorage", editEntry.code), {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        comment: editForm.comment.trim(),
        status: isOccupied ? "Occupied" : "Available",
        occupantId: selectedUserId || null,
        lat: editLat ?? null,
        lng: editLng ?? null,
        imageUrl: imageUrl ?? null,
        internalComments: editInternalComments,
        updatedAt: Timestamp.now(),
      });
      // Update local state
      setEntries((prev) =>
        prev.map((e) =>
          e.code === editEntry.code
            ? {
                ...e,
                ...editForm,
                status: isOccupied ? "Occupied" : "Available",
                occupantId: selectedUserId || undefined,
                lat: editLat,
                lng: editLng,
                imageUrl: imageUrl,
                internalComments: editInternalComments,
              }
            : e
        )
      );
      setSuccessMsg(`Code ${editEntry.code} updated successfully!`);
      setTimeout(() => setSuccessMsg(""), 4000);
      setEditEntry(null);
    } catch (err) {
      console.error("Error updating entry:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async () => {
    if (!editEntry) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "landStorage", editEntry.code), {
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        comment: "",
        status: "Available",
        paymentStatus: "Unpaid",
        occupantId: null,
        lat: null,
        lng: null,
        updatedAt: Timestamp.now(),
      });
      setEntries((prev) =>
        prev.map((e) =>
          e.code === editEntry.code
            ? {
                ...e,
                firstName: "",
                lastName: "",
                phone: "",
                email: "",
                comment: "",
                status: "Available" as const,
                paymentStatus: "Unpaid" as const,
                occupantId: undefined,
                lat: undefined,
                lng: undefined,
              }
            : e
        )
      );
      setSuccessMsg(`Code ${editEntry.code} released!`);
      setTimeout(() => setSuccessMsg(""), 4000);
      setEditEntry(null);
    } catch (err) {
      console.error("Error releasing entry:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <ConstructionIcon sx={{ color: "primary.main" }} />
          Land Storage
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage land storage codes for boat and trailer storage.
        </Typography>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      {/* Stats cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.main" }}>
                {totalCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Codes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: "warning.main" }}>
                {occupiedCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Occupied
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: "success.main" }}>
                {availableCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Available
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: "info.main" }}>
                {activeCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active (GPS)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: withBoatImageCount === activeCount ? "success.main" : "warning.main" }}>
                {withBoatImageCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Boat Photo
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: withCodeImageCount === activeCount ? "success.main" : "warning.main" }}>
                {withCodeImageCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Code Photo
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search + filter bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
            <TextField
              size="small"
              placeholder="Search by code, name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 200 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <ToggleButtonGroup
              size="small"
              value={filterStatus}
              exclusive
              onChange={(_, val) => val && setFilterStatus(val)}
            >
              <ToggleButton value="all">All ({totalCount})</ToggleButton>
              <ToggleButton value="Occupied">Occupied ({occupiedCount})</ToggleButton>
              <ToggleButton value="Available">Available ({availableCount})</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </CardContent>
      </Card>

      {/* Main table */}
      <Card>
        <TableContainer component={Paper} sx={{ bgcolor: "transparent", backgroundImage: "none" }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
              <Typography>No entries found.</Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>GPS</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Båtbild</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Kodbild</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Comment</TableCell>
                  {canEdit && (
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Actions
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow
                    key={entry.code}
                    sx={{
                      "&:hover": { bgcolor: "rgba(79, 195, 247, 0.04)" },
                      opacity: entry.status === "Available" ? 0.6 : 1,
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: 15,
                          }}
                        >
                          {entry.code}
                        </Typography>
                        {entry.lat && entry.lng && (
                          <Tooltip title="Has map position">
                            <PublicIcon sx={{ fontSize: 16, color: "success.main" }} />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={
                          entry.status === "Occupied" ? (
                            <CancelIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <CheckCircleIcon sx={{ fontSize: 16 }} />
                          )
                        }
                        label={entry.status === "Occupied" ? "Occupied" : "Available"}
                        size="small"
                        color={entry.status === "Occupied" ? "warning" : "success"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {entry.firstName
                          ? `${entry.firstName} ${entry.lastName}`.trim()
                          : "—"}
                        {entry.status === "Occupied" && (
                          <Tooltip
                            title={
                              entry.occupantId
                                ? "Connected to a registered user"
                                : "Not linked to any user account"
                            }
                          >
                            {entry.occupantId ? (
                              <LinkIcon
                                sx={{ fontSize: 16, color: "success.main", ml: 0.5 }}
                              />
                            ) : (
                              <LinkOffIcon
                                sx={{ fontSize: 16, color: "text.disabled", ml: 0.5 }}
                              />
                            )}
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {entry.phone || "—"}
                    </TableCell>
                    <TableCell align="center">
                      {entry.lat && entry.lng ? (
                        <Tooltip title={`${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}`}>
                          <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />
                        </Tooltip>
                      ) : (
                        <CancelIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {entry.imageUrl ? (
                        <Tooltip title="Båtbild uppladdad">
                          <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />
                        </Tooltip>
                      ) : (
                        <CancelIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {entry.codeImageUrl ? (
                        <Tooltip title="Kodbild uppladdad">
                          <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />
                        </Tooltip>
                      ) : (
                        <CancelIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 300,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.comment || "—"}
                      </Typography>
                    </TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleEditOpen(entry)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Card>

      {/* Edit dialog */}
      <Dialog
        open={!!editEntry}
        onClose={() => setEditEntry(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Code: {editEntry?.code}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {/* User picker */}
          <Autocomplete
            options={allUsers}
            getOptionLabel={(u) => `${u.name} (${u.email})`}
            value={allUsers.find((u) => u.id === selectedUserId) || null}
            onChange={(_, user) => {
              if (user) {
                setSelectedUserId(user.id);
                // Auto-fill from selected user
                const [first, ...rest] = (user.name || "").split(" ");
                setEditForm({
                  ...editForm,
                  firstName: first || "",
                  lastName: rest.join(" ") || "",
                  phone: user.phone || editForm.phone,
                  email: user.email || editForm.email,
                });
              } else {
                setSelectedUserId(null);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Link to existing user (optional)"
                placeholder="Search by name or email..."
                sx={{ mb: 2, mt: 0.5 }}
                helperText={selectedUserId ? "Linked — details auto-filled from user" : "Leave empty to enter details manually"}
              />
            )}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            noOptionsText="No users found"
          />

          <Divider sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {selectedUserId ? "Auto-filled from linked user" : "Manual entry"}
            </Typography>
          </Divider>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="First Name"
                value={editForm.firstName}
                onChange={(e) =>
                  setEditForm({ ...editForm, firstName: e.target.value })
                }
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Last Name"
                value={editForm.lastName}
                onChange={(e) =>
                  setEditForm({ ...editForm, lastName: e.target.value })
                }
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Phone"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value })
                }
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Comment"
                value={editForm.comment}
                onChange={(e) =>
                  setEditForm({ ...editForm, comment: e.target.value })
                }
                multiline
                rows={2}
              />
            </Grid>
          </Grid>

          {/* Photo upload */}
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>
            Photo
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            {(editImageFile || editImageUrl) && (
              <Box
                component="img"
                src={editImageFile ? URL.createObjectURL(editImageFile) : editImageUrl}
                alt="Land storage photo"
                sx={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 1, border: '1px solid rgba(79,195,247,0.2)' }}
              />
            )}
            <ImagePickerDialog
              open={imagePickerOpen}
              onClose={() => setImagePickerOpen(false)}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setEditImageFile(file);

                // Extract EXIF GPS if no position is set yet
                if (!editLat && !editLng) {
                  const gps = await extractExifGps(file);
                  if (gps) {
                    setEditLat(gps.lat);
                    setEditLng(gps.lng);
                    setSuccessMsg("GPS-position har h\u00e4mtats fr\u00e5n bilden. Kontrollera och justera positionen vid behov.");
                    setTimeout(() => setSuccessMsg(""), 6000);
                  }
                }
              }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setImagePickerOpen(true)}
              >
                {editImageUrl || editImageFile ? 'Change photo' : 'Upload photo'}
              </Button>
              {(editImageUrl || editImageFile) && (
                <Button
                  size="small"
                  color="error"
                  onClick={() => { setEditImageUrl(undefined); setEditImageFile(null); }}
                >
                  Remove
                </Button>
              )}
            </Box>
          </Box>

          {/* Map location picker */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              <PlaceIcon sx={{ fontSize: 18, verticalAlign: "text-bottom", mr: 0.5 }} />
              Location — click on the map to place
            </Typography>
            {isTouchDevice && (
              <Button
                size="small"
                startIcon={<MyLocationIcon />}
                onClick={() => {
                  if (!navigator.geolocation) return;
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setEditLat(pos.coords.latitude);
                      setEditLng(pos.coords.longitude);
                    },
                    (err) => console.error("GPS error:", err),
                    { enableHighAccuracy: true }
                  );
                }}
              >
                Use my GPS
              </Button>
            )}
          </Box>
          <Box sx={{ height: 300, border: '1px solid rgba(79,195,247,0.15)', borderRadius: 1, overflow: 'hidden', mb: 1 }}>
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}>
              <GMap
                defaultCenter={editLat && editLng ? { lat: editLat, lng: editLng } : HARBOR_CENTER}
                defaultZoom={18}
                mapId="edit-land-storage-map"
                mapTypeId="satellite"
                style={{ width: '100%', height: '100%' }}
                gestureHandling="greedy"
                disableDefaultUI
                zoomControl
                onClick={(e) => {
                  const ll = e.detail?.latLng;
                  if (ll) {
                    setEditLat(ll.lat);
                    setEditLng(ll.lng);
                  }
                }}
              >
                {editLat && editLng && (
                  <AdvancedMarker position={{ lat: editLat, lng: editLng }} />
                )}
              </GMap>
            </APIProvider>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Latitude" type="number" size="small"
              value={editLat ?? ""}
              onChange={(e) => setEditLat(e.target.value ? Number(e.target.value) : undefined)}
              slotProps={{ htmlInput: { step: 0.000001 } }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Longitude" type="number" size="small"
              value={editLng ?? ""}
              onChange={(e) => setEditLng(e.target.value ? Number(e.target.value) : undefined)}
              slotProps={{ htmlInput: { step: 0.000001 } }}
              sx={{ flex: 1 }}
            />
            {editLat && editLng && (
              <Button
                size="small"
                color="error"
                onClick={() => { setEditLat(undefined); setEditLng(undefined); }}
              >
                Clear
              </Button>
            )}
          </Box>

          {/* ─── Payments section ─── */}
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5 }}>
                <PaymentIcon sx={{ fontSize: 18 }} />
                Betalningar ({editPayments.length})
              </Typography>
              {!showPaymentForm && (
                <Button size="small" startIcon={<AddIcon />} onClick={() => setShowPaymentForm(true)}>
                  Registrera betalning
                </Button>
              )}
            </Box>

            {/* Existing payments */}
            {editPayments.length > 0 && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1.5 }}>
                {editPayments.map((p) => (
                  <Box
                    key={p.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      p: 1,
                      borderRadius: 1,
                      bgcolor: "rgba(79, 195, 247, 0.04)",
                      border: "1px solid rgba(79, 195, 247, 0.08)",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Chip
                        label={`${p.period === "Winter" ? "Vinter" : p.period === "Summer" ? "Sommar" : "Helår"} ${p.year}`}
                        size="small"
                        color={p.period === "Winter" ? "info" : "success"}
                        variant="outlined"
                      />
                      {p.amount && (
                        <Typography variant="body2" color="text.secondary">
                          {p.amount} kr
                        </Typography>
                      )}
                      {p.note && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                          {p.note}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {p.paidAt?.toDate?.()?.toLocaleDateString("sv-SE") || ""}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={async () => {
                          if (!editEntry) return;
                          try {
                            await deleteDoc(doc(db, "landStorage", editEntry.code, "payments", p.id));
                            setEditPayments((prev) => prev.filter((x) => x.id !== p.id));
                            setSuccessMsg("Betalning borttagen.");
                            setTimeout(() => setSuccessMsg(""), 3000);
                          } catch (err) {
                            console.error("Error deleting payment:", err);
                          }
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {editPayments.length === 0 && !showPaymentForm && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic", display: "block", mb: 1 }}>
                Inga betalningar registrerade
              </Typography>
            )}

            {/* Register payment form */}
            {showPaymentForm && (
              <Box sx={{ p: 2, borderRadius: 1, bgcolor: "rgba(79, 195, 247, 0.04)", border: "1px solid rgba(79, 195, 247, 0.12)", mb: 1 }}>
                <Alert severity="info" sx={{ mb: 2, fontSize: "0.8rem" }}>
                  Vintersäsongen löper över nyår: <strong>Vinter 2025</strong> = 1 sep 2025 – 1 jun 2026. Året avser när säsongen <em>startar</em>.
                </Alert>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="År"
                      value={paymentYear}
                      onChange={(e) => setPaymentYear(Number(e.target.value))}
                      slotProps={{ select: { native: true } }}
                    >
                      {Array.from({ length: new Date().getFullYear() - 2022 + 2 }, (_, i) => 2022 + i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Period"
                      value={paymentPeriod}
                      onChange={(e) => setPaymentPeriod(e.target.value as PaymentPeriod)}
                      slotProps={{ select: { native: true } }}
                    >
                      <option value="Summer">Sommar</option>
                      <option value="Winter">Vinter</option>
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Belopp (valfritt)"
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      slotProps={{ htmlInput: { min: 0 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Notering (valfritt)"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                    />
                  </Grid>
                </Grid>

                {/* Duplicate warning */}
                {editPayments.some((p) => p.year === paymentYear && p.period === paymentPeriod) && (
                  <Alert severity="warning" sx={{ mt: 1.5, fontSize: "0.8rem" }}>
                    Det finns redan en betalning för {paymentPeriod === "Winter" ? "Vinter" : "Sommar"} {paymentYear}.
                  </Alert>
                )}

                <Box sx={{ display: "flex", gap: 1, mt: 1.5, justifyContent: "flex-end" }}>
                  <Button size="small" onClick={() => setShowPaymentForm(false)}>Avbryt</Button>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={paymentSaving}
                    onClick={async () => {
                      if (!editEntry) return;
                      setPaymentSaving(true);
                      try {
                        const paymentData = {
                          resourceType: "landStorage" as const,
                          resourceId: editEntry.code,
                          year: paymentYear,
                          period: paymentPeriod,
                          amount: paymentAmount ? Number(paymentAmount) : null,
                          paidAt: Timestamp.now(),
                          registeredBy: firebaseUser?.uid || "unknown",
                          note: paymentNote.trim() || null,
                        };
                        const docRef = await addDoc(
                          collection(db, "landStorage", editEntry.code, "payments"),
                          paymentData
                        );
                        setEditPayments((prev) => [
                          { id: docRef.id, ...paymentData } as unknown as ResourcePayment,
                          ...prev,
                        ]);
                        setShowPaymentForm(false);
                        setPaymentNote("");
                        setPaymentAmount("");
                        setSuccessMsg(`Betalning registrerad: ${paymentPeriod === "Winter" ? "Vinter" : "Sommar"} ${paymentYear}`);
                        setTimeout(() => setSuccessMsg(""), 4000);
                      } catch (err) {
                        console.error("Error saving payment:", err);
                      } finally {
                        setPaymentSaving(false);
                      }
                    }}
                  >
                    {paymentSaving ? "Sparar..." : "Registrera"}
                  </Button>
                </Box>
              </Box>
            )}
          </Box>

          {/* Internal comments */}
          <InternalCommentsPanel
            comments={editInternalComments}
            onChange={(updated) => {
              setEditInternalComments(updated);
              // Auto-save to Firestore immediately
              if (editEntry) {
                updateDoc(doc(db, "landStorage", editEntry.code), {
                  internalComments: updated,
                  updatedAt: Timestamp.now(),
                }).then(() => {
                  // Update local entries state too
                  setEntries((prev) =>
                    prev.map((e) =>
                      e.code === editEntry.code
                        ? { ...e, internalComments: updated }
                        : e
                    )
                  );
                }).catch((err) => console.error("Error saving comment:", err));
              }
            }}
            userNames={Object.fromEntries(allUsers.map((u) => [u.id, u.name]))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
          <Box>
            {editEntry?.status === "Occupied" && (
              <Button
                color="error"
                onClick={handleRelease}
                disabled={saving}
              >
                Release Code
              </Button>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={() => setEditEntry(null)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleEditSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
