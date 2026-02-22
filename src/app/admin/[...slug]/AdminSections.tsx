"use client";

import React, { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { User, Dock, Resource, BerthInterest, InterestReply, OfferedBerth, Berth, BerthTenant, SeaHut, LandStorageEntry, UserMessage, AbandonedObject, AbandonedObjectType, POI, UserRole } from "@/lib/types";
import { normalizePhone } from "@/lib/phoneUtils";
import { sendSms } from "@/lib/sms";
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
  arrayUnion,
  deleteField,
} from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { uploadBoatImage, uploadDockImage, uploadLandStorageImage, uploadAbandonedObjectImage, uploadPOIImage, deleteStorageFile } from "@/lib/storage";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import { computeRectCorners, computeBoatHull, HARBOR_CENTER } from "@/lib/mapUtils";
import { extractExifGps } from "@/lib/exifGps";
import ImagePickerDialog from "@/components/ImagePickerDialog";
import { APIProvider, Map as GMap, useMap, useMapsLibrary, AdvancedMarker } from "@vis.gl/react-google-maps";
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
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
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
import LockResetIcon from "@mui/icons-material/LockReset";
import PublicIcon from "@mui/icons-material/Public";
import LinkIcon from "@mui/icons-material/Link";
import SaveIcon from "@mui/icons-material/Save";
import SmsIcon from "@mui/icons-material/Sms";
import SendIcon from "@mui/icons-material/Send";
import DangerousIcon from "@mui/icons-material/Dangerous";
import CloseIcon from "@mui/icons-material/Close";
import InsertPhotoIcon from "@mui/icons-material/InsertPhoto";
import PlaceIcon from "@mui/icons-material/Place";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Badge from "@mui/material/Badge";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { EngagementType } from "@/lib/types";

const ENGAGEMENT_LABELS: Record<EngagementType, string> = {
  berth: "Båtplats",
  seahut: "Sjöbod",
  box: "Låda",
  landstorage: "Uppställning",
  interest: "Intresserad",
  other: "Övrigt",
};

// Map URL segments to section components
const SECTION_MAP: Record<string, string> = {
  users: "users",
  docks: "docks",
  resources: "resources",
  interests: "interests",
  abandoned: "abandoned",
  poi: "poi",
};

export function AdminSectionsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = (params?.slug as string[] | undefined) || [];
  const section = slug[0] || "";
  const editId = searchParams.get("edit") || undefined;

  // Validate section
  if (section && !SECTION_MAP[section]) {
    router.replace("/admin");
    return null;
  }

  // Determine which role restriction to apply
  const superadminOnly = ["users", "docks", "resources", "abandoned", "poi"];
  const requiredRoles: UserRole[] = superadminOnly.includes(section)
    ? ["Superadmin"]
    : ["Superadmin", "Dock Manager"];

  return (
    <ProtectedRoute allowedRoles={requiredRoles}>
      <AdminContent section={section} editId={editId} />
    </ProtectedRoute>
  );
}

function AdminContent({ section, editId }: { section: string; editId?: string }) {
  const { profile } = useAuth();
  const isSuperadmin = profile?.role === "Superadmin";

  // Render the correct section based on URL
  switch (section) {
    case "users":
      return isSuperadmin ? <UsersTab initialEditId={editId} /> : null;
    case "docks":
      return isSuperadmin ? <DocksTab initialEditId={editId} /> : null;
    case "resources":
      return isSuperadmin ? <ResourcesTab initialEditId={editId} /> : null;
    case "interests":
      return <InterestsTab initialEditId={editId} />;
    case "abandoned":
      return isSuperadmin ? <AbandonedObjectsTab initialEditId={editId} /> : null;
    case "poi":
      return isSuperadmin ? <POITab initialEditId={editId} /> : null;
    default:
      // Empty section = should not happen (handled by /admin/page.tsx landing page)
      return null;
  }
}

// ─── Users Tab ────────────────────────────────────────────
function UsersTab({ initialEditId }: { initialEditId?: string }) {
  const { firebaseUser, startViewingAs } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [matching, setMatching] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Tenant" as User["role"],
    phone: "",
  });

  // Edit user state
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Tenant" as User["role"],
    internalComment: "",
    isPublic: true,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [pendingLinkedObjects, setPendingLinkedObjects] = useState<Record<string, string[]>>({});

  // Send message state
  const [msgText, setMsgText] = useState("");
  const [msgSendSms, setMsgSendSms] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);

  // Admin password change state
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [adminPasswordLoading, setAdminPasswordLoading] = useState(false);
  const [adminPasswordError, setAdminPasswordError] = useState("");
  const [adminPasswordSuccess, setAdminPasswordSuccess] = useState("");

  // Generic confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const allUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as User);
      setUsers(allUsers);

      // Fetch linked objects for pending users
      const pending = allUsers.filter((u) => u.approved === false);
      if (pending.length > 0) {
        const [resSnap, landSnap] = await Promise.all([
          getDocs(collection(db, "resources")),
          getDocs(collection(db, "landStorage")),
        ]);
        const objMap: Record<string, string[]> = {};
        for (const u of pending) {
          const linked: string[] = [];
          resSnap.docs.forEach((d) => {
            const data = d.data();
            if ((data.occupantIds || []).includes(u.id)) {
              const type = data.type === "berth" ? "Båtplats" : data.type === "seahut" ? "Sjöbod" : data.type === "box" ? "Låda" : data.type;
              linked.push(`${type} ${data.code || d.id}`);
            }
          });
          landSnap.docs.forEach((d) => {
            const data = d.data();
            if (data.occupantId === u.id) {
              linked.push(`Uppställning ${data.code || d.id}`);
            }
          });
          objMap[u.id] = linked;
        }
        setPendingLinkedObjects(objMap);
      }
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
    setConfirmDialog({
      title: "Ta bort användare",
      message: "Är du säker på att du vill ta bort denna användare? Detta tar även bort deras inloggning.",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(
        "https://deleteuser-srp7u2ucna-ew.a.run.app",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ uid: userId }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.errors?.join(", ") || "Delete failed");
      }
      setSuccessMsg("User and login deleted.");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchUsers();
    } catch (err) {
      console.error("Error deleting user:", err);
      setSuccessMsg("");
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
      },
    });
  };

  // Approve a pending user
  const handleApproveUser = async (userId: string) => {
    setApprovingId(userId);
    try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(
        "https://europe-west1-stegerholmenshamn.cloudfunctions.net/approveUser",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ uid: userId }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Approve failed");
      }
      setSuccessMsg("Användaren har godkänts och fått SMS.");
      setTimeout(() => setSuccessMsg(""), 4000);
      fetchUsers();
    } catch (err) {
      console.error("Error approving user:", err);
      alert(err instanceof Error ? err.message : "Failed to approve user");
    } finally {
      setApprovingId(null);
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

  // Open edit dialog for a user
  const handleEditOpen = (user: User) => {
    setEditUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role,
      internalComment: user.internalComment || "",
      isPublic: user.isPublic ?? true,
    });
    setMsgText("");
    setMsgSendSms(false);
    setAdminNewPassword("");
    setAdminConfirmPassword("");
    setAdminPasswordError("");
    setAdminPasswordSuccess("");
  };

  // Admin set password for a user
  const handleAdminSetPassword = async () => {
    if (!editUser) return;
    if (adminNewPassword.length < 6) {
      setAdminPasswordError("Lösenordet måste vara minst 6 tecken.");
      return;
    }
    if (adminNewPassword !== adminConfirmPassword) {
      setAdminPasswordError("Lösenorden matchar inte.");
      return;
    }
    setAdminPasswordError("");
    setAdminPasswordLoading(true);
    try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(
        "https://europe-west1-stegerholmenshamn.cloudfunctions.net/adminSetPassword",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ targetUid: editUser.id, newPassword: adminNewPassword }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setAdminPasswordError(data.error || "Något gick fel.");
        return;
      }
      setAdminPasswordSuccess("Lösenordet har ändrats.");
      setAdminNewPassword("");
      setAdminConfirmPassword("");
      setTimeout(() => setAdminPasswordSuccess(""), 4000);
    } catch {
      setAdminPasswordError("Nätverksfel. Försök igen.");
    } finally {
      setAdminPasswordLoading(false);
    }
  };

  // Handle view-as impersonation
  const handleViewAs = (user: User) => {
    startViewingAs(user);
    setEditUser(null);
    router.push("/dashboard");
  };

  // Save user edits
  const handleEditSave = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, "users", editUser.id), {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        role: editForm.role,
        internalComment: editForm.internalComment.trim(),
        isPublic: editForm.isPublic,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editUser.id
            ? { ...u, name: editForm.name.trim(), email: editForm.email.trim(), phone: editForm.phone.trim(), role: editForm.role, internalComment: editForm.internalComment.trim(), isPublic: editForm.isPublic }
            : u
        )
      );
      setSuccessMsg("User updated.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setEditUser(null);
    } catch (err) {
      console.error("Error updating user:", err);
    } finally {
      setEditSaving(false);
    }
  };

  // Send external message to a user
  const handleSendMessage = async () => {
    if (!editUser || !msgText.trim()) return;
    setSendingMsg(true);
    try {
      const authorName = firebaseUser?.displayName || "Admin";
      // Create message in subcollection
      await addDoc(collection(db, "users", editUser.id, "messages"), {
        text: msgText.trim(),
        authorId: firebaseUser?.uid || "",
        authorName,
        sentAsSms: msgSendSms,
        read: false,
        createdAt: Timestamp.now(),
      });

      // Send SMS if checkbox is checked and user has a phone number
      if (msgSendSms && editUser.phone) {
        try {
          await sendSms(editUser.phone, msgText.trim());
        } catch (smsErr) {
          console.error("SMS send failed:", smsErr);
          // Still show success for message, but warn about SMS
          setSuccessMsg("Message saved, but SMS failed to send.");
          setTimeout(() => setSuccessMsg(""), 4000);
          setMsgText("");
          setMsgSendSms(false);
          return;
        }
      }

      setSuccessMsg("Message sent" + (msgSendSms ? " + SMS delivered." : "."));
      setTimeout(() => setSuccessMsg(""), 3000);
      setMsgText("");
      setMsgSendSms(false);
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message.");
    } finally {
      setSendingMsg(false);
    }
  };

  // Bulk match all users to resources and land storage
  const handleMatchAll = async () => {
    setMatching(true);
    let matchCount = 0;
    try {
      // Fetch all users, resources, and land storage
      const allUsersSnap = await getDocs(collection(db, "users"));
      const allUsers = allUsersSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as User
      );

      const allResSnap = await getDocs(collection(db, "resources"));
      const allResources = allResSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Resource
      );

      const allLandSnap = await getDocs(collection(db, "landStorage"));
      const allLand = allLandSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as LandStorageEntry
      );

      for (const user of allUsers) {
        const userPhone = normalizePhone(user.phone || "");
        const userEmail = (user.email || "").trim().toLowerCase();
        const uid = user.id;

        // Match resources (berths etc.)
        for (const r of allResources) {
          const ids = r.occupantIds || [];
          if (ids.includes(uid)) continue;

          const berth = r as Berth;
          const phoneMatch =
            userPhone &&
            berth.occupantPhone &&
            normalizePhone(berth.occupantPhone) === userPhone;
          const emailMatch =
            userEmail &&
            berth.occupantEmail &&
            berth.occupantEmail.trim().toLowerCase() === userEmail;

          if (phoneMatch || emailMatch) {
            await updateDoc(doc(db, "resources", r.id), {
              occupantIds: arrayUnion(uid),
            });
            matchCount++;
          }
        }

        // Match land storage entries
        for (const entry of allLand) {
          if (entry.occupantId === uid) continue;
          if (entry.occupantId) continue; // already linked to someone

          const phoneMatch =
            userPhone &&
            entry.phone &&
            normalizePhone(entry.phone) === userPhone;
          const emailMatch =
            userEmail &&
            entry.email &&
            entry.email.trim().toLowerCase() === userEmail;

          if (phoneMatch || emailMatch) {
            await updateDoc(doc(db, "landStorage", entry.id), {
              occupantId: uid,
            });
            matchCount++;
          }
        }
      }

      setSuccessMsg(
        matchCount > 0
          ? `Matching complete! ${matchCount} new link(s) created.`
          : "Matching complete. No new matches found."
      );
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      console.error("Error in bulk match:", err);
      alert("Failed to match users. See console.");
    } finally {
      setMatching(false);
    }
  };

  return (
    <Box>
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2, gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={matching ? <CircularProgress size={18} /> : <LinkIcon />}
          onClick={handleMatchAll}
          disabled={matching}
        >
          {matching ? "Matching..." : "Match All Users"}
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add User
        </Button>
      </Box>

      {/* Pending users */}
      {(() => {
        const pending = users.filter((u) => u.approved === false);
        if (pending.length === 0) return null;
        return (
          <Card sx={{ mb: 3, border: "1px solid rgba(255,183,77,0.3)", bgcolor: "rgba(255,183,77,0.04)" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                ⏳ Väntar på godkännande ({pending.length})
              </Typography>
              {pending.map((u) => (
                <Box key={u.id} sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1.5, p: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)" }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{u.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {u.email} · {u.phone}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                      {(u.engagement || []).map((e) => (
                        <Chip key={e} label={ENGAGEMENT_LABELS[e] || e} size="small" variant="outlined" />
                      ))}
                    </Box>
                    {u.registrationNote && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: "italic" }}>
                        “{u.registrationNote}”
                      </Typography>
                    )}
                    {(pendingLinkedObjects[u.id] || []).length > 0 && (
                      <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                        {pendingLinkedObjects[u.id].map((obj) => (
                          <Chip key={obj} label={obj} size="small" color="info" variant="outlined" />
                        ))}
                      </Box>
                    )}
                  </Box>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={approvingId === u.id ? <CircularProgress size={14} /> : <CheckCircleIcon />}
                    onClick={() => handleApproveUser(u.id)}
                    disabled={approvingId === u.id}
                  >
                    Godkänn
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDeleteUser(u.id)}
                  >
                    Neka
                  </Button>
                </Box>
              ))}
            </CardContent>
          </Card>
        );
      })()}

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
                <TableCell>Senast inloggad</TableCell>
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
                  <TableCell>
                    {u.lastLogin
                      ? u.lastLogin.toDate().toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleEditOpen(u)}
                      sx={{ mr: 0.5 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
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

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onClose={() => setEditUser(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={editForm.role}
              label="Role"
              onChange={(e: SelectChangeEvent) =>
                setEditForm({ ...editForm, role: e.target.value as User["role"] })
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
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={editForm.isPublic}
                onChange={(e) => setEditForm({ ...editForm, isPublic: e.target.checked })}
              />
            }
            label="Publik profil"
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2, ml: 2 }}>
            Publik profil gör att kontaktuppgifter visas även för ej inloggade besökare.
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* Internal comment — only for managers/superadmin */}
          <TextField
            fullWidth
            label="Internal Comment (not visible to tenant)"
            multiline
            rows={2}
            value={editForm.internalComment}
            onChange={(e) => setEditForm({ ...editForm, internalComment: e.target.value })}
            sx={{ mb: 2 }}
            helperText="Only visible to Dock Managers and Superadmins"
          />

          <Divider sx={{ my: 2 }} />

          {/* View As + Change Password section */}
          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<VisibilityIcon />}
              onClick={() => editUser && handleViewAs(editUser)}
              sx={{ textTransform: "none" }}
            >
              Visa som denna användare
            </Button>
          </Box>

          <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
            <LockResetIcon fontSize="small" color="primary" />
            Ändra lösenord
          </Typography>
          {adminPasswordError && (
            <Alert severity="error" sx={{ mb: 1 }}>{adminPasswordError}</Alert>
          )}
          {adminPasswordSuccess && (
            <Alert severity="success" sx={{ mb: 1 }}>{adminPasswordSuccess}</Alert>
          )}
          <TextField
            fullWidth
            label="Nytt lösenord"
            type="password"
            value={adminNewPassword}
            onChange={(e) => setAdminNewPassword(e.target.value)}
            sx={{ mb: 1.5 }}
            size="small"
          />
          <TextField
            fullWidth
            label="Bekräfta lösenord"
            type="password"
            value={adminConfirmPassword}
            onChange={(e) => setAdminConfirmPassword(e.target.value)}
            sx={{ mb: 1.5 }}
            size="small"
          />
          <Button
            variant="outlined"
            size="small"
            onClick={handleAdminSetPassword}
            disabled={adminPasswordLoading || !adminNewPassword}
            startIcon={adminPasswordLoading ? <CircularProgress size={16} /> : <LockResetIcon />}
          >
            {adminPasswordLoading ? "Sparar..." : "Sätt lösenord"}
          </Button>

          <Divider sx={{ my: 2 }} />

          {/* Send message to user */}
          <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
            <SmsIcon fontSize="small" color="primary" />
            Send Message to User
          </Typography>
          <TextField
            fullWidth
            label="Message"
            multiline
            rows={2}
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            placeholder="Write a message to this tenant..."
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Checkbox
                checked={msgSendSms}
                onChange={(e) => setMsgSendSms(e.target.checked)}
                size="small"
                disabled={!editUser?.phone}
              />
              <Typography variant="body2" sx={{ opacity: editUser?.phone ? 1 : 0.4 }}>
                Also send as SMS
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={handleSendMessage}
              disabled={!msgText.trim() || sendingMsg}
              startIcon={sendingMsg ? <CircularProgress size={16} /> : <SendIcon />}
            >
              {sendingMsg ? "Sending..." : "Send"}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleEditSave}
            disabled={editSaving}
            startIcon={editSaving ? <CircularProgress size={18} /> : <SaveIcon />}
          >
            {editSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reusable confirmation dialog */}
      <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)}>
        <DialogTitle>{confirmDialog?.title}</DialogTitle>
        <DialogContent><Typography>{confirmDialog?.message}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>Avbryt</Button>
          <Button variant="contained" color="error" onClick={() => confirmDialog?.onConfirm()}>Ja, fortsätt</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Docks Tab ────────────────────────────────────────────
