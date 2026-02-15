"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { LandStorageEntry } from "@/lib/types";
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
import SearchIcon from "@mui/icons-material/Search";
import ConstructionIcon from "@mui/icons-material/Construction";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

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

  const [entries, setEntries] = useState<LandStorageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [editEntry, setEditEntry] = useState<LandStorageEntry | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    comment: "",
  });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

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
  const handleEditOpen = (entry: LandStorageEntry) => {
    setEditEntry(entry);
    setEditForm({
      firstName: entry.firstName || "",
      lastName: entry.lastName || "",
      phone: entry.phone || "",
      comment: entry.comment || "",
    });
  };

  const handleEditSave = async () => {
    if (!editEntry) return;
    setSaving(true);
    try {
      const isOccupied = editForm.firstName.trim().length > 0;
      await updateDoc(doc(db, "landStorage", editEntry.code), {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim(),
        comment: editForm.comment.trim(),
        status: isOccupied ? "Occupied" : "Available",
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
        comment: "",
        status: "Available",
        paymentStatus: "Unpaid",
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
                comment: "",
                status: "Available" as const,
                paymentStatus: "Unpaid" as const,
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
                      {entry.firstName
                        ? `${entry.firstName} ${entry.lastName}`.trim()
                        : "—"}
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
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
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
