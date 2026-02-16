"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { User, Dock, Resource, BerthInterest, InterestReply } from "@/lib/types";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PeopleIcon from "@mui/icons-material/People";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import AnchorIcon from "@mui/icons-material/Anchor";
import SailingIcon from "@mui/icons-material/Sailing";
import ReplyIcon from "@mui/icons-material/Reply";
import VisibilityIcon from "@mui/icons-material/Visibility";

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={["Superadmin", "Dock Manager"]}>
      <AdminContent />
    </ProtectedRoute>
  );
}

function AdminContent() {
  const { profile } = useAuth();
  const isSuperadmin = profile?.role === "Superadmin";
  const [tabIndex, setTabIndex] = useState(isSuperadmin ? 0 : 3);

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <AdminPanelSettingsIcon sx={{ color: "primary.main" }} />
          Admin Panel
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage users, docks, and resources across the harbor association.
        </Typography>
      </Box>

      <Tabs
        value={tabIndex}
        onChange={(_, v) => setTabIndex(v)}
        sx={{ mb: 3 }}
      >
        {isSuperadmin && <Tab value={0} icon={<PeopleIcon />} label="Users" iconPosition="start" />}
        {isSuperadmin && <Tab value={1} icon={<AnchorIcon />} label="Docks" iconPosition="start" />}
        {isSuperadmin && <Tab value={2} icon={<DirectionsBoatIcon />} label="Resources" iconPosition="start" />}
        <Tab value={3} icon={<SailingIcon />} label="Intresseanmälningar" iconPosition="start" />
      </Tabs>

      {tabIndex === 0 && isSuperadmin && <UsersTab />}
      {tabIndex === 1 && isSuperadmin && <DocksTab />}
      {tabIndex === 2 && isSuperadmin && <ResourcesTab />}
      {tabIndex === 3 && <InterestsTab />}
    </Box>
  );
}