function DocksTab({ initialEditId }: { initialEditId?: string }) {
  const [docks, setDocks] = useState<Dock[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [berths, setBerths] = useState<Berth[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [managerDialogDock, setManagerDialogDock] = useState<Dock | null>(null);
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [editDock, setEditDock] = useState<Dock | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "Association" as Dock["type"],
  });
  const [dockPickerOpen, setDockPickerOpen] = useState(false);
  const [uploadingDockId, setUploadingDockId] = useState<string | null>(null);

  // Generic confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [dSnap, uSnap, rSnap] = await Promise.all([
        getDocs(collection(db, "docks")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "resources")),
      ]);
      setDocks(dSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock).sort((a, b) => a.name.localeCompare(b.name)));
      setUsers(uSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as User));
      setBerths(
        rSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Resource)
          .filter((r) => r.type === "Berth") as Berth[]
      );
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
    setConfirmDialog({
      title: "Ta bort brygga",
      message: "Är du säker på att du vill ta bort denna brygga?",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteDoc(doc(db, "docks", dockId));
          setSuccessMsg("Brygga borttagen!");
          setTimeout(() => setSuccessMsg(""), 3000);
          fetchData();
        } catch (err) {
          console.error("Error deleting dock:", err);
        }
      },
    });
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

  // Dock image upload
  const handleDockImageClick = (dockId: string) => {
    setUploadingDockId(dockId);
    setDockPickerOpen(true);
  };

  const handleDockImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDockId) return;
    try {
      const url = await uploadDockImage(file, uploadingDockId);
      await updateDoc(doc(db, "docks", uploadingDockId), { imageUrl: url });
      setDocks((prev) =>
        prev.map((d) => (d.id === uploadingDockId ? { ...d, imageUrl: url } : d))
      );
      setSuccessMsg("Dock image updated!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error uploading dock image:", err);
    } finally {
      setUploadingDockId(null);
      // Input reset is handled by ImagePickerDialog
    }
  };

  const handleRemoveDockImage = async (dockId: string) => {
    try {
      const dock = docks.find((d) => d.id === dockId);
      if (dock?.imageUrl) await deleteStorageFile(dock.imageUrl);
      await updateDoc(doc(db, "docks", dockId), { imageUrl: "" });
      setDocks((prev) =>
        prev.map((d) => (d.id === dockId ? { ...d, imageUrl: "" } : d))
      );
      setSuccessMsg("Dock image removed.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error removing dock image:", err);
    }
  };

  const handleSaveDock = async () => {
    if (!editDock) return;
    try {
      const { id, ...data } = editDock;
      await updateDoc(doc(db, "docks", id), data as Record<string, unknown>);
      setDocks((prev) =>
        prev.map((d) => (d.id === id ? editDock : d)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditDock(null);
      setSuccessMsg("Dock updated!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error saving dock:", err);
    }
  };

  return (
    <Box>
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      <ImagePickerDialog open={dockPickerOpen} onClose={() => setDockPickerOpen(false)} onChange={handleDockImageChange} />
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
                {dock.imageUrl && (
                  <Box
                    component="img"
                    src={dock.imageUrl}
                    alt={dock.name}
                    sx={{
                      width: "100%",
                      height: 140,
                      objectFit: "cover",
                    }}
                  />
                )}
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
                      color="primary"
                      onClick={() => setEditDock(dock)}
                      sx={{ mr: 0.5 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
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
                  <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleDockImageClick(dock.id)}
                      sx={{ textTransform: "none" }}
                    >
                      {dock.imageUrl ? "Change Image" : "Upload Image"}
                    </Button>
                    {dock.imageUrl && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleRemoveDockImage(dock.id)}
                        sx={{ textTransform: "none" }}
                      >
                        Remove Image
                      </Button>
                    )}
                  </Box>
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

      {/* Edit Dock Dialog */}
      {editDock && (
        <Dialog open={!!editDock} onClose={() => setEditDock(null)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Dock — {editDock.name}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 6, md: 4 }}>
                <TextField
                  fullWidth label="Name" value={editDock.name}
                  onChange={(e) => setEditDock({ ...editDock, name: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <TextField
                  fullWidth label="Prefix" value={editDock.prefix ?? ""}
                  onChange={(e) => setEditDock({ ...editDock, prefix: e.target.value || undefined })}
                  helperText="e.g. A, B, C"
                />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={editDock.type}
                    label="Type"
                    onChange={(e: SelectChangeEvent) =>
                      setEditDock({ ...editDock, type: e.target.value as Dock["type"] })
                    }
                  >
                    <MenuItem value="Association">Association</MenuItem>
                    <MenuItem value="Private">Private</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField
                  fullWidth label="Association Name" value={editDock.associationName ?? ""}
                  onChange={(e) => setEditDock({ ...editDock, associationName: e.target.value || undefined })}
                  helperText="Groups docks by association"
                />
              </Grid>

              <Grid size={{ xs: 6, md: 3 }}>
                <TextField
                  fullWidth label="Width (m)" type="number"
                  value={editDock.maxWidth ?? ""}
                  onChange={(e) => setEditDock({ ...editDock, maxWidth: e.target.value ? Number(e.target.value) : undefined })}
                  slotProps={{ htmlInput: { step: 0.5 } }}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField
                  fullWidth label="Length (m)" type="number"
                  value={editDock.maxLength ?? ""}
                  onChange={(e) => setEditDock({ ...editDock, maxLength: e.target.value ? Number(e.target.value) : undefined })}
                  slotProps={{ htmlInput: { step: 0.5 } }}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField
                  fullWidth label="Heading (°)" type="number"
                  value={editDock.heading ?? ""}
                  onChange={(e) => setEditDock({ ...editDock, heading: e.target.value ? Number(e.target.value) : undefined })}
                  slotProps={{ htmlInput: { step: 1, min: 0, max: 360 } }}
                  helperText="0=North, 90=East"
                />
              </Grid>

              <Grid size={12}>
                <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5, fontWeight: 700 }}>
                  Position — click on the map to place the dock
                </Typography>
                <Box sx={{ height: 350, border: '1px solid rgba(79,195,247,0.15)', borderRadius: 1, overflow: 'hidden', mb: 1 }}>
                  <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}>
                    <GMap
                      defaultCenter={editDock.lat && editDock.lng ? { lat: editDock.lat, lng: editDock.lng } : HARBOR_CENTER}
                      defaultZoom={19}
                      mapId="edit-dock-map"
                      mapTypeId="satellite"
                      style={{ width: '100%', height: '100%' }}
                      gestureHandling="greedy"
                      disableDefaultUI
                      zoomControl
                      onClick={(e) => {
                        const ll = e.detail?.latLng;
                        if (ll) setEditDock({ ...editDock, lat: ll.lat, lng: ll.lng, maxWidth: editDock.maxWidth || 3, maxLength: editDock.maxLength || 20 });
                      }}
                    >
                      <DockMapOverlay
                        editDock={editDock}
                        allDocks={docks}
                        allBerths={berths}
                        onMoveDock={(lat, lng) => setEditDock((prev) => prev ? { ...prev, lat, lng } : prev)}
                      />
                    </GMap>
                  </APIProvider>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Latitude" type="number" size="small"
                    value={editDock.lat ?? ""}
                    onChange={(e) => setEditDock({ ...editDock, lat: e.target.value ? Number(e.target.value) : undefined })}
                    slotProps={{ htmlInput: { step: 0.000001 } }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Longitude" type="number" size="small"
                    value={editDock.lng ?? ""}
                    onChange={(e) => setEditDock({ ...editDock, lng: e.target.value ? Number(e.target.value) : undefined })}
                    slotProps={{ htmlInput: { step: 0.000001 } }}
                    sx={{ flex: 1 }}
                  />
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDock(null)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveDock}>Save</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Reusable confirmation dialog */}
      <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)}>
        <DialogTitle>{confirmDialog?.title}</DialogTitle>
        <DialogContent><Typography>{confirmDialog?.message}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>Avbryt</Button>
          <Button variant="contained" color="error" onClick={() => confirmDialog?.onConfirm()}>Ja, fortsätt</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Dock Map Overlay (draws docks + berths for context in dock edit dialog) ──
