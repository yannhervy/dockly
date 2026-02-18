"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { uploadBoatImage, uploadProfileImage } from "@/lib/storage";
import { Resource, Berth, LandStorageEntry, UserMessage } from "@/lib/types";
import { normalizePhone } from "@/lib/phoneUtils";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import ProtectedRoute from "@/components/ProtectedRoute";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonIcon from "@mui/icons-material/Person";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import ConstructionIcon from "@mui/icons-material/Construction";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import SmsIcon from "@mui/icons-material/Sms";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { profile, firebaseUser, refreshProfile } = useAuth();
  const [isPublic, setIsPublic] = useState(profile?.isPublic ?? false);
  const [allowMapSms, setAllowMapSms] = useState(profile?.allowMapSms ?? true);
  const [resources, setResources] = useState<Resource[]>([]);
  const [landEntries, setLandEntries] = useState<LandStorageEntry[]>([]);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Profile editing state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(profile?.name || "");
  const [editPhone, setEditPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);

  // Profile picture upload
  const profileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (profile) {
      setIsPublic(profile.isPublic);
      setAllowMapSms(profile.allowMapSms ?? true);
      setEditName(profile.name);
      setEditPhone(profile.phone);
    }
  }, [profile]);

  // Auto-match and fetch all the user's resources + land storage
  const fetchAndMatch = useCallback(async () => {
    if (!firebaseUser || !profile) return;
    setLoading(true);

    const uid = firebaseUser.uid;
    const userPhone = normalizePhone(profile.phone || "");
    const userEmail = (profile.email || "").trim().toLowerCase();

    try {
      // ── 1. Match & fetch Resources (Berths etc.) ──
      const allResSnap = await getDocs(collection(db, "resources"));
      const allResources = allResSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Resource
      );

      // Find resources that match by phone or email but don't have UID yet
      for (const r of allResources) {
        const ids = r.occupantIds || [];
        if (ids.includes(uid)) continue; // already linked

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
          // Link the user's UID to this resource
          await updateDoc(doc(db, "resources", r.id), {
            occupantIds: arrayUnion(uid),
          });
        }
      }

      // Now fetch the user's resources (including newly matched)
      const myResSnap = await getDocs(
        query(
          collection(db, "resources"),
          where("occupantIds", "array-contains", uid)
        )
      );
      setResources(
        myResSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Resource)
      );

      // ── 2. Match & fetch Land Storage entries ──
      const allLandSnap = await getDocs(collection(db, "landStorage"));
      const allLand = allLandSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as LandStorageEntry
      );

      for (const entry of allLand) {
        if (entry.occupantId === uid) continue; // already linked

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
        }
      }

      // Now fetch the user's land storage entries
      const myLandSnap = await getDocs(
        query(
          collection(db, "landStorage"),
          where("occupantId", "==", uid)
        )
      );
      setLandEntries(
        myLandSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as LandStorageEntry
        )
      );

      // ── 3. Fetch unread messages ──
      const msgSnap = await getDocs(
        query(
          collection(db, "users", uid, "messages"),
          where("read", "==", false),
          orderBy("createdAt", "desc")
        )
      );
      setMessages(
        msgSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as UserMessage
        )
      );
    } catch (err) {
      console.error("Error in auto-match:", err);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, profile]);

  useEffect(() => {
    fetchAndMatch();
  }, [fetchAndMatch]);

  // Mark all messages as read
  const handleClearMessages = async () => {
    if (!firebaseUser || messages.length === 0) return;
    try {
      const batch = writeBatch(db);
      for (const msg of messages) {
        batch.update(doc(db, "users", firebaseUser.uid, "messages", msg.id), {
          read: true,
        });
      }
      await batch.commit();
      setMessages([]);
    } catch (err) {
      console.error("Error clearing messages:", err);
    }
  };

  // Toggle privacy
  const handlePrivacyToggle = async () => {
    if (!firebaseUser) return;
    const newVal = !isPublic;
    setIsPublic(newVal);
    try {
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        isPublic: newVal,
      });
      setSuccessMsg(
        newVal
          ? "Your profile is now visible in the harbor directory."
          : "Your profile is now hidden from the harbor directory."
      );
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error updating privacy:", err);
      setIsPublic(!newVal); // Revert on error
    }
  };

  // Toggle SMS from map
  const handleSmsToggle = async () => {
    if (!firebaseUser) return;
    const newVal = !allowMapSms;
    setAllowMapSms(newVal);
    try {
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        allowMapSms: newVal,
      });
      setSuccessMsg(
        newVal
          ? "Bryggförvaltare kan nu kontakta dig via SMS från kartan."
          : "SMS-kontakt från kartan är nu avstängd."
      );
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error updating SMS preference:", err);
      setAllowMapSms(!newVal);
    }
  };

  // Save profile edits (name + phone)
  const handleSaveProfile = async () => {
    if (!firebaseUser || !editName.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        name: editName.trim(),
        phone: editPhone.trim(),
      });
      setEditing(false);
      setSuccessMsg("Profile updated!");
      setTimeout(() => setSuccessMsg(""), 4000);
      refreshProfile?.();
    } catch (err) {
      console.error("Error saving profile:", err);
    } finally {
      setSaving(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditName(profile?.name || "");
    setEditPhone(profile?.phone || "");
    setEditing(false);
  };

  // Profile picture upload
  const handleProfilePictureChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadProfileImage(file, firebaseUser.uid);
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        photoURL: url,
      });
      setSuccessMsg("Profile picture updated!");
      setTimeout(() => setSuccessMsg(""), 4000);
      refreshProfile?.();
    } catch (err) {
      console.error("Error uploading profile picture:", err);
    } finally {
      setUploadingPhoto(false);
      if (profileInputRef.current) profileInputRef.current.value = "";
    }
  };

  // Handle boat image upload
  const handleUploadClick = (resourceId: string) => {
    setUploadTargetId(resourceId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;

    setUploading(uploadTargetId);
    try {
      const url = await uploadBoatImage(file, uploadTargetId);
      await updateDoc(doc(db, "resources", uploadTargetId), {
        objectImageUrl: url,
      });
      // Update local state
      setResources((prev) =>
        prev.map((r) =>
          r.id === uploadTargetId ? { ...r, objectImageUrl: url } : r
        )
      );
      setSuccessMsg("Boat image updated successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error uploading image:", err);
    } finally {
      setUploading(null);
      setUploadTargetId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const paymentColor = (status: string) =>
    status === "Paid" ? "success" : "error";

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <DashboardIcon sx={{ color: "primary.main" }} />
          My Pages
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your profile, boat images, and view your leases.
        </Typography>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMsg}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Profile card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  mb: 3,
                }}
              >
                {/* Clickable avatar with camera overlay */}
                <Box
                  sx={{ position: "relative", cursor: "pointer", mb: 2 }}
                  onClick={() => profileInputRef.current?.click()}
                >
                  <Avatar
                    src={profile?.photoURL}
                    sx={{
                      width: 88,
                      height: 88,
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      fontSize: 32,
                      fontWeight: 700,
                    }}
                  >
                    {profile?.name?.charAt(0)?.toUpperCase() || "U"}
                  </Avatar>
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 30,
                      height: 30,
                      bgcolor: "primary.main",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid",
                      borderColor: "background.paper",
                    }}
                  >
                    {uploadingPhoto ? (
                      <CircularProgress size={14} sx={{ color: "white" }} />
                    ) : (
                      <PhotoCameraIcon sx={{ fontSize: 16, color: "white" }} />
                    )}
                  </Box>
                </Box>

                {/* Name & email — editable or read-only */}
                {editing ? (
                  <Box sx={{ width: "100%", mt: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Phone"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
                        onClick={handleSaveProfile}
                        disabled={saving || !editName.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CloseIcon />}
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {profile?.name || "User"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {profile?.email || firebaseUser?.email}
                    </Typography>
                    {profile?.role && (
                      <Chip
                        label={profile.role}
                        size="small"
                        sx={{
                          mt: 1,
                          bgcolor: "rgba(79, 195, 247, 0.15)",
                          color: "primary.light",
                        }}
                      />
                    )}
                  </>
                )}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Phone display (when not editing) */}
              {!editing && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Phone
                  </Typography>
                  <Typography variant="body2">
                    {profile?.phone || "—"}
                  </Typography>
                </Box>
              )}

              {/* Edit button */}
              {!editing && (
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => setEditing(true)}
                  sx={{ mb: 2, textTransform: "none" }}
                >
                  Edit Profile
                </Button>
              )}

              {/* Privacy toggle */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "rgba(79, 195, 247, 0.05)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {isPublic ? (
                    <VisibilityIcon fontSize="small" color="primary" />
                  ) : (
                    <VisibilityOffIcon fontSize="small" sx={{ opacity: 0.5 }} />
                  )}
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Profile Visibility
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {isPublic
                        ? "Visible in harbor directory"
                        : "Hidden from harbor directory"}
                    </Typography>
                  </Box>
                </Box>
                <Switch
                  checked={isPublic}
                  onChange={handlePrivacyToggle}
                  color="primary"
                />
              </Box>

              {/* SMS from map toggle */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "rgba(79, 195, 247, 0.05)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <SmsIcon fontSize="small" color={allowMapSms ? "primary" : "disabled"} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      SMS-kontakt från kartan
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {allowMapSms
                        ? "Bryggförvaltare kan kontakta dig via SMS vid oväntade händelser"
                        : "SMS-kontakt från kartan är avstängd"}
                    </Typography>
                  </Box>
                </Box>
                <Switch
                  checked={allowMapSms}
                  onChange={handleSmsToggle}
                  color="primary"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Leases table */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography
                variant="h6"
                sx={{
                  mb: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <DirectionsBoatIcon sx={{ color: "primary.main" }} />
                My Leases
              </Typography>

              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : resources.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
                  <PersonIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                  <Typography>No active leases found.</Typography>
                </Box>
              ) : (
                <TableContainer
                  component={Paper}
                  sx={{ bgcolor: "transparent", backgroundImage: "none" }}
                >
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>Marking Code</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Payment</TableCell>
                        <TableCell>Boat Image</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {resources.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Chip label={r.type} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {r.markingCode}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={r.status}
                              size="small"
                              color={
                                r.status === "Available" ? "success" : "warning"
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={r.paymentStatus}
                              size="small"
                              color={paymentColor(r.paymentStatus)}
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {r.objectImageUrl ? (
                              <Avatar
                                  src={r.objectImageUrl}
                                  variant="rounded"
                                  sx={{ width: 40, height: 40, cursor: "pointer" }}
                                  onClick={() => setPreviewImageUrl(r.objectImageUrl!)}
                                />
                              ) : null}
                              <Button
                                size="small"
                                startIcon={
                                  uploading === r.id ? (
                                    <CircularProgress size={14} />
                                  ) : (
                                    <PhotoCameraIcon />
                                  )
                                }
                                onClick={() => handleUploadClick(r.id)}
                                disabled={uploading === r.id}
                              >
                                {r.objectImageUrl ? "Change" : "Upload"}
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Land Storage entries */}
        {landEntries.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography
                  variant="h6"
                  sx={{
                    mb: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <ConstructionIcon sx={{ color: "primary.main" }} />
                  My Land Storage
                </Typography>

                <TableContainer
                  component={Paper}
                  sx={{ bgcolor: "transparent", backgroundImage: "none" }}
                >
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Code</TableCell>
                        <TableCell>Season</TableCell>
                        <TableCell>Payment</TableCell>
                        <TableCell>Comment</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {landEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell sx={{ fontWeight: 600, fontFamily: "monospace" }}>
                            {entry.code}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={entry.season || "—"}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={entry.paymentStatus}
                              size="small"
                              color={entry.paymentStatus === "Paid" ? "success" : "error"}
                            />
                          </TableCell>
                          <TableCell>
                            {entry.comment || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Messages from managers */}
        {messages.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card sx={{ border: "1px solid rgba(79, 195, 247, 0.2)" }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                  >
                    <SmsIcon sx={{ color: "primary.main" }} />
                    Messages ({messages.length})
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<MarkEmailReadIcon />}
                    onClick={handleClearMessages}
                  >
                    Clear All
                  </Button>
                </Box>
                {messages.map((msg) => (
                  <Box
                    key={msg.id}
                    sx={{
                      p: 2,
                      mb: 1,
                      borderRadius: 2,
                      bgcolor: "rgba(79, 195, 247, 0.06)",
                      border: "1px solid rgba(79, 195, 247, 0.1)",
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {msg.text}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      From {msg.authorName}
                      {msg.sentAsSms && " · Sent as SMS"}
                      {msg.createdAt && " · " + msg.createdAt.toDate().toLocaleDateString("sv-SE")}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

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

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <input
        ref={profileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleProfilePictureChange}
      />
    </Box>
  );
}

