"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { User, Dock, Resource } from "@/lib/types";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
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

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={["Superadmin"]}>
      <AdminContent />
    </ProtectedRoute>
  );
}

function AdminContent() {
  const [tabIndex, setTabIndex] = useState(0);

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
        <Tab icon={<PeopleIcon />} label="Users" iconPosition="start" />
        <Tab icon={<AnchorIcon />} label="Docks" iconPosition="start" />
        <Tab icon={<DirectionsBoatIcon />} label="Resources" iconPosition="start" />
      </Tabs>

      {tabIndex === 0 && <UsersTab />}
      {tabIndex === 1 && <DocksTab />}
      {tabIndex === 2 && <ResourcesTab />}
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
                    <Chip
                      label={u.role}
                      size="small"
                      color={
                        u.role === "Superadmin"
                          ? "error"
                          : u.role === "Dock Manager"
                          ? "warning"
                          : "default"
                      }
                    />
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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    type: "Association" as Dock["type"],
  });

  useEffect(() => {
    fetchDocks();
  }, []);

  async function fetchDocks() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "docks"));
      setDocks(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock));
    } catch (err) {
      console.error("Error fetching docks:", err);
    } finally {
      setLoading(false);
    }
  }

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
      fetchDocks();
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
      fetchDocks();
    } catch (err) {
      console.error("Error deleting dock:", err);
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
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: "block" }}
                  >
                    {dock.managerIds?.length || 0} manager(s)
                  </Typography>
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
                  <TableCell>{getDockName(r.dockId)}</TableCell>
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