function DockMapOverlay({ editDock, allDocks, allBerths, onMoveDock }: {
  editDock: Dock;
  allDocks: Dock[];
  allBerths: Berth[];
  onMoveDock: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map || !coreLib || !markerLib) return;

    const cleanups: (() => void)[] = [];

    const getCenterFromPath = (polygon: google.maps.Polygon) => {
      const path = polygon.getPath();
      let sumLat = 0, sumLng = 0;
      const len = path.getLength();
      for (let i = 0; i < len; i++) {
        const pt = path.getAt(i);
        sumLat += pt.lat();
        sumLng += pt.lng();
      }
      return { lat: sumLat / len, lng: sumLng / len };
    };

    // Draw OTHER docks (static grey)
    allDocks.forEach((d) => {
      if (!d.lat || !d.lng || d.id === editDock.id) return;
      const corners = computeRectCorners(d.lat, d.lng, d.maxWidth || 3, d.maxLength || 20, d.heading || 0);
      const polygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: "#90A4AE",
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: "#78909C",
        fillOpacity: 0.2,
        map,
        zIndex: 1,
      });
      const labelMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: d.lat, lng: d.lng },
        map,
        content: createLabelElement(d.name, false),
        zIndex: 2,
      });
      cleanups.push(() => { polygon.setMap(null); labelMarker.map = null; });
    });

    // Draw CURRENT dock (draggable, orange)
    if (editDock.lat && editDock.lng) {
      const corners = computeRectCorners(editDock.lat, editDock.lng, editDock.maxWidth || 3, editDock.maxLength || 20, editDock.heading || 0);
      const polygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: "#FF9800",
        strokeOpacity: 1,
        strokeWeight: 2,
        fillColor: "#FF9800",
        fillOpacity: 0.35,
        map,
        zIndex: 10,
        draggable: true,
        geodesic: false,
      });
      const labelMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: editDock.lat, lng: editDock.lng },
        map,
        content: createLabelElement(editDock.name, true),
        zIndex: 11,
      });
      polygon.addListener("dragend", () => {
        const center = getCenterFromPath(polygon);
        onMoveDock(center.lat, center.lng);
      });
      cleanups.push(() => { polygon.setMap(null); labelMarker.map = null; });
    }

    // Draw all berths (static, context only)
    allBerths.forEach((b) => {
      if (!b.lat || !b.lng) return;
      const corners = computeBoatHull(b.lat, b.lng, b.maxWidth || 2, b.maxLength || 5, b.heading || 0);
      const polygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: "#4FC3F7",
        strokeOpacity: 0.5,
        strokeWeight: 1,
        fillColor: "#4FC3F7",
        fillOpacity: 0.2,
        map,
        zIndex: 0,
      });
      const labelMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: b.lat, lng: b.lng },
        map,
        content: createLabelElement(b.markingCode, false),
        zIndex: 1,
      });
      cleanups.push(() => { polygon.setMap(null); labelMarker.map = null; });
    });

    return () => { cleanups.forEach((fn) => fn()); };
  }, [map, coreLib, markerLib, editDock, allDocks, allBerths, onMoveDock]);

  return null;
}

// ─── Edit Berth Polygon (draws ALL placed berths as draggable + current berth highlighted) ──
function EditBerthPolygon({ lat, lng, width, length, heading, label, onMove, onMoveOther, allBerths, currentId, resourceType }: {
  lat?: number; lng?: number; width: number; length: number; heading: number;
  label: string;
  onMove?: (lat: number, lng: number) => void;
  onMoveOther?: (id: string, lat: number, lng: number) => void;
  allBerths: Berth[];
  currentId: string;
  resourceType?: string;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map || !coreLib || !markerLib) return;

    const cleanups: (() => void)[] = [];

    // Helper: compute center from polygon path
    const getCenterFromPath = (polygon: google.maps.Polygon) => {
      const path = polygon.getPath();
      let sumLat = 0, sumLng = 0;
      const len = path.getLength();
      for (let i = 0; i < len; i++) {
        const pt = path.getAt(i);
        sumLat += pt.lat();
        sumLng += pt.lng();
      }
      return { lat: sumLat / len, lng: sumLng / len };
    };

    // Draw all OTHER berths (draggable, grey styling)
    allBerths.forEach((b) => {
      if (!b.lat || !b.lng || b.id === currentId) return;

      const bw = b.maxWidth || 2;
      const bl = b.maxLength || 5;
      const bh = b.heading || 0;
      const corners = computeBoatHull(b.lat, b.lng, bw, bl, bh);

      const polygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: "#90A4AE",
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: "#78909C",
        fillOpacity: 0.3,
        map,
        zIndex: 1,
        draggable: true,
        geodesic: false,
      });

      // Label for other berth
      const labelMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: b.lat, lng: b.lng },
        map,
        content: createLabelElement(b.markingCode, false),
        zIndex: 2,
      });

      polygon.addListener("dragend", () => {
        if (!onMoveOther) return;
        const center = getCenterFromPath(polygon);
        onMoveOther(b.id, center.lat, center.lng);
        // Update the label position too
        labelMarker.position = center;
      });

      cleanups.push(() => {
        polygon.setMap(null);
        labelMarker.map = null;
      });
    });

    // Draw CURRENT resource (draggable, cyan)
    if (lat && lng) {
      const isNonBerth = resourceType === "SeaHut" || resourceType === "Box";

      if (isNonBerth) {
        // Draw a circle marker for SeaHuts and Boxes
        const circle = new google.maps.Circle({
          center: { lat, lng },
          radius: 2,
          strokeColor: resourceType === "SeaHut" ? "#FF9800" : "#8BC34A",
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: resourceType === "SeaHut" ? "#FF9800" : "#8BC34A",
          fillOpacity: 0.4,
          map,
          zIndex: 10,
          draggable: true,
        });

        const labelMarker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat, lng },
          map,
          content: createLabelElement(label, true),
          zIndex: 11,
        });

        circle.addListener("dragend", () => {
          if (!onMove) return;
          const center = circle.getCenter();
          if (center) onMove(center.lat(), center.lng());
          labelMarker.position = center;
        });

        cleanups.push(() => {
          circle.setMap(null);
          labelMarker.map = null;
        });
      } else {
        // Draw a boat-hull polygon for Berths
        const corners = computeBoatHull(lat, lng, width, length, heading);
        const polygon = new google.maps.Polygon({
          paths: corners,
          strokeColor: "#00E5FF",
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: "#00E5FF",
          fillOpacity: 0.35,
          map,
          zIndex: 10,
          draggable: true,
          geodesic: false,
        });

        const labelMarker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat, lng },
          map,
          content: createLabelElement(label, true),
          zIndex: 11,
        });

        polygon.addListener("dragend", () => {
          if (!onMove) return;
          const center = getCenterFromPath(polygon);
          onMove(center.lat, center.lng);
          labelMarker.position = center;
        });

        cleanups.push(() => {
          polygon.setMap(null);
          labelMarker.map = null;
        });
      }
    }

    return () => { cleanups.forEach((fn) => fn()); };
  }, [map, coreLib, markerLib, lat, lng, width, length, heading, label, onMove, onMoveOther, allBerths, currentId, resourceType]);

  return null;
}

