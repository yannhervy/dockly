"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadBoatImage } from "@/lib/storage";
import { useAuth } from "@/context/AuthContext";
import { Dock, Berth } from "@/lib/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import InputAdornment from "@mui/material/InputAdornment";
import Avatar from "@mui/material/Avatar";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import AnchorIcon from "@mui/icons-material/Anchor";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockIcon from "@mui/icons-material/Lock";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";

export default function DirectoryPage() {
  const { firebaseUser, isSuperadmin, isDockManager } = useAuth();
  const isManager = isSuperadmin || isDockManager;

  const [docks, setDocks] = useState<Dock[]>([]);
  const [selectedDock, setSelectedDock] = useState<Dock | null>(null);
  const [berths, setBerths] = useState<Berth[]>([]);
  const [loadingDocks, setLoadingDocks] = useState(true);
  const [loadingBerths, setLoadingBerths] = useState(false);
  const [search, setSearch] = useState("");
  const [userHasResources, setUserHasResources] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Edit dialog state (admin/manager only)
  const [editBerth, setEditBerth] = useState<Berth | null>(null);
  const [editForm, setEditForm] = useState({
    occupantFirstName: "",
    occupantLastName: "",
    occupantPhone: "",
    occupantEmail: "",
    occupantAddress: "",
    occupantPostalAddress: "",
    comment: "",
    price2026: "",
    secret: false,
  });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Fetch all docks
  useEffect(() => {
    async function fetchDocks() {
      try {
        const snap = await getDocs(collection(db, "docks"));
        const items = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Dock
        );
        setDocks(items.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error("Error fetching docks:", err);
      } finally {
        setLoadingDocks(false);
      }
    }
    fetchDocks();
  }, []);

  // Check if current user has any resources linked to them
  useEffect(() => {
    if (!firebaseUser || isSuperadmin || isDockManager) return;

    async function checkUserResources() {
      try {
        // Check if any resource has this user's uid in occupantIds
        const q = query(
          collection(db, "resources"),
          where("occupantIds", "array-contains", firebaseUser!.uid)
        );
        const snap = await getDocs(q);
        if (snap.size > 0) {
          setUserHasResources(true);
          return;
        }

        // Also check land storage
        const lsQ = query(
          collection(db, "landStorage"),
          where("occupantId", "==", firebaseUser!.uid)
        );
        const lsSnap = await getDocs(lsQ);
        if (lsSnap.size > 0) {
          setUserHasResources(true);
        }
      } catch {
        // Silently fail — default to no resources (most restrictive)
      }
    }
    checkUserResources();
  }, [firebaseUser, isSuperadmin, isDockManager]);

  // Privacy helper: can the current user see personal info for this berth?
  const canSeePersonalInfo = (berth: Berth): boolean => {
    // Superadmin sees everything
    if (isSuperadmin) return true;
    // Secret berths — only superadmin
    if (berth.secret) return false;
    // Dock Manager sees non-secret berths
    if (isDockManager) return true;
    // Tenant with resources can see names (not contact details)
    // Tenant without resources sees nothing
    return false;
  };

  // Can the current user see names (but not full contact info)?
  const canSeeNames = (berth: Berth): boolean => {
    if (isSuperadmin) return true;
    if (berth.secret) return false;
    if (isDockManager) return true;
    // Tenant with own resources can see names
    if (userHasResources) return true;
    return false;
  };

  // Fetch berths for selected dock
  useEffect(() => {
    if (!selectedDock) return;

    async function fetchBerths() {
      setLoadingBerths(true);
      try {
        const q = query(
          collection(db, "resources"),
          where("dockId", "==", selectedDock!.id),
          where("type", "==", "Berth")
        );
        const snap = await getDocs(q);
        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Berth)
          .sort((a, b) => (a.berthNumber || 0) - (b.berthNumber || 0));
        setBerths(items);
      } catch (err) {
        console.error("Error fetching berths:", err);
      } finally {
        setLoadingBerths(false);
      }
    }
    fetchBerths();
  }, [selectedDock]);

  // Filtered berths
  const filtered = useMemo(() => {
    if (!search.trim()) return berths;
    const term = search.toLowerCase();
    return berths.filter(
      (b) =>
        String(b.berthNumber || "").includes(term) ||
        (b.markingCode || "").toLowerCase().includes(term) ||
        (canSeeNames(b) &&
          ((b.occupantFirstName || "").toLowerCase().includes(term) ||
            (b.occupantLastName || "").toLowerCase().includes(term)))
    );
  }, [berths, search, isSuperadmin, isDockManager, userHasResources]);

  // Stats
  const totalBerths = berths.length;
  const occupiedBerths = berths.filter((b) => b.status === "Occupied").length;
  const availableBerths = berths.filter((b) => b.status === "Available").length;

  // Open edit dialog
  const openEdit = (berth: Berth) => {
    setEditBerth(berth);
    setEditForm({
      occupantFirstName: berth.occupantFirstName || "",
      occupantLastName: berth.occupantLastName || "",
      occupantPhone: berth.occupantPhone || "",
      occupantEmail: berth.occupantEmail || "",
      occupantAddress: berth.occupantAddress || "",
      occupantPostalAddress: berth.occupantPostalAddress || "",
      comment: berth.comment || "",
      price2026: String(berth.price2026 || ""),
      secret: berth.secret || false,
    });
  };

  // Save edit
  const handleEditSave = async () => {
    if (!editBerth) return;
    setSaving(true);
    try {
      const isOccupied = editForm.occupantFirstName.trim().length > 0;
      await updateDoc(doc(db, "resources", editBerth.id), {
        occupantFirstName: editForm.occupantFirstName,
        occupantLastName: editForm.occupantLastName,
        occupantPhone: editForm.occupantPhone,
        occupantEmail: editForm.occupantEmail,
        occupantAddress: editForm.occupantAddress,
        occupantPostalAddress: editForm.occupantPostalAddress,
        comment: editForm.comment,
        price2026: editForm.price2026 ? parseInt(editForm.price2026) : null,
        secret: editForm.secret,
        status: isOccupied ? "Occupied" : "Available",
      });
      setBerths((prev) =>
        prev.map((b) =>
          b.id === editBerth.id
            ? {
                ...b,
                occupantFirstName: editForm.occupantFirstName,
                occupantLastName: editForm.occupantLastName,
                occupantPhone: editForm.occupantPhone,
                occupantEmail: editForm.occupantEmail,
                occupantAddress: editForm.occupantAddress,
                occupantPostalAddress: editForm.occupantPostalAddress,
                comment: editForm.comment,
                price2026: editForm.price2026
                  ? parseInt(editForm.price2026)
                  : undefined,
                secret: editForm.secret,
                status: isOccupied ? "Occupied" : "Available",
              }
            : b
        )
      );
      setEditBerth(null);
      setSuccessMsg("Berth updated!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error saving berth:", err);
    } finally {
      setSaving(false);
    }
  };

  // Release berth
  const handleRelease = async () => {
    if (!editBerth) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "resources", editBerth.id), {
        occupantFirstName: "",
        occupantLastName: "",
        occupantPhone: "",
        occupantEmail: "",
        occupantAddress: "",
        occupantPostalAddress: "",
        status: "Available",
        paymentStatus: "Unpaid",
      });
      setBerths((prev) =>
        prev.map((b) =>
          b.id === editBerth.id
            ? {
                ...b,
                occupantFirstName: "",
                occupantLastName: "",
                occupantPhone: "",
                occupantEmail: "",
                occupantAddress: "",
                occupantPostalAddress: "",
                status: "Available",
                paymentStatus: "Unpaid",
              }
            : b
        )
      );
      setEditBerth(null);
      setSuccessMsg("Berth released!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error releasing berth:", err);
    } finally {
      setSaving(false);
    }
  };

  // Image upload handler
  const handleUploadClick = (berthId: string) => {
    setUploadTargetId(berthId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;

    setUploadingId(uploadTargetId);
    try {
      const url = await uploadBoatImage(file, uploadTargetId);
      await updateDoc(doc(db, "resources", uploadTargetId), {
        objectImageUrl: url,
      });
      setBerths((prev) =>
        prev.map((b) =>
          b.id === uploadTargetId ? { ...b, objectImageUrl: url } : b
        )
      );
      setSuccessMsg("Image uploaded!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error uploading image:", err);
    } finally {
      setUploadingId(null);
      setUploadTargetId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Dock list view ─────────────────────────────────────
  if (!selectedDock) {
    return (
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1.5 }}
          >
            <AnchorIcon sx={{ color: "primary.main" }} />
            Harbor Directory
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Select a dock to view its berths and availability.
          </Typography>
        </Box>

        {loadingDocks ? (
          <Grid container spacing={3}>
            {[1, 2, 3].map((i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <Skeleton
                  variant="rectangular"
                  height={160}
                  sx={{ borderRadius: 3 }}
                />
              </Grid>
            ))}
          </Grid>
        ) : docks.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
            <AnchorIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h6">No docks registered yet</Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {docks.map((dock) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={dock.id}>
                <Card
                  sx={{
                    cursor: "pointer",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 8px 32px rgba(79, 195, 247, 0.15)",
                    },
                  }}
                  onClick={() => setSelectedDock(dock)}
                >
                  <CardContent sx={{ py: 3 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        mb: 1.5,
                      }}
                    >
                      <AnchorIcon
                        sx={{ fontSize: 32, color: "primary.main" }}
                      />
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {dock.name}
                      </Typography>
                    </Box>
                    <Chip
                      label={dock.type}
                      size="small"
                      color={
                        dock.type === "Association" ? "success" : "warning"
                      }
                    />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1.5 }}
                    >
                      Click to view berths →
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    );
  }

  // ─── Berth list view for selected dock ──────────────────
  return (
    <Box>
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      {/* Header with back button */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => {
            setSelectedDock(null);
            setBerths([]);
            setSearch("");
          }}
          sx={{ mb: 1, textTransform: "none" }}
        >
          All Docks
        </Button>
        <Typography
          variant="h4"
          sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <AnchorIcon sx={{ color: "primary.main" }} />
          {selectedDock.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {selectedDock.type} dock — {totalBerths} berths
        </Typography>
      </Box>

      {/* Stats cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: "center", py: 2 }}>
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: "primary.main" }}
              >
                {totalBerths}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: "center", py: 2 }}>
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: "warning.main" }}
              >
                {occupiedBerths}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Occupied
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: "center", py: 2 }}>
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: "success.main" }}
              >
                {availableBerths}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Available
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search */}
      <TextField
        fullWidth
        placeholder="Search by berth number or name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
        }}
      />

      {/* Berths table */}
      {loadingBerths ? (
        <Skeleton
          variant="rectangular"
          height={300}
          sx={{ width: "100%", borderRadius: 2 }}
        />
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
          <DirectionsBoatIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6">No berths found</Typography>
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          sx={{ bgcolor: "background.paper", backgroundImage: "none" }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Berth</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Occupant</TableCell>
                {canSeePersonalInfo(berths[0] || {}) && (
                  <TableCell>Phone</TableCell>
                )}
                {isManager && <TableCell>Price 2026</TableCell>}
                {isManager && <TableCell>Comment</TableCell>}
                <TableCell>Image</TableCell>
                {isManager && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((b) => {
                const isAvailable = b.status === "Available";
                const showNames = canSeeNames(b);
                const showContact = canSeePersonalInfo(b);
                const displayName =
                  b.occupantFirstName || b.occupantLastName
                    ? `${b.occupantFirstName || ""} ${b.occupantLastName || ""}`.trim()
                    : "";

                return (
                  <TableRow
                    key={b.id}
                    hover
                    sx={{
                      bgcolor: isAvailable
                        ? "rgba(102, 187, 106, 0.04)"
                        : "transparent",
                    }}
                  >
                    <TableCell sx={{ fontWeight: 700, fontSize: "1rem" }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        {b.markingCode || b.berthNumber}
                        {b.secret && isSuperadmin && (
                          <Tooltip title="Secret — only visible to Superadmin">
                            <LockIcon
                              fontSize="small"
                              sx={{ color: "warning.main", ml: 0.5 }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={b.status}
                        size="small"
                        color={isAvailable ? "success" : "warning"}
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      {isAvailable
                        ? "—"
                        : showNames
                        ? displayName || "Occupied"
                        : b.secret && !isSuperadmin
                        ? "🔒 Hidden"
                        : "Occupied"}
                    </TableCell>
                    {/* Phone column — only for users who can see personal info */}
                    {canSeePersonalInfo(berths[0] || {}) && (
                      <TableCell sx={{ color: "text.secondary" }}>
                        {showContact
                          ? b.occupantPhone || "—"
                          : b.secret
                          ? "🔒"
                          : "—"}
                      </TableCell>
                    )}
                    {isManager && (
                      <TableCell>
                        {b.price2026 ? `${b.price2026} kr` : "—"}
                      </TableCell>
                    )}
                    {isManager && (
                      <TableCell
                        sx={{
                          color: "text.secondary",
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.comment || "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {b.objectImageUrl ? (
                          <Avatar
                            src={b.objectImageUrl}
                            variant="rounded"
                            sx={{ width: 40, height: 40, cursor: "pointer" }}
                            onClick={() => setPreviewImageUrl(b.objectImageUrl!)}
                          />
                        ) : null}
                        {isManager && (
                          <Button
                            size="small"
                            startIcon={
                              uploadingId === b.id ? (
                                <CircularProgress size={14} />
                              ) : (
                                <PhotoCameraIcon />
                              )
                            }
                            onClick={() => handleUploadClick(b.id)}
                            disabled={uploadingId === b.id}
                          >
                            {b.objectImageUrl ? "Change" : "Upload"}
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                    {isManager && (
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => openEdit(b)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Edit dialog (admin/manager only) */}
      <Dialog
        open={!!editBerth}
        onClose={() => setEditBerth(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Berth: {editBerth?.markingCode || editBerth?.berthNumber}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="First Name"
                value={editForm.occupantFirstName}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    occupantFirstName: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Last Name"
                value={editForm.occupantLastName}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    occupantLastName: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Phone"
                value={editForm.occupantPhone}
                onChange={(e) =>
                  setEditForm({ ...editForm, occupantPhone: e.target.value })
                }
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Email"
                value={editForm.occupantEmail}
                onChange={(e) =>
                  setEditForm({ ...editForm, occupantEmail: e.target.value })
                }
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Address"
                value={editForm.occupantAddress}
                onChange={(e) =>
                  setEditForm({ ...editForm, occupantAddress: e.target.value })
                }
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Postal Address"
                value={editForm.occupantPostalAddress}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    occupantPostalAddress: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Price 2026 (kr)"
                type="number"
                value={editForm.price2026}
                onChange={(e) =>
                  setEditForm({ ...editForm, price2026: e.target.value })
                }
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={editForm.secret}
                      onChange={(e) =>
                        setEditForm({ ...editForm, secret: e.target.checked })
                      }
                    />
                  }
                  label={
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      <LockIcon fontSize="small" />
                      Secret
                    </Box>
                  }
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Comment"
                multiline
                rows={2}
                value={editForm.comment}
                onChange={(e) =>
                  setEditForm({ ...editForm, comment: e.target.value })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          {editBerth?.status === "Occupied" && (
            <Button
              color="error"
              onClick={handleRelease}
              disabled={saving}
              sx={{ mr: "auto" }}
            >
              Release Berth
            </Button>
          )}
          <Button onClick={() => setEditBerth(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleEditSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image preview lightbox */}
      <Dialog
        open={!!previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
        maxWidth="md"
      >
        <Box
          sx={{ p: 1, display: "flex", justifyContent: "center", bgcolor: "black" }}
          onClick={() => setPreviewImageUrl(null)}
        >
          {previewImageUrl && (
            <Box
              component="img"
              src={previewImageUrl}
              sx={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }}
            />
          )}
        </Box>
      </Dialog>

      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </Box>
  );
}