// ─── Users Tab ────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Tenant" as User["role"],
    phone: "",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as User));
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleAddUser = async () => {
    try {
      const id = crypto.randomUUID();
      await setDoc(doc(db, "users", id), {
        email: form.email,
        name: form.name,
        role: form.role,
        phone: form.phone,
        isPublic: true,
        createdAt: Timestamp.now(),
      });
      setDialogOpen(false);
      setForm({ name: "", email: "", role: "Tenant", phone: "" });
      setSuccessMsg("User created successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchUsers();
    } catch (err) {
      console.error("Error adding user:", err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      setSuccessMsg("User deleted.");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchUsers();
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: newRole as User["role"] } : u
        )
      );
      setSuccessMsg(`Role updated to ${newRole}`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error updating role:", err);
    }
  };

  return (
    <Box>
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add User
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          sx={{ bgcolor: "background.paper", backgroundImage: "none" }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Public</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      size="small"
                      onChange={(e: SelectChangeEvent) =>
                        handleRoleChange(u.id, e.target.value)
                      }
                      sx={{
                        minWidth: 140,
                        '.MuiSelect-select': { py: 0.5 },
                        bgcolor:
                          u.role === 'Superadmin'
                            ? 'rgba(244, 67, 54, 0.08)'
                            : u.role === 'Dock Manager'
                            ? 'rgba(255, 183, 77, 0.08)'
                            : 'transparent',
                      }}
                    >
                      <MenuItem value="Tenant">Tenant</MenuItem>
                      <MenuItem value="Dock Manager">Dock Manager</MenuItem>
                      <MenuItem value="Superadmin">Superadmin</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell>{u.phone || "—"}</TableCell>
                  <TableCell>
                    <Chip
                      label={u.isPublic ? "Yes" : "No"}
                      size="small"
                      color={u.isPublic ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteUser(u.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add User Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New User</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={form.role}
              label="Role"
              onChange={(e: SelectChangeEvent) =>
                setForm({ ...form, role: e.target.value as User["role"] })
              }
            >
              <MenuItem value="Tenant">Tenant</MenuItem>
              <MenuItem value="Dock Manager">Dock Manager</MenuItem>
              <MenuItem value="Superadmin">Superadmin</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddUser}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Docks Tab ────────────────────────────────────────────
function DocksTab() {
  const [docks, setDocks] = useState<Dock[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [managerDialogDock, setManagerDialogDock] = useState<Dock | null>(null);
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    type: "Association" as Dock["type"],
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [dSnap, uSnap] = await Promise.all([
        getDocs(collection(db, "docks")),
        getDocs(collection(db, "users")),
      ]);
      setDocks(dSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock));
      setUsers(uSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as User));
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Users eligible to be dock managers
  const eligibleManagers = users.filter(
    (u) => u.role === "Dock Manager" || u.role === "Superadmin"
  );

  const getUserName = (uid: string) =>
    users.find((u) => u.id === uid)?.name || uid;

  const handleAddDock = async () => {
    try {
      const id = crypto.randomUUID();
      await setDoc(doc(db, "docks", id), {
        name: form.name,
        type: form.type,
        managerIds: [],
      });
      setDialogOpen(false);
      setForm({ name: "", type: "Association" });
      setSuccessMsg("Dock created!");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchData();
    } catch (err) {
      console.error("Error adding dock:", err);
    }
  };

  const handleDeleteDock = async (dockId: string) => {
    if (!confirm("Are you sure you want to delete this dock?")) return;
    try {
      await deleteDoc(doc(db, "docks", dockId));
      setSuccessMsg("Dock deleted.");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchData();
    } catch (err) {
      console.error("Error deleting dock:", err);
    }
  };

  // Open manager assignment dialog
  const openManagerDialog = (dock: Dock) => {
    setManagerDialogDock(dock);
    setSelectedManagerIds(dock.managerIds || []);
  };

  // Save manager assignments
  const handleSaveManagers = async () => {
    if (!managerDialogDock) return;
    try {
      await updateDoc(doc(db, "docks", managerDialogDock.id), {
        managerIds: selectedManagerIds,
      });
      setDocks((prev) =>
        prev.map((d) =>
          d.id === managerDialogDock.id
            ? { ...d, managerIds: selectedManagerIds }
            : d
        )
      );
      setManagerDialogDock(null);
      setSuccessMsg("Managers updated!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error updating managers:", err);
    }
  };

  // Remove a single manager from a dock
  const handleRemoveManager = async (dock: Dock, managerId: string) => {
    const newIds = (dock.managerIds || []).filter((id) => id !== managerId);
    try {
      await updateDoc(doc(db, "docks", dock.id), { managerIds: newIds });
      setDocks((prev) =>
        prev.map((d) =>
          d.id === dock.id ? { ...d, managerIds: newIds } : d
        )
      );
      setSuccessMsg("Manager removed.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error removing manager:", err);
    }
  };

  return (
    <Box>
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add Dock
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {docks.map((dock) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={dock.id}>
              <Card
                sx={{
                  transition: "transform 0.2s",
                  "&:hover": { transform: "translateY(-2px)" },
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {dock.name}
                      </Typography>
                      <Chip
                        label={dock.type}
                        size="small"
                        sx={{ mt: 0.5 }}
                        color={
                          dock.type === "Association" ? "success" : "warning"
                        }
                      />
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteDock(dock.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  {/* Assigned managers */}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 2, mb: 0.5, display: "block", fontWeight: 600 }}
                  >
                    Managers
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                    {(dock.managerIds || []).length === 0 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                        No managers assigned
                      </Typography>
                    ) : (
                      dock.managerIds.map((mid) => (
                        <Chip
                          key={mid}
                          label={getUserName(mid)}
                          size="small"
                          onDelete={() => handleRemoveManager(dock, mid)}
                          sx={{
                            bgcolor: "rgba(255, 183, 77, 0.12)",
                            color: "warning.light",
                          }}
                        />
                      ))
                    )}
                  </Box>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => openManagerDialog(dock)}
                    sx={{ textTransform: "none" }}
                  >
                    Assign Managers
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Dock Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Dock</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Dock Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
          />
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={form.type}
              label="Type"
              onChange={(e: SelectChangeEvent) =>
                setForm({ ...form, type: e.target.value as Dock["type"] })
              }
            >
              <MenuItem value="Association">Association</MenuItem>
              <MenuItem value="Private">Private</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddDock}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Managers Dialog */}
      <Dialog
        open={!!managerDialogDock}
        onClose={() => setManagerDialogDock(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Assign Managers — {managerDialogDock?.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select which users should manage this dock. Only users with the
            &quot;Dock Manager&quot; or &quot;Superadmin&quot; role are shown.
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Managers</InputLabel>
            <Select
              multiple
              value={selectedManagerIds}
              label="Managers"
              onChange={(e) => {
                const val = e.target.value;
                setSelectedManagerIds(
                  typeof val === "string" ? val.split(",") : (val as string[])
                );
              }}
              renderValue={(selected) =>
                (selected as string[]).map((id: string) => getUserName(id)).join(", ")
              }
            >
              {eligibleManagers.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </MenuItem>
              ))}
              {eligibleManagers.length === 0 && (
                <MenuItem disabled>
                  No users with Dock Manager or Superadmin role
                </MenuItem>
              )}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManagerDialogDock(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveManagers}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Resources Tab ────────────────────────────────────────
function ResourcesTab() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    type: "Berth" as Resource["type"],
    markingCode: "",
    dockId: "",
    status: "Available" as Resource["status"],
    paymentStatus: "Unpaid" as Resource["paymentStatus"],
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [rSnap, dSnap] = await Promise.all([
        getDocs(collection(db, "resources")),
        getDocs(collection(db, "docks")),
      ]);
      setResources(
        rSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Resource)
      );
      setDocks(dSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock));
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleAddResource = async () => {
    try {
      const id = crypto.randomUUID();
      await setDoc(doc(db, "resources", id), {
        type: form.type,
        markingCode: form.markingCode,
        dockId: form.dockId,
        status: form.status,
        paymentStatus: form.paymentStatus,
        occupantId: "",
        boatImageUrl: "",
      });
      setDialogOpen(false);
      setForm({
        type: "Berth",
        markingCode: "",
        dockId: "",
        status: "Available",
        paymentStatus: "Unpaid",
      });
      setSuccessMsg("Resource created!");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchAll();
    } catch (err) {
      console.error("Error adding resource:", err);
    }
  };

  const handleDeleteResource = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    try {
      await deleteDoc(doc(db, "resources", id));
      setSuccessMsg("Resource deleted.");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchAll();
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const getDockName = (dockId: string) =>
    docks.find((d) => d.id === dockId)?.name || dockId || "—";

  return (
    <Box>
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add Resource
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          sx={{ bgcolor: "background.paper", backgroundImage: "none" }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Marking Code</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Dock</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resources.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {r.markingCode}
                  </TableCell>
                  <TableCell>
                    <Chip label={r.type} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{getDockName(r.dockId || "")}</TableCell>
                  <TableCell>
                    <Chip
                      label={r.status}
                      size="small"
                      color={r.status === "Available" ? "success" : "warning"}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={r.paymentStatus}
                      size="small"
                      color={r.paymentStatus === "Paid" ? "success" : "error"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteResource(r.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Resource Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Resource</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={form.type}
              label="Type"
              onChange={(e: SelectChangeEvent) =>
                setForm({ ...form, type: e.target.value as Resource["type"] })
              }
            >
              <MenuItem value="Berth">Berth</MenuItem>
              <MenuItem value="SeaHut">Sea Hut</MenuItem>
              <MenuItem value="Box">Box</MenuItem>
              <MenuItem value="LandStorage">Land Storage</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Marking Code"
            value={form.markingCode}
            onChange={(e) => setForm({ ...form, markingCode: e.target.value })}
            sx={{ mb: 2 }}
            placeholder="e.g. V-104"
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Dock</InputLabel>
            <Select
              value={form.dockId}
              label="Dock"
              onChange={(e: SelectChangeEvent) =>
                setForm({ ...form, dockId: e.target.value })
              }
            >
              {docks.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddResource}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Interests Tab ────────────────────────────────────────
function InterestsTab() {
  const { firebaseUser, profile } = useAuth();
  const [interests, setInterests] = useState<BerthInterest[]>([]);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");

  // Detail dialog state
  const [selectedInterest, setSelectedInterest] = useState<BerthInterest | null>(null);
  const [replies, setReplies] = useState<InterestReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [iSnap, dSnap] = await Promise.all([
        getDocs(query(collection(db, "interests"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "docks")),
      ]);
      setInterests(iSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as BerthInterest));
      setDocks(dSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock));
    } catch (err) {
      console.error("Error fetching interests:", err);
      try {
        const iSnap = await getDocs(collection(db, "interests"));
        setInterests(iSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as BerthInterest));
      } catch {
        // Ignore
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchReplies(interestId: string) {
    setLoadingReplies(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "interests", interestId, "replies"),
          orderBy("createdAt", "asc")
        )
      );
      setReplies(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InterestReply));
    } catch (err) {
      console.error("Error fetching replies:", err);
      try {
        const snap = await getDocs(collection(db, "interests", interestId, "replies"));
        setReplies(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InterestReply));
      } catch {
        // Ignore
      }
    } finally {
      setLoadingReplies(false);
    }
  }

  const openDetail = (interest: BerthInterest) => {
    setSelectedInterest(interest);
    setReplyMessage("");
    fetchReplies(interest.id);
  };

  const handleStatusChange = async (interestId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "interests", interestId), { status: newStatus });
      setInterests((prev) =>
        prev.map((i) =>
          i.id === interestId ? { ...i, status: newStatus as BerthInterest["status"] } : i
        )
      );
      if (selectedInterest?.id === interestId) {
        setSelectedInterest((prev) =>
          prev ? { ...prev, status: newStatus as BerthInterest["status"] } : prev
        );
      }
      setSuccessMsg("Status uppdaterad");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleSendReply = async () => {
    if (!firebaseUser || !profile || !selectedInterest || !replyMessage.trim()) return;
    setSendingReply(true);
    try {
      await addDoc(collection(db, "interests", selectedInterest.id, "replies"), {
        interestId: selectedInterest.id,
        authorId: firebaseUser.uid,
        authorName: profile.name,
        authorEmail: profile.email || firebaseUser.email || "",
        authorPhone: profile.phone || "",
        message: replyMessage.trim(),
        createdAt: Timestamp.now(),
      });

      // Move status to Contacted if still Pending
      if (selectedInterest.status === "Pending") {
        await handleStatusChange(selectedInterest.id, "Contacted");
      }

      setReplyMessage("");
      setSuccessMsg("Svar skickat!");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchReplies(selectedInterest.id);
    } catch (err) {
      console.error("Error sending reply:", err);
    } finally {
      setSendingReply(false);
    }
  };

  const getDockName = (dockId?: string) =>
    dockId ? docks.find((d) => d.id === dockId)?.name || "—" : "Ingen";

  const formatDate = (ts: Timestamp) =>
    ts.toDate().toLocaleDateString("sv-SE");

  const formatDateTime = (ts: Timestamp) =>
    ts.toDate().toLocaleString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusColor = (status: string): "warning" | "info" | "success" =>
    status === "Pending" ? "warning" : status === "Contacted" ? "info" : "success";

  return (
    <Box>
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : interests.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography color="text.secondary">Inga intresseanmälningar ännu.</Typography>
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          sx={{ bgcolor: "background.paper", backgroundImage: "none" }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Namn</TableCell>
                <TableCell>Bild</TableCell>
                <TableCell>E-post</TableCell>
                <TableCell>Telefon</TableCell>
                <TableCell>Båt (B×L)</TableCell>
                <TableCell>Önskad brygga</TableCell>
                <TableCell>Datum</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Åtgärd</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {interests.map((interest) => (
                <TableRow key={interest.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{interest.userName}</TableCell>
                  <TableCell>
                    {interest.imageUrl ? (
                      <Box
                        component="img"
                        src={interest.imageUrl}
                        alt="Båt"
                        sx={{
                          width: 48,
                          height: 48,
                          objectFit: "cover",
                          borderRadius: 1,
                        }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>{interest.email}</TableCell>
                  <TableCell>{interest.phone || "—"}</TableCell>
                  <TableCell>
                    {interest.boatWidth}×{interest.boatLength} m
                  </TableCell>
                  <TableCell>{getDockName(interest.preferredDockId)}</TableCell>
                  <TableCell>{formatDate(interest.createdAt)}</TableCell>
                  <TableCell>
                    <Select
                      value={interest.status}
                      size="small"
                      onChange={(e) =>
                        handleStatusChange(interest.id, e.target.value)
                      }
                      sx={{
                        minWidth: 120,
                        ".MuiSelect-select": { py: 0.5 },
                      }}
                    >
                      <MenuItem value="Pending">Väntande</MenuItem>
                      <MenuItem value="Contacted">Kontaktad</MenuItem>
                      <MenuItem value="Resolved">Avslutad</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => openDetail(interest)}
                      sx={{ color: "primary.main" }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setDeleteConfirmId(interest.id)}
                      sx={{ color: "error.main" }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>Ta bort intresseanmälan?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Är du säker på att du vill ta bort denna intresseanmälan? Detta kan inte ångras.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>Avbryt</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (!deleteConfirmId) return;
              try {
                await deleteDoc(doc(db, "interests", deleteConfirmId));
                setInterests((prev) => prev.filter((i) => i.id !== deleteConfirmId));
                setSuccessMsg("Intresseanmälan borttagen.");
                setTimeout(() => setSuccessMsg(""), 3000);
              } catch (err) {
                console.error("Error deleting interest:", err);
              } finally {
                setDeleteConfirmId(null);
              }
            }}
          >
            Ta bort
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail / Reply Dialog */}
      <Dialog
        open={!!selectedInterest}
        onClose={() => setSelectedInterest(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedInterest && (
          <>
            <DialogTitle>
              Intresseanmälan — {selectedInterest.userName}
            </DialogTitle>
            <DialogContent>
              {selectedInterest.imageUrl && (
                <Box
                  component="img"
                  src={selectedInterest.imageUrl}
                  alt="Båtbild"
                  sx={{
                    width: "100%",
                    maxHeight: 220,
                    objectFit: "cover",
                    borderRadius: 2,
                    mb: 2,
                  }}
                />
              )}
              <Box sx={{ mb: 2 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      E-post
                    </Typography>
                    <Typography variant="body2">{selectedInterest.email}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Telefon
                    </Typography>
                    <Typography variant="body2">{selectedInterest.phone || "—"}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Båt (bredd × längd)
                    </Typography>
                    <Typography variant="body2">
                      {selectedInterest.boatWidth} × {selectedInterest.boatLength} m
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Önskad brygga
                    </Typography>
                    <Typography variant="body2">
                      {getDockName(selectedInterest.preferredDockId)}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Skickat
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(selectedInterest.createdAt)}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Status
                    </Typography>
                    <Box>
                      <Chip
                        label={
                          selectedInterest.status === "Pending"
                            ? "Väntande"
                            : selectedInterest.status === "Contacted"
                            ? "Kontaktad"
                            : "Avslutad"
                        }
                        size="small"
                        color={statusColor(selectedInterest.status)}
                      />
                    </Box>
                  </Grid>
                </Grid>
                {selectedInterest.message && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: "rgba(79,195,247,0.05)", borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Meddelande
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {selectedInterest.message}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Reply thread */}
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, mt: 3, mb: 1, color: "primary.light" }}
              >
                Svar ({replies.length})
              </Typography>

              {loadingReplies ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : replies.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontStyle: "italic", mb: 2 }}
                >
                  Inga svar ännu.
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
                  {replies.map((reply) => (
                    <Card
                      key={reply.id}
                      variant="outlined"
                      sx={{
                        bgcolor: "rgba(79,195,247,0.04)",
                        border: "1px solid rgba(79,195,247,0.12)",
                      }}
                    >
                      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 1,
                          }}
                        >
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
                        <Box
                          sx={{
                            display: "flex",
                            gap: 2,
                            mt: 1,
                            pt: 1,
                            borderTop: "1px solid rgba(79,195,247,0.08)",
                          }}
                        >
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
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}

              {/* Reply form */}
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: "rgba(13, 33, 55, 0.4)",
                  borderRadius: 2,
                  border: "1px solid rgba(79,195,247,0.08)",
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Skriv svar
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                  Dina kontaktuppgifter ({profile?.name}, {profile?.email || firebaseUser?.email},{" "}
                  {profile?.phone || "ingen telefon"}) bifogas automatiskt.
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Skriv ett svar till den intresserade..."
                  sx={{ mb: 1.5 }}
                />
                <Button
                  variant="contained"
                  startIcon={<ReplyIcon />}
                  onClick={handleSendReply}
                  disabled={!replyMessage.trim() || sendingReply}
                  sx={{ textTransform: "none" }}
                >
                  {sendingReply ? "Skickar..." : "Skicka svar"}
                </Button>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedInterest(null)}>Stäng</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