// Helper: create a styled label DOM element for map markers
function createLabelElement(text: string, isCurrent: boolean): HTMLElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = `
    font-size: 11px;
    font-weight: 700;
    color: ${isCurrent ? "#00E5FF" : "#CFD8DC"};
    background: ${isCurrent ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)"};
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid ${isCurrent ? "#00E5FF" : "transparent"};
    white-space: nowrap;
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  `;
  return el;
}

// ─── Resources Tab ────────────────────────────────────────
function ResourcesTab({ initialEditId }: { initialEditId?: string }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editResource, setEditResource] = useState<Record<string, any> | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [berthPickerOpen, setBerthPickerOpen] = useState(false);
  const [movedBerths, setMovedBerths] = useState<Record<string, { lat: number; lng: number }>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | Resource["type"]>("all");

  // Generic confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
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
      const [rSnap, dSnap, uSnap] = await Promise.all([
        getDocs(collection(db, "resources")),
        getDocs(collection(db, "docks")),
        getDocs(collection(db, "users")),
      ]);
      setResources(
        rSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Resource)
          .sort((a, b) => {
            const sa = (a as Berth).sortOrder ?? 9999;
            const sb = (b as Berth).sortOrder ?? 9999;
            return sa - sb || a.markingCode.localeCompare(b.markingCode, undefined, { numeric: true });
          })
      );
      setDocks(dSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock));
      setUsers(uSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as User));
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleTenantChange = async (resourceId: string, userIds: string[]) => {
    try {
      await updateDoc(doc(db, "resources", resourceId), {
        occupantIds: userIds,
        status: userIds.length > 0 ? "Occupied" : "Available",
      });
      setResources((prev) =>
        prev.map((r) =>
          r.id === resourceId
            ? { ...r, occupantIds: userIds, status: (userIds.length > 0 ? "Occupied" : "Available") as Resource["status"] }
            : r
        )
      );
    } catch (err) {
      console.error("Error assigning tenant:", err);
    }
  };

  const getTenants = (ids?: string[]) => {
    if (!ids || ids.length === 0) return [];
    return users.filter((u) => ids.includes(u.id));
  };

  const handleAddResource = async () => {
    try {
      const id = crypto.randomUUID();
      await setDoc(doc(db, "resources", id), {
        type: form.type,
        markingCode: form.markingCode,
        dockId: form.dockId,
        status: form.status,
        paymentStatus: form.paymentStatus,
        occupantIds: [],
        objectImageUrl: "",
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
    try {
      await deleteDoc(doc(db, "resources", id));
      setDeleteConfirmId(null);
      setSuccessMsg("Resource deleted.");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchAll();
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const getDockName = (dockId: string) =>
    docks.find((d) => d.id === dockId)?.name || dockId || "—";

  const openEditDialog = (r: Resource) => {
    setEditResource(r as Berth);
    setMovedBerths({});
    setEditImageFile(null);
    setEditImagePreview(r.objectImageUrl || null);
    setRemoveImage(false);
  };

  const handleSaveEdit = async () => {
    if (!editResource) return;
    try {
      // Save current resource — convert undefined to deleteField for Firestore
      const { id, ...data } = editResource;

      // Upload image if a new file was selected
      if (editImageFile) {
        data.objectImageUrl = await uploadBoatImage(editImageFile, id);
      } else if (removeImage) {
        if (editResource.objectImageUrl) await deleteStorageFile(editResource.objectImageUrl);
        data.objectImageUrl = "";
      }

      const cleanData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        cleanData[key] = value === undefined ? deleteField() : value;
      }
      await updateDoc(doc(db, "resources", id), cleanData);

      // Batch-save any other berths that were moved by dragging
      const moveEntries = Object.entries(movedBerths);
      for (const [berthId, pos] of moveEntries) {
        if (berthId !== id) {
          await updateDoc(doc(db, "resources", berthId), { lat: pos.lat, lng: pos.lng });
        }
      }

      // Update local state
      setResources((prev) =>
        prev.map((r) => {
          if (r.id === id) return editResource as Resource;
          const moved = movedBerths[r.id];
          if (moved) return { ...r, lat: moved.lat, lng: moved.lng } as Resource;
          return r;
        })
          .sort((a, b) => {
            const sa = (a as Berth).sortOrder ?? 9999;
            const sb = (b as Berth).sortOrder ?? 9999;
            return sa - sb || a.markingCode.localeCompare(b.markingCode, undefined, { numeric: true });
          })
      );
      setEditResource(null);
      setMovedBerths({});
      setSuccessMsg(`Resource updated!${moveEntries.length > 0 ? ` ${moveEntries.length} berth(s) repositioned.` : ""}`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error saving resource:", err);
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
          Add Resource
        </Button>
      </Box>

      {/* Search and filter bar */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          size="small"
          placeholder="Search by code, name, phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ minWidth: 260 }}
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
          value={filterType}
          exclusive
          onChange={(_, val) => val && setFilterType(val)}
        >
          <ToggleButton value="all">All ({resources.length})</ToggleButton>
          <ToggleButton value="Berth">Berth ({resources.filter((r) => r.type === "Berth").length})</ToggleButton>
          <ToggleButton value="SeaHut">SeaHut ({resources.filter((r) => r.type === "SeaHut").length})</ToggleButton>
          <ToggleButton value="Box">Box ({resources.filter((r) => r.type === "Box").length})</ToggleButton>
        </ToggleButtonGroup>
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
                <TableCell>Dir</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Ansvarig</TableCell>
                <TableCell sx={{ minWidth: 220 }}>Tenant</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resources
                .filter((r) => filterType === "all" || r.type === filterType)
                .filter((r) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  const tenants = getTenants(r.occupantIds);
                  const tenantNames = tenants.map((t) => t.name.toLowerCase()).join(" ");
                  const dockName = getDockName(r.dockId || "").toLowerCase();
                  // Also check occupant fields stored directly on the resource
                  const b = r as Berth;
                  const occupantName = [b.occupantFirstName, b.occupantLastName].filter(Boolean).join(" ").toLowerCase();
                  return (
                    r.markingCode.toLowerCase().includes(q) ||
                    tenantNames.includes(q) ||
                    dockName.includes(q) ||
                    occupantName.includes(q)
                  );
                })
                .map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {r.markingCode}
                    {r.lat && r.lng && (
                      <PublicIcon sx={{ fontSize: 14, ml: 0.5, mb: -0.3, color: "success.main", opacity: 0.8 }} titleAccess={`${r.lat?.toFixed(5)}, ${r.lng?.toFixed(5)}`} />
                    )}
                    {r.heading != null && r.heading !== 0 && (
                      <Typography component="span" variant="caption" sx={{ ml: 0.5, color: "text.secondary" }}>
                        {r.heading}°
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={r.type} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{getDockName(r.dockId || "")}</TableCell>
                  <TableCell>
                    {r.type === "Berth" && (r as Berth).direction ? (
                      <Chip
                        label={(r as Berth).direction === "inside" ? "Insida" : "Utsida"}
                        size="small"
                        color={(r as Berth).direction === "inside" ? "info" : "warning"}
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
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
                  <TableCell>
                    {(() => {
                      const b = r as Berth;
                      // First try to show invoice-responsible from tenants array
                      if (b.tenants && b.tenants.length > 0 && b.invoiceResponsibleId) {
                        const responsible = b.tenants.find(t => t.uid === b.invoiceResponsibleId);
                        if (responsible) {
                          return (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <Typography variant="body2">{responsible.name}</Typography>
                              <Chip label="F" size="small" color="primary" sx={{ height: 20, fontSize: 11 }} title="Faktureringsansvarig" />
                            </Box>
                          );
                        }
                      }
                      // Fallback to legacy occupant fields
                      const name = [b.occupantFirstName, b.occupantLastName].filter(Boolean).join(" ");
                      if (!name) return <Typography variant="caption" color="text.secondary">—</Typography>;
                      const matched = users.some(
                        (u) => u.name.toLowerCase() === name.toLowerCase()
                              || u.email?.toLowerCase() === b.occupantEmail?.toLowerCase()
                      );
                      return (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Typography variant="body2">{name}</Typography>
                          {matched ? (
                            <Chip label="✓" size="small" color="success" sx={{ height: 20, fontSize: 11 }} />
                          ) : (
                            <Chip label="?" size="small" color="default" sx={{ height: 20, fontSize: 11 }} />
                          )}
                        </Box>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Autocomplete
                      multiple
                      size="small"
                      options={users}
                      getOptionLabel={(u) => `${u.name} (${u.email})`}
                      value={getTenants(r.occupantIds)}
                      onChange={(_e, newVal) => handleTenantChange(r.id, newVal.map((u) => u.id))}
                      isOptionEqualToValue={(opt, val) => opt.id === val.id}
                      renderInput={(params) => (
                        <TextField {...params} placeholder="Tilldela..." variant="outlined" size="small" />
                      )}
                      sx={{ minWidth: 220 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => openEditDialog(r)}
                      sx={{ mr: 0.5 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteConfirmId(r.id)}
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

      {/* Edit Resource Dialog */}
      {editResource && (
        <Dialog open={!!editResource} onClose={() => setEditResource(null)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Resource — {editResource.markingCode}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>

              {/* ── Section 1: Identity ── */}
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField
                  fullWidth label="Marking Code" value={editResource.markingCode}
                  onChange={(e) => setEditResource({ ...editResource, markingCode: e.target.value })}
                />
              </Grid>
              {editResource.type === "SeaHut" && (
                <Grid size={{ xs: 6, md: 3 }}>
                  <FormControl fullWidth>
                    <InputLabel>Size</InputLabel>
                    <Select
                      value={(editResource as SeaHut).size || ""}
                      label="Size"
                      onChange={(e: SelectChangeEvent) => setEditResource({ ...editResource, size: e.target.value as SeaHut["size"] })}
                    >
                      <MenuItem value="Large">Large (Stor)</MenuItem>
                      <MenuItem value="Small">Small (Liten)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              {editResource.type === "Berth" && (
                <>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <TextField
                      fullWidth label="Sort Order" type="number"
                      value={editResource.sortOrder ?? ""}
                      onChange={(e) => setEditResource({ ...editResource, sortOrder: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <FormControl fullWidth>
                      <InputLabel>Direction</InputLabel>
                      <Select
                        value={editResource.direction || ""}
                        label="Direction"
                        onChange={(e: SelectChangeEvent) => setEditResource({ ...editResource, direction: (e.target.value || undefined) as Berth["direction"] })}
                      >
                        <MenuItem value=""><em>Not set</em></MenuItem>
                        <MenuItem value="inside">Inside (sheltered)</MenuItem>
                        <MenuItem value="outside">Outside (exposed)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <FormControl fullWidth>
                      <InputLabel>Dock</InputLabel>
                      <Select
                        value={editResource.dockId || ""}
                        label="Dock"
                        onChange={(e: SelectChangeEvent) => setEditResource({ ...editResource, dockId: e.target.value })}
                      >
                        {docks.map((d) => (
                          <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editResource.allowSecondHand ?? false}
                          onChange={(e) => setEditResource({ ...editResource, allowSecondHand: e.target.checked })}
                        />
                      }
                      label="Allow Subletting"
                    />
                  </Grid>
                  {editResource.allowSecondHand && (
                    <Grid size={{ xs: 6, md: 3 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={editResource.invoiceSecondHandTenantDirectly ?? false}
                            onChange={(e) => setEditResource({ ...editResource, invoiceSecondHandTenantDirectly: e.target.checked })}
                          />
                        }
                        label="Invoice 2nd-hand Tenant"
                      />
                    </Grid>
                  )}
                </>
              )}

              {/* ── Section 2: Occupant (SeaHut & Box) ── */}
              {(editResource.type === "SeaHut" || editResource.type === "Box") && (
                <>
                  <Grid size={12}><Divider sx={{ borderColor: 'rgba(79,195,247,0.15)' }} /></Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <TextField
                      fullWidth label="First Name"
                      value={editResource.occupantFirstName ?? ""}
                      onChange={(e) => setEditResource({ ...editResource, occupantFirstName: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <TextField
                      fullWidth label="Last Name"
                      value={editResource.occupantLastName ?? ""}
                      onChange={(e) => setEditResource({ ...editResource, occupantLastName: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <TextField
                      fullWidth label="Phone"
                      value={editResource.occupantPhone ?? ""}
                      onChange={(e) => setEditResource({ ...editResource, occupantPhone: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <TextField
                      fullWidth label="Email" type="email"
                      value={editResource.occupantEmail ?? ""}
                      onChange={(e) => setEditResource({ ...editResource, occupantEmail: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      fullWidth label="Address"
                      value={editResource.occupantAddress ?? ""}
                      onChange={(e) => setEditResource({ ...editResource, occupantAddress: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      fullWidth label="Postal Address"
                      value={editResource.occupantPostalAddress ?? ""}
                      onChange={(e) => setEditResource({ ...editResource, occupantPostalAddress: e.target.value })}
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField
                      fullWidth label="Comment" multiline minRows={1}
                      value={editResource.comment ?? ""}
                      onChange={(e) => setEditResource({ ...editResource, comment: e.target.value })}
                    />
                  </Grid>
                </>
              )}

              {/* ── Section 3: Dimensions ── */}
              <Grid size={12}><Divider sx={{ borderColor: 'rgba(79,195,247,0.15)' }} /></Grid>
              <Grid size={{ xs: 4, md: 2 }}>
                <TextField
                  fullWidth label={editResource.type === "Berth" ? "Max Width (m)" : "Width (m)"} type="number"
                  value={editResource.maxWidth ?? ""}
                  onChange={(e) => setEditResource({ ...editResource, maxWidth: e.target.value ? Number(e.target.value) : undefined })}
                  slotProps={{ htmlInput: { step: 0.1 } }}
                />
              </Grid>
              <Grid size={{ xs: 4, md: 2 }}>
                <TextField
                  fullWidth label={editResource.type === "Berth" ? "Max Length (m)" : "Length (m)"} type="number"
                  value={editResource.maxLength ?? ""}
                  onChange={(e) => setEditResource({ ...editResource, maxLength: e.target.value ? Number(e.target.value) : undefined })}
                  slotProps={{ htmlInput: { step: 0.1 } }}
                />
              </Grid>
              <Grid size={{ xs: 4, md: 2 }}>
                <TextField
                  fullWidth label="Heading (°)" type="number"
                  value={editResource.heading ?? ""}
                  onChange={(e) => setEditResource({ ...editResource, heading: e.target.value ? Number(e.target.value) : undefined })}
                  slotProps={{ htmlInput: { step: 1, min: 0, max: 360 } }}
                  helperText="0=N, 90=E"
                />
              </Grid>

              {/* ── Section 4: Position / Map ── */}
              <Grid size={12}>
                <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5, fontWeight: 700 }}>
                  Position — click on the map to position the object
                </Typography>
                <Box sx={{ height: 350, border: '1px solid rgba(79,195,247,0.15)', borderRadius: 1, overflow: 'hidden', mb: 1 }}>
                  <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}>
                    <GMap
                      defaultCenter={editResource.lat && editResource.lng ? { lat: editResource.lat, lng: editResource.lng } : HARBOR_CENTER}
                      defaultZoom={19}
                      mapId="edit-berth-map"
                      mapTypeId="satellite"
                      style={{ width: '100%', height: '100%' }}
                      gestureHandling="greedy"
                      disableDefaultUI
                      zoomControl
                      onClick={(e) => {
                        const ll = e.detail?.latLng;
                        if (ll) setEditResource({ ...editResource, lat: ll.lat, lng: ll.lng, maxWidth: editResource.maxWidth || 2, maxLength: editResource.maxLength || 5 });
                      }}
                    >
                      <EditBerthPolygon
                        lat={editResource.lat}
                        lng={editResource.lng}
                        width={editResource.maxWidth || 2}
                        length={editResource.maxLength || 5}
                        heading={editResource.heading || 0}
                        label={editResource.markingCode}
                        resourceType={editResource.type}
                        onMove={(lat, lng) => setEditResource((prev) => prev ? { ...prev, lat, lng } : prev)}
                        onMoveOther={(id, lat, lng) => setMovedBerths((prev) => ({ ...prev, [id]: { lat, lng } }))}
                        allBerths={resources.filter((r) => r.type === "Berth") as Berth[]}
                        currentId={editResource.id}
                      />
                    </GMap>
                  </APIProvider>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField
                    label="Latitude" type="number" size="small"
                    value={editResource.lat ?? ""}
                    onChange={(e) => setEditResource({ ...editResource, lat: e.target.value ? Number(e.target.value) : undefined })}
                    slotProps={{ htmlInput: { step: 0.000001 } }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Longitude" type="number" size="small"
                    value={editResource.lng ?? ""}
                    onChange={(e) => setEditResource({ ...editResource, lng: e.target.value ? Number(e.target.value) : undefined })}
                    slotProps={{ htmlInput: { step: 0.000001 } }}
                    sx={{ flex: 1 }}
                  />
                  {(editResource.lat != null || editResource.lng != null) && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => setEditResource({ ...editResource, lat: undefined, lng: undefined })}
                    >
                      Clear
                    </Button>
                  )}
                </Box>
              </Grid>

              {/* ── Section 5: Pricing ── */}
              <Grid size={12}><Divider sx={{ borderColor: 'rgba(79,195,247,0.15)' }} /></Grid>
              <Grid size={12}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Prisutveckling</Typography>
                {(() => {
                  // Merge legacy price fields with prices map
                  const pricesMap: Record<string, number> = { ...(editResource.prices || {}) };
                  if (editResource.price2025 && !pricesMap["2025"]) pricesMap["2025"] = editResource.price2025;
                  if (editResource.price2026 && !pricesMap["2026"]) pricesMap["2026"] = editResource.price2026;
                  const years = Object.keys(pricesMap).sort();
                  const currentYear = new Date().getFullYear().toString();
                  const prevYear = (parseInt(currentYear) - 1).toString();
                  const hasCurrentYear = years.includes(currentYear);

                  return (
                    <Box>
                      <Table size="small" sx={{ mb: 1, "& td, & th": { borderColor: "rgba(79,195,247,0.1)" } }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, width: 100 }}>År</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Pris (kr)</TableCell>
                            <TableCell sx={{ fontWeight: 700, width: 60 }} align="right">Ändring</TableCell>
                            <TableCell sx={{ width: 50 }} />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {years.map((year, idx) => {
                            const price = pricesMap[year];
                            const prevPrice = idx > 0 ? pricesMap[years[idx - 1]] : null;
                            const change = prevPrice != null && prevPrice > 0
                              ? ((price - prevPrice) / prevPrice * 100).toFixed(0)
                              : null;
                            return (
                              <TableRow key={year}>
                                <TableCell sx={{ fontWeight: 600 }}>{year}</TableCell>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={price}
                                    onChange={(e) => {
                                      const newPrices = { ...pricesMap, [year]: e.target.value ? Number(e.target.value) : 0 };
                                      setEditResource({ ...editResource, prices: newPrices, price2025: undefined, price2026: undefined });
                                    }}
                                    slotProps={{ htmlInput: { min: 0, step: 100 } }}
                                    sx={{ width: 140 }}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  {change != null && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontWeight: 600,
                                        color: parseInt(change) > 0 ? "#EF5350" : parseInt(change) < 0 ? "#66BB6A" : "text.secondary",
                                      }}
                                    >
                                      {parseInt(change) > 0 ? "+" : ""}{change}%
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                      const { [year]: _, ...rest } = pricesMap;
                                      setEditResource({ ...editResource, prices: rest, price2025: undefined, price2026: undefined });
                                    }}
                                    title="Ta bort"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {years.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                  Inga priser registrerade
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        {!hasCurrentYear && pricesMap[prevYear] && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            sx={{ textTransform: "none" }}
                            onClick={() => {
                              const newPrices = { ...pricesMap, [currentYear]: pricesMap[prevYear] };
                              setEditResource({ ...editResource, prices: newPrices, price2025: undefined, price2026: undefined });
                            }}
                          >
                            Samma pris {currentYear} ({pricesMap[prevYear]} kr)
                          </Button>
                        )}
                        {!hasCurrentYear && (
                          <Button
                            size="small"
                            variant="outlined"
                            sx={{ textTransform: "none" }}
                            onClick={() => {
                              const newPrices = { ...pricesMap, [currentYear]: 0 };
                              setEditResource({ ...editResource, prices: newPrices, price2025: undefined, price2026: undefined });
                            }}
                          >
                            + Nytt pris {currentYear}
                          </Button>
                        )}
                      </Box>
                    </Box>
                  );
                })()}
              </Grid>

              {/* ── Section 6: Photo ── */}
              <Grid size={12}><Divider sx={{ borderColor: 'rgba(79,195,247,0.15)' }} /></Grid>
              <Grid size={12}>
                <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 700 }}>Photo</Typography>
                <ImagePickerDialog
                  open={berthPickerOpen}
                  onClose={() => setBerthPickerOpen(false)}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditImageFile(file);
                      setEditImagePreview(URL.createObjectURL(file));
                      setRemoveImage(false);
                    }
                  }}
                />
                {editImagePreview && !removeImage ? (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box
                      component="img"
                      src={editImagePreview}
                      alt="Resource"
                      sx={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 1, border: '1px solid rgba(79,195,247,0.2)' }}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => setBerthPickerOpen(true)}>
                        Change
                      </Button>
                      <Button size="small" color="error" onClick={() => { setRemoveImage(true); setEditImageFile(null); }}>
                        Remove
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Button size="small" variant="outlined" onClick={() => setBerthPickerOpen(true)}>
                    Upload photo
                  </Button>
                )}
              </Grid>

              {/* ── Section 7: Tenants (berths only) ── */}
              {editResource.type === "Berth" && (
                <>
                  <Grid size={12}><Divider sx={{ borderColor: 'rgba(79,195,247,0.15)' }} /></Grid>
                  <Grid size={12}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Hyresgäster</Typography>
                    {(editResource.tenants as BerthTenant[] || []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>Inga hyresgäster registrerade</Typography>
                    ) : (
                      <>
                        <RadioGroup
                          value={editResource.invoiceResponsibleId || ""}
                          onChange={(e) => setEditResource({ ...editResource, invoiceResponsibleId: e.target.value })}
                        >
                          {(editResource.tenants as BerthTenant[]).map((t: BerthTenant) => (
                            <Box key={t.uid} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, p: 1, borderRadius: 1, bgcolor: "rgba(79,195,247,0.05)", border: "1px solid rgba(79,195,247,0.1)" }}>
                              <FormControlLabel
                                value={t.uid}
                                control={<Radio size="small" />}
                                label=""
                                sx={{ mr: 0 }}
                              />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {t.name}
                                  {editResource.invoiceResponsibleId === t.uid && (
                                    <Chip label="Faktureringsansvarig" size="small" color="primary" sx={{ ml: 1, height: 20, fontSize: 11 }} />
                                  )}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {t.phone} &middot; {t.email}
                                </Typography>
                              </Box>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setConfirmDialog({
                                    title: "Ta bort hyresgäst",
                                    message: `Vill du ta bort ${t.name} från denna plats?`,
                                    onConfirm: () => {
                                      setConfirmDialog(null);
                                      const updatedTenants = (editResource.tenants as BerthTenant[]).filter((x: BerthTenant) => x.uid !== t.uid);
                                      const updatedOccupantIds = (editResource.occupantIds || []).filter((id: string) => id !== t.uid);
                                      const newInvoiceId = editResource.invoiceResponsibleId === t.uid
                                        ? (updatedTenants.length > 0 ? updatedTenants[0].uid : undefined)
                                        : editResource.invoiceResponsibleId;
                                      setEditResource({
                                        ...editResource,
                                        tenants: updatedTenants,
                                        occupantIds: updatedOccupantIds,
                                        invoiceResponsibleId: newInvoiceId,
                                        status: updatedOccupantIds.length > 0 ? "Occupied" : "Available",
                                      });
                                    },
                                  });
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ))}
                        </RadioGroup>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                          Välj faktureringsansvarig med radioknappen
                        </Typography>
                      </>
                    )}
                  </Grid>
                </>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditResource(null)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEdit}>Save</Button>
          </DialogActions>
        </Dialog>
      )}
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} maxWidth="xs">
        <DialogTitle>Delete resource?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this resource? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteConfirmId && handleDeleteResource(deleteConfirmId)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reusable confirmation dialog */}
      <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)}>
        <DialogTitle>{confirmDialog?.title}</DialogTitle>
        <DialogContent><Typography>{confirmDialog?.message}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>Avbryt</Button>
          <Button variant="contained" color="error" onClick={() => confirmDialog?.onConfirm()}>Ja, fortsätt</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Interests Tab ────────────────────────────────────────
function InterestsTab({ initialEditId }: { initialEditId?: string }) {
  const { firebaseUser, profile } = useAuth();
  const [interests, setInterests] = useState<BerthInterest[]>([]);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");

  // Detail dialog state
  const [selectedInterest, setSelectedInterest] = useState<BerthInterest | null>(null);
  const [replies, setReplies] = useState<InterestReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Offer form state — multi-berth
  const [offerBerths, setOfferBerths] = useState<OfferedBerth[]>([]);
  const currentYear = new Date().getFullYear().toString();
  const prevYear = String(parseInt(currentYear) - 1);

  const isSuperadmin = profile?.role === "Superadmin";

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [iSnap, dSnap, rSnap] = await Promise.all([
        getDocs(query(collection(db, "interests"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "docks")),
        getDocs(collection(db, "resources")),
      ]);
      const allDocks = dSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock);
      setDocks(allDocks);
      setResources(rSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Resource));

      let allInterests = iSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as BerthInterest);

      // Dock managers: only see interests for their docks + interests with no dock preference
      if (!isSuperadmin && firebaseUser) {
        const managedDockIds = new Set(
          allDocks.filter((d) => d.managerIds?.includes(firebaseUser.uid)).map((d) => d.id)
        );
        allInterests = allInterests.filter(
          (i) => !i.preferredDockId || managedDockIds.has(i.preferredDockId)
        );
      }

      setInterests(allInterests);
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
    setOfferBerths([]);
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
      // Build the reply document
      const replyDoc: Record<string, unknown> = {
        interestId: selectedInterest.id,
        authorId: firebaseUser.uid,
        authorName: profile.name,
        authorEmail: profile.email || firebaseUser.email || "",
        authorPhone: profile.phone || "",
        message: replyMessage.trim(),
        createdAt: Timestamp.now(),
      };

      // Include berth offers if any berths are selected
      if (offerBerths.length > 0) {
        replyDoc.offeredBerths = offerBerths;
        // Legacy compat: set single-berth fields from first offer
        replyDoc.offeredBerthId = offerBerths[0].berthId;
        replyDoc.offeredBerthCode = offerBerths[0].berthCode;
        replyDoc.offeredDockName = offerBerths[0].dockName;
        replyDoc.offeredPrice = offerBerths[0].price ?? null;
        replyDoc.offerStatus = "pending";
      }

      await addDoc(collection(db, "interests", selectedInterest.id, "replies"), replyDoc);

      // Move status to Contacted if still Pending
      if (selectedInterest.status === "Pending") {
        await handleStatusChange(selectedInterest.id, "Contacted");
      }

      // SMS is handled by the onInterestReplyCreated Cloud Function trigger

      setReplyMessage("");
      setOfferBerths([]);
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

  const getBerthCode = (berthId?: string) =>
    berthId ? resources.find((r) => r.id === berthId)?.markingCode || "—" : "—";

  const formatDate = (ts: Timestamp) =>
    ts.toDate().toLocaleDateString("sv-SE");

  const formatDateTime = (ts: Timestamp) =>
    ts.toDate().toLocaleString("sv-SE");

  const statusColor = (status: string): "warning" | "info" | "success" =>
    status === "Pending" ? "warning" : status === "Contacted" ? "info" : "success";

  // Compute available berths the current manager can offer
  const availableOfferBerths = (() => {
    if (!firebaseUser) return [];
    // Superadmins can offer from any dock; managers only from their docks
    const managedDockIds = isSuperadmin
      ? docks.map((d) => d.id)
      : docks.filter((d) => d.managerIds?.includes(firebaseUser.uid)).map((d) => d.id);
    return (resources as Berth[])
      .filter(
        (r) =>
          r.type === "Berth" &&
          r.status === "Available" &&
          r.dockId &&
          managedDockIds.includes(r.dockId)
      )
      .sort((a, b) => (a.markingCode || "").localeCompare(b.markingCode || ""));
  })();

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
                <TableCell>Önskad plats</TableCell>
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
                      <InsertPhotoIcon
                        sx={{ color: "#4FC3F7", cursor: "pointer", fontSize: 28 }}
                        titleAccess="Visa bild"
                        onClick={() => window.open(interest.imageUrl!, "_blank")}
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
                  <TableCell>{getBerthCode(interest.preferredBerthId)}</TableCell>
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
                const interest = interests.find((i) => i.id === deleteConfirmId);
                if (interest?.imageUrl) await deleteStorageFile(interest.imageUrl);
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
                  {selectedInterest.preferredBerthId && (
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Önskad plats
                      </Typography>
                      <Typography variant="body2">
                        {getBerthCode(selectedInterest.preferredBerthId)}
                      </Typography>
                    </Grid>
                  )}
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
                        bgcolor: (reply.offeredBerths?.length || reply.offeredBerthId)
                          ? "rgba(102, 187, 106, 0.06)"
                          : "rgba(79,195,247,0.04)",
                        border: (reply.offeredBerths?.length || reply.offeredBerthId)
                          ? "1px solid rgba(102, 187, 106, 0.25)"
                          : "1px solid rgba(79,195,247,0.12)",
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
                        {/* Berth offer details — multi-berth with legacy fallback */}
                        {(() => {
                          const berths: OfferedBerth[] = reply.offeredBerths
                            ?? (reply.offeredBerthId
                              ? [{ berthId: reply.offeredBerthId, berthCode: reply.offeredBerthCode || reply.offeredBerthId, dockName: reply.offeredDockName || "", price: reply.offeredPrice }]
                              : []);
                          return berths.length > 0 ? (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 1 }}>
                              {berths.map((ob) => (
                                <Box
                                  key={ob.berthId}
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 1.5,
                                    bgcolor: "rgba(102, 187, 106, 0.08)",
                                    border: "1px solid rgba(102, 187, 106, 0.15)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 2,
                                  }}
                                >
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
                                </Box>
                              ))}
                            </Box>
                          ) : null;
                        })()}
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

                {/* Multi-berth offer selector */}
                <Box
                  sx={{
                    p: 1.5,
                    mb: 2,
                    borderRadius: 1.5,
                    bgcolor: offerBerths.length > 0 ? "rgba(102, 187, 106, 0.06)" : "rgba(79,195,247,0.03)",
                    border: offerBerths.length > 0 ? "1px solid rgba(102, 187, 106, 0.2)" : "1px solid rgba(79,195,247,0.08)",
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.light", mb: 1, display: "block" }}>
                    ⚓ Erbjud lediga platser (valfritt)
                  </Typography>

                  {/* List of added berths */}
                  {offerBerths.length > 0 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1.5 }}>
                      {offerBerths.map((ob, idx) => (
                        <Box
                          key={ob.berthId}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: "rgba(102, 187, 106, 0.08)",
                            border: "1px solid rgba(102, 187, 106, 0.15)",
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                            ⚓ {ob.berthCode}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                            {ob.dockName}
                          </Typography>
                          <TextField
                            size="small"
                            label="Pris (kr/år)"
                            type="number"
                            value={ob.price ?? ""}
                            onChange={(e) => {
                              const updated = [...offerBerths];
                              updated[idx] = { ...ob, price: e.target.value ? Number(e.target.value) : undefined };
                              setOfferBerths(updated);
                            }}
                            slotProps={{ htmlInput: { min: 0, step: 100 } }}
                            sx={{ width: 130, ml: "auto" }}
                          />
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setOfferBerths(offerBerths.filter((_, i) => i !== idx))}
                            title="Ta bort"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Dropdown to add more berths */}
                  {(() => {
                    const selectedIds = new Set(offerBerths.map((ob) => ob.berthId));
                    const remaining = availableOfferBerths.filter((b) => !selectedIds.has(b.id));
                    return remaining.length > 0 ? (
                      <FormControl fullWidth size="small">
                        <InputLabel>Lägg till plats</InputLabel>
                        <Select
                          value=""
                          label="Lägg till plats"
                          onChange={(e) => {
                            const berthId = e.target.value;
                            if (!berthId) return;
                            const berth = resources.find((r) => r.id === berthId) as Berth | undefined;
                            const dock = berth?.dockId ? docks.find((d) => d.id === berth.dockId) : null;
                            // Default price: currentYear > prevYear > empty
                            const defaultPrice = (berth as Berth)?.prices?.[currentYear]
                              ?? (berth as Berth)?.prices?.[prevYear]
                              ?? (berth as Berth)?.price2026
                              ?? (berth as Berth)?.price2025
                              ?? undefined;
                            setOfferBerths([
                              ...offerBerths,
                              {
                                berthId,
                                berthCode: berth?.markingCode || berthId,
                                dockName: dock?.name || "",
                                price: defaultPrice,
                              },
                            ]);
                          }}
                        >
                          <MenuItem value="" disabled>Välj plats...</MenuItem>
                          {remaining.map((b) => (
                            <MenuItem key={b.id} value={b.id}>
                              {b.markingCode}
                              {" — "}
                              {docks.find((d) => d.id === b.dockId)?.name || ""}
                              {b.maxWidth && b.maxLength ? ` (${b.maxLength}×${b.maxWidth}m)` : ""}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : null;
                  })()}
                </Box>

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
                  {sendingReply ? "Skickar..." : offerBerths.length > 0 ? `Skicka anbud (${offerBerths.length} platser)` : "Skicka svar"}
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

// ─── Abandoned Objects Tab ────────────────────────────────
const ABANDONED_OBJECT_TYPES: { value: AbandonedObjectType; label: string }[] = [
  { value: "Boat", label: "Båt" },
  { value: "SeaHut", label: "Sjöbod" },
  { value: "Box", label: "Låda" },
  { value: "Other", label: "Övrigt" },
];

function AbandonedObjectsTab({ initialEditId }: { initialEditId?: string }) {
  const [entries, setEntries] = useState<AbandonedObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<AbandonedObject | null>(null);
  const [saving, setSaving] = useState(false);
  const [abandonedPickerOpen, setAbandonedPickerOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [removedExistingImage, setRemovedExistingImage] = useState(false);

  // Generic confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const [form, setForm] = useState({
    objectType: "Boat" as AbandonedObjectType,
    lat: "",
    lng: "",
    abandonedSince: "",
    comment: "",
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  async function fetchEntries() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "abandonedObjects"));
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as AbandonedObject)
        .sort((a, b) => a.abandonedId - b.abandonedId);
      setEntries(data);
    } catch (err) {
      console.error("Error fetching abandoned objects:", err);
    } finally {
      setLoading(false);
    }
  }

  function getNextId(): number {
    if (entries.length === 0) return 1;
    return Math.max(...entries.map((e) => e.abandonedId)) + 1;
  }

  function openAdd() {
    setEditEntry(null);
    setForm({ objectType: "Boat", lat: "", lng: "", abandonedSince: new Date().toISOString().slice(0, 10), comment: "" });
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovedExistingImage(false);
    setDialogOpen(true);
  }

  function openEdit(entry: AbandonedObject) {
    setEditEntry(entry);
    const d = entry.abandonedSince?.toDate?.() ?? new Date();
    setForm({
      objectType: entry.objectType || "Boat",
      lat: String(entry.lat),
      lng: String(entry.lng),
      abandonedSince: d.toISOString().slice(0, 10),
      comment: entry.comment || "",
    });
    setPhotoFile(null);
    setPhotoPreview(entry.imageUrl || null);
    setRemovedExistingImage(false);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const hasCoords = form.lat.trim() !== "" && form.lng.trim() !== "";
      const lat = hasCoords ? parseFloat(form.lat) : NaN;
      const lng = hasCoords ? parseFloat(form.lng) : NaN;
      if (hasCoords && (isNaN(lat) || isNaN(lng))) {
        alert("Latitude and longitude must be valid numbers.");
        setSaving(false);
        return;
      }

      const docId = editEntry ? editEntry.id : `abandoned-${getNextId()}`;
      let imageUrl = editEntry?.imageUrl || "";

      if (removedExistingImage && !photoFile) {
        // User removed the existing image without uploading a new one
        if (editEntry?.imageUrl) {
          await deleteStorageFile(editEntry.imageUrl);
        }
        imageUrl = "";
      } else if (photoFile) {
        // Delete old image from storage before uploading a new one
        if (editEntry?.imageUrl) {
          await deleteStorageFile(editEntry.imageUrl);
        }
        imageUrl = await uploadAbandonedObjectImage(photoFile, docId);
      }

      const data: Record<string, unknown> = {
        abandonedId: editEntry?.abandonedId ?? getNextId(),
        objectType: form.objectType,
        lat: hasCoords ? lat : deleteField(),
        lng: hasCoords ? lng : deleteField(),
        imageUrl,
        abandonedSince: Timestamp.fromDate(new Date(form.abandonedSince)),
        comment: form.comment.trim(),
      };

      await setDoc(doc(db, "abandonedObjects", docId), data, { merge: true });

      setDialogOpen(false);
      setSuccessMsg(editEntry ? "Uppdaterad!" : "Skapad!");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchEntries();
    } catch (err) {
      console.error("Error saving abandoned object:", err);
      alert("Failed to save. See console.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setConfirmDialog({
      title: "Ta bort objekt",
      message: "Är du säker på att du vill ta bort detta objekt?",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const entry = entries.find((e) => e.id === id);
          if (entry?.imageUrl) await deleteStorageFile(entry.imageUrl);
          await deleteDoc(doc(db, "abandonedObjects", id));
          setSuccessMsg("Borttagen!");
          setTimeout(() => setSuccessMsg(""), 3000);
          fetchEntries();
        } catch (err) {
          console.error("Error deleting abandoned object:", err);
        }
      },
    });
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));

    // Extract EXIF GPS if lat/lng form fields are empty
    if (!form.lat.trim() && !form.lng.trim()) {
      const gps = await extractExifGps(file);
      if (gps) {
        setForm((prev) => ({ ...prev, lat: String(gps.lat), lng: String(gps.lng) }));
        setSuccessMsg("GPS-position har hämtats från bilden. Kontrollera och justera positionen vid behov.");
        setTimeout(() => setSuccessMsg(""), 6000);
      }
    }
  }

  // Remove an existing image from an abandoned object
  async function handleRemoveImage(entryId: string, imageUrl: string) {
    setConfirmDialog({
      title: "Ta bort bild",
      message: "Vill du ta bort bilden?",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteStorageFile(imageUrl);
          await updateDoc(doc(db, "abandonedObjects", entryId), { imageUrl: "" });
          setEntries((prev) =>
            prev.map((e) => (e.id === entryId ? { ...e, imageUrl: "" } : e))
          );
          setPhotoPreview(null);
          setRemovedExistingImage(true);
          setSuccessMsg("Bilden har tagits bort.");
          setTimeout(() => setSuccessMsg(""), 3000);
        } catch (err) {
          console.error("Error removing abandoned object image:", err);
        }
      },
    });
  }

  function formatDate(ts: Timestamp | undefined): string {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleDateString("sv-SE");
  }

  const objectTypeLabel = (t: string) => ABANDONED_OBJECT_TYPES.find((o) => o.value === t)?.label || t;

  return (
    <Box>
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Lägg till
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Typ</TableCell>
                <TableCell>Foto</TableCell>
                <TableCell>Ägare</TableCell>
                <TableCell>Köpes</TableCell>
                <TableCell>Position</TableCell>
                <TableCell>Övergiven sedan</TableCell>
                <TableCell>Kommentar</TableCell>
                <TableCell align="right">Åtgärder</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>☠️ {entry.abandonedId}</TableCell>
                  <TableCell>{objectTypeLabel(entry.objectType)}</TableCell>
                  <TableCell>
                    {entry.imageUrl ? (
                      <InsertPhotoIcon
                        sx={{ color: "#4FC3F7", cursor: "pointer", fontSize: 28 }}
                        titleAccess="Visa bild"
                        onClick={() => setLightboxUrl(entry.imageUrl)}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {entry.claimedByName ? (
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "#66BB6A" }}>{entry.claimedByName}</Typography>
                        {entry.claimedByPhone && <Typography variant="caption" color="text.secondary">{entry.claimedByPhone}</Typography>}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {entry.purchaseListingId ? (
                      <Chip label="Köpes" size="small" sx={{ bgcolor: "rgba(79,195,247,0.2)", color: "#4FC3F7", fontWeight: 600 }} />
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.8rem" }}>
                    {entry.lat?.toFixed(5)}, {entry.lng?.toFixed(5)}
                  </TableCell>
                  <TableCell>{formatDate(entry.abandonedSince)}</TableCell>
                  <TableCell sx={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.comment || "—"}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(entry)} sx={{ mr: 0.5 }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(entry.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    Inga övergivna objekt registrerade.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editEntry ? `Redigera ☠️ #${editEntry.abandonedId}` : "Lägg till övergivet objekt"}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel>Typ</InputLabel>
            <Select
              value={form.objectType}
              label="Typ"
              onChange={(e: SelectChangeEvent) => setForm({ ...form, objectType: e.target.value as AbandonedObjectType })}
            >
              {ABANDONED_OBJECT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5, fontWeight: 700 }}>
            Position — klicka på kartan för att placera
          </Typography>
          <Box sx={{ height: 300, border: '1px solid rgba(79,195,247,0.15)', borderRadius: 1, overflow: 'hidden', mb: 1 }}>
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}>
              <GMap
                key={form.lat && form.lng ? "has-coords" : "no-coords"}
                defaultCenter={form.lat && form.lng && !isNaN(parseFloat(form.lat)) && !isNaN(parseFloat(form.lng)) ? { lat: parseFloat(form.lat), lng: parseFloat(form.lng) } : HARBOR_CENTER}
                defaultZoom={18}
                mapId="edit-abandoned-map"
                mapTypeId="satellite"
                style={{ width: '100%', height: '100%' }}
                gestureHandling="greedy"
                disableDefaultUI
                zoomControl
                onClick={(e) => {
                  const ll = e.detail?.latLng;
                  if (ll) setForm({ ...form, lat: String(ll.lat), lng: String(ll.lng) });
                }}
              >
                {/* Show all other abandoned objects as context markers */}
                {entries
                  .filter((e) => e.id !== editEntry?.id && e.lat && e.lng)
                  .map((e) => (
                    <AdvancedMarker key={e.id} position={{ lat: e.lat, lng: e.lng }}>
                      <Box sx={{ display: "flex", alignItems: "center", opacity: 0.5 }}>
                        <DangerousIcon sx={{ fontSize: 20, color: '#999' }} />
                        <Typography sx={{ fontSize: 8, fontWeight: 800, color: '#999', ml: '1px' }}>{e.abandonedId}</Typography>
                      </Box>
                    </AdvancedMarker>
                  ))
                }
                {/* Current position marker (bright red) */}
                {form.lat && form.lng && !isNaN(parseFloat(form.lat)) && !isNaN(parseFloat(form.lng)) && (
                  <AdvancedMarker position={{ lat: parseFloat(form.lat), lng: parseFloat(form.lng) }}>
                    <DangerousIcon sx={{ fontSize: 32, color: '#f44336', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }} />
                  </AdvancedMarker>
                )}
              </GMap>
            </APIProvider>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-end' }}>
            <TextField
              label="Latitud" type="number" size="small"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
              inputProps={{ step: "0.000001" }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Longitud" type="number" size="small"
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
              inputProps={{ step: "0.000001" }}
              sx={{ flex: 1 }}
            />
            {(form.lat || form.lng) && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={() => setForm({ ...form, lat: "", lng: "" })}
                sx={{ whiteSpace: "nowrap", minWidth: "auto" }}
              >
                Rensa GPS
              </Button>
            )}
          </Box>
          <TextField
            fullWidth
            label="Övergiven sedan"
            type="date"
            value={form.abandonedSince}
            onChange={(e) => setForm({ ...form, abandonedSince: e.target.value })}
            sx={{ mb: 2 }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            fullWidth
            label="Kommentar"
            multiline
            rows={2}
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            sx={{ mb: 2 }}
          />

          {/* Photo upload */}
          <Box sx={{ mb: 1, display: "flex", gap: 1, alignItems: "center" }}>
            <Button variant="outlined" size="small" onClick={() => setAbandonedPickerOpen(true)}>
              {photoPreview ? "Byt foto" : "Välj foto"}
            </Button>
            {photoPreview && editEntry?.imageUrl && !photoFile && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => handleRemoveImage(editEntry.id, editEntry.imageUrl!)}
              >
                Ta bort bild
              </Button>
            )}
            <ImagePickerDialog open={abandonedPickerOpen} onClose={() => setAbandonedPickerOpen(false)} onChange={handlePhotoChange} />
          </Box>
          {photoPreview && (
            <Box
              component="img"
              src={photoPreview}
              alt="Preview"
              sx={{ width: "100%", maxHeight: 300, objectFit: "contain", borderRadius: 1, border: "1px solid rgba(79,195,247,0.15)", mt: 1, cursor: "pointer" }}
              onClick={() => setLightboxUrl(photoPreview)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
          >
            {saving ? "Sparar..." : "Spara"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog
        open={!!lightboxUrl}
        onClose={() => setLightboxUrl(null)}
        maxWidth={false}
        PaperProps={{
          sx: {
            bgcolor: "rgba(0,0,0,0.95)",
            maxWidth: "95vw",
            maxHeight: "95vh",
            overflow: "auto",
            p: 1,
          },
        }}
      >
        <IconButton
          onClick={() => setLightboxUrl(null)}
          sx={{ position: "sticky", top: 0, float: "right", color: "#fff", zIndex: 1 }}
        >
          <CloseIcon />
        </IconButton>
        {lightboxUrl && (
          <Box
            component="img"
            src={lightboxUrl}
            alt="Full size"
            sx={{ display: "block" }}
          />
        )}
      </Dialog>

      {/* Reusable confirmation dialog */}
      <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)}>
        <DialogTitle>{confirmDialog?.title}</DialogTitle>
        <DialogContent><Typography>{confirmDialog?.message}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>Avbryt</Button>
          <Button variant="contained" color="error" onClick={() => confirmDialog?.onConfirm()}>Ja, fortsätt</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


// ─── POI Tab ──────────────────────────────────────────────
function POITab({ initialEditId }: { initialEditId?: string }) {
  const [entries, setEntries] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<POI | null>(null);
  const [saving, setSaving] = useState(false);
  const [poiPickerOpen, setPoiPickerOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Generic confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const [form, setForm] = useState({
    name: "",
    lat: "",
    lng: "",
    comment: "",
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  async function fetchEntries() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "pois"));
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as POI)
        .sort((a, b) => a.id.localeCompare(b.id));
      setEntries(data);
    } catch (err) {
      console.error("Error fetching POIs:", err);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditEntry(null);
    setForm({ name: "", lat: "", lng: "", comment: "" });
    setPhotoFile(null);
    setPhotoPreview(null);
    setDialogOpen(true);
  }

  function openEdit(entry: POI) {
    setEditEntry(entry);
    setForm({
      name: entry.id,
      lat: String(entry.lat),
      lng: String(entry.lng),
      comment: entry.comment || "",
    });
    setPhotoFile(null);
    setPhotoPreview(entry.imageUrl || null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const lat = parseFloat(form.lat);
      const lng = parseFloat(form.lng);
      if (isNaN(lat) || isNaN(lng)) {
        alert("Latitude and longitude must be valid numbers.");
        setSaving(false);
        return;
      }
      if (!form.name.trim()) {
        alert("Name is required.");
        setSaving(false);
        return;
      }

      const docId = form.name.trim();
      let imageUrl = editEntry?.imageUrl || "";

      if (photoFile) {
        imageUrl = await uploadPOIImage(photoFile, docId);
      }

      const data: Record<string, unknown> = {
        lat,
        lng,
        comment: form.comment.trim(),
        ...(imageUrl ? { imageUrl } : {}),
      };

      // If renaming (name changed), delete old doc
      if (editEntry && editEntry.id !== docId) {
        await deleteDoc(doc(db, "pois", editEntry.id));
      }

      await setDoc(doc(db, "pois", docId), data, { merge: true });

      setDialogOpen(false);
      setSuccessMsg(editEntry ? "POI uppdaterad!" : "POI skapad!");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchEntries();
    } catch (err) {
      console.error("Error saving POI:", err);
      alert("Failed to save. See console.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setConfirmDialog({
      title: "Ta bort POI",
      message: "Är du säker på att du vill ta bort denna POI?",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const entry = entries.find((e) => e.id === id);
          if (entry?.imageUrl) await deleteStorageFile(entry.imageUrl);
          await deleteDoc(doc(db, "pois", id));
          setSuccessMsg("POI borttagen!");
          setTimeout(() => setSuccessMsg(""), 3000);
          fetchEntries();
        } catch (err) {
          console.error("Error deleting POI:", err);
        }
      },
    });
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));

    // Extract EXIF GPS if lat/lng form fields are empty
    if (!form.lat.trim() && !form.lng.trim()) {
      const gps = await extractExifGps(f);
      if (gps) {
        setForm((prev) => ({ ...prev, lat: String(gps.lat), lng: String(gps.lng) }));
        setSuccessMsg("GPS-position har hämtats från bilden. Kontrollera och justera positionen vid behov.");
        setTimeout(() => setSuccessMsg(""), 6000);
      }
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
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Lägg till POI
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Namn</TableCell>
                <TableCell>Foto</TableCell>
                <TableCell>Position</TableCell>
                <TableCell>Kommentar</TableCell>
                <TableCell align="right">Åtgärder</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{entry.id}</TableCell>
                  <TableCell>
                    {entry.imageUrl ? (
                      <InsertPhotoIcon
                        sx={{ color: "#4FC3F7", cursor: "pointer", fontSize: 28 }}
                        titleAccess="Visa bild"
                        onClick={() => setLightboxUrl(entry.imageUrl!)}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.8rem" }}>
                    {entry.lat?.toFixed(5)}, {entry.lng?.toFixed(5)}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.comment || "—"}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(entry)} sx={{ mr: 0.5 }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(entry.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editEntry ? `Redigera ${editEntry.id}` : "Ny POI"}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Namn (blir ID)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={!!editEntry}
            sx={{ mt: 1, mb: 2 }}
            helperText={editEntry ? "Namn kan inte ändras" : "T.ex. \"Toalett Brygga A\""}
          />

          <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5, fontWeight: 700 }}>
            Position — klicka på kartan för att placera
          </Typography>
          <Box sx={{ height: 300, border: '1px solid rgba(79,195,247,0.15)', borderRadius: 1, overflow: 'hidden', mb: 1 }}>
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}>
              <GMap
                defaultCenter={form.lat && form.lng ? { lat: parseFloat(form.lat), lng: parseFloat(form.lng) } : HARBOR_CENTER}
                defaultZoom={18}
                mapId="edit-poi-map"
                mapTypeId="satellite"
                style={{ width: '100%', height: '100%' }}
                gestureHandling="greedy"
                disableDefaultUI
                zoomControl
                onClick={(e) => {
                  const ll = e.detail?.latLng;
                  if (ll) setForm({ ...form, lat: String(ll.lat), lng: String(ll.lng) });
                }}
              >
                {/* Show all other POIs as context markers */}
                {entries
                  .filter((e) => e.id !== editEntry?.id && e.lat && e.lng)
                  .map((e) => (
                    <AdvancedMarker key={e.id} position={{ lat: e.lat, lng: e.lng }}>
                      <Box sx={{ display: "flex", alignItems: "center", opacity: 0.5 }}>
                        <PlaceIcon sx={{ fontSize: 20, color: '#999' }} />
                        <Typography sx={{ fontSize: 8, fontWeight: 800, color: '#999', ml: '1px' }}>{e.id}</Typography>
                      </Box>
                    </AdvancedMarker>
                  ))
                }
                {/* Current position marker */}
                {form.lat && form.lng && !isNaN(parseFloat(form.lat)) && !isNaN(parseFloat(form.lng)) && (
                  <AdvancedMarker position={{ lat: parseFloat(form.lat), lng: parseFloat(form.lng) }}>
                    <PlaceIcon sx={{ fontSize: 32, color: '#7C4DFF', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }} />
                  </AdvancedMarker>
                )}
              </GMap>
            </APIProvider>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Latitud" type="number" size="small"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
              inputProps={{ step: "0.000001" }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Longitud" type="number" size="small"
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
              inputProps={{ step: "0.000001" }}
              sx={{ flex: 1 }}
            />
          </Box>
          <TextField
            fullWidth
            label="Kommentar"
            multiline
            rows={2}
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            sx={{ mb: 2 }}
          />

          {/* Photo upload */}
          <Box sx={{ mb: 1 }}>
            <Button variant="outlined" size="small" onClick={() => setPoiPickerOpen(true)}>
              {photoPreview ? "Byt foto" : "Välj foto"}
            </Button>
            <ImagePickerDialog open={poiPickerOpen} onClose={() => setPoiPickerOpen(false)} onChange={handlePhotoChange} />
          </Box>
          {photoPreview && (
            <Box
              component="img"
              src={photoPreview}
              alt="Preview"
              sx={{ width: "100%", maxHeight: 300, objectFit: "contain", borderRadius: 1, border: "1px solid rgba(79,195,247,0.15)", mt: 1, cursor: "pointer" }}
              onClick={() => setLightboxUrl(photoPreview)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.lat || !form.lng || !form.name.trim()}
            startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
          >
            {saving ? "Sparar..." : "Spara"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog
        open={!!lightboxUrl}
        onClose={() => setLightboxUrl(null)}
        maxWidth={false}
        PaperProps={{
          sx: {
            bgcolor: "rgba(0,0,0,0.95)",
            maxWidth: "95vw",
            maxHeight: "95vh",
            overflow: "auto",
            p: 1,
          },
        }}
      >
        <IconButton
          onClick={() => setLightboxUrl(null)}
          sx={{ position: "sticky", top: 0, float: "right", color: "#fff", zIndex: 1 }}
        >
          <CloseIcon />
        </IconButton>
        {lightboxUrl && (
          <Box
            component="img"
            src={lightboxUrl}
            alt="Full size"
            sx={{ display: "block" }}
          />
        )}
      </Dialog>

      {/* Reusable confirmation dialog */}
      <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)}>
        <DialogTitle>{confirmDialog?.title}</DialogTitle>
        <DialogContent><Typography>{confirmDialog?.message}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>Avbryt</Button>
          <Button variant="contained" color="error" onClick={() => confirmDialog?.onConfirm()}>Ja, fortsätt</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
