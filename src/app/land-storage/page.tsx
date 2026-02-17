"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { uploadLandStorageImage } from "@/lib/storage";
import { LandStorageEntry, User } from "@/lib/types";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
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

export default function LandStoragePage() {
  return (
    <ProtectedRoute allowedRoles={["Superadmin", "Dock Manager"]}>
      <LandStorageContent />
    </ProtectedRoute>
  );
}

type FilterStatus = "all" | "Available" | "Occupied";

function LandStorageContent() {
  const { isSuperadmin, isDockManager } = useAuth();
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
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [editLat, setEditLat] = useState<number | undefined>(undefined);
  const [editLng, setEditLng] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | undefined>(undefined);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
    setEditLat(entry.lat);
    setEditLng(entry.lng);
    setEditImageUrl(entry.imageUrl);
    setEditImageFile(null);

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
        <Grid size={{ xs: 4 }}>
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
        <Grid size={{ xs: 4 }}>
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
        <Grid size={{ xs: 4 }}>
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => imageInputRef.current?.click()}
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
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setEditImageFile(file);
              }}
            />
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
