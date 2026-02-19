"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { uploadBoatImage, uploadProfileImage } from "@/lib/storage";
import { Resource, Berth, Dock, LandStorageEntry, UserMessage } from "@/lib/types";
import { normalizePhone } from "@/lib/phoneUtils";
import { APIProvider, Map as GMap, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { computeBoatHull, HARBOR_CENTER } from "@/lib/mapUtils";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  arrayUnion,
  orderBy,
  writeBatch,
  deleteField,
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
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
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
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PlaceIcon from "@mui/icons-material/Place";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

// ─── Personal Map: renders only the user's objects ─────────
function MyObjectsMapContent({
  resources,
  landEntries,
  currentUid,
  onClickResource,
}: {
  resources: Resource[];
  landEntries: LandStorageEntry[];
  currentUid?: string;
  onClickResource: (r: Resource) => void;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const markerLib = useMapsLibrary("marker");

  useEffect(() => {
    if (!map || !coreLib || !markerLib) return;

    const cleanups: (() => void)[] = [];
    const bounds = new google.maps.LatLngBounds();
    let hasAny = false;

    // ─── Berths (boat hull polygons) ─────────────
    resources
      .filter((r): r is Berth => r.type === "Berth" && !!r.lat && !!r.lng)
      .forEach((berth) => {
        const w = berth.maxWidth || 3;
        const l = berth.maxLength || 10;
        const h = berth.heading || 0;
        const corners = computeBoatHull(berth.lat!, berth.lng!, w, l, h);

        const polygon = new google.maps.Polygon({
          paths: corners,
          strokeColor: "#00E5FF",
          strokeOpacity: 0.9,
          strokeWeight: 3,
          fillColor: "#00E5FF",
          fillOpacity: 0.5,
          map,
          zIndex: 2,
        });

        polygon.addListener("mouseover", () => polygon.setOptions({ fillOpacity: 0.7, strokeWeight: 4 }));
        polygon.addListener("mouseout", () => polygon.setOptions({ fillOpacity: 0.5, strokeWeight: 3 }));

        // Label
        const labelEl = document.createElement("div");
        labelEl.textContent = berth.markingCode;
        labelEl.style.cssText = `
          font-size: 10px; font-weight: 700; color: #fff;
          background: rgba(0,0,0,0.55); padding: 1px 3px;
          border-radius: 2px; white-space: nowrap;
          pointer-events: none; text-shadow: 0 1px 2px rgba(0,0,0,0.9);
        `;
        const labelMarker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: berth.lat!, lng: berth.lng! },
          map,
          content: labelEl,
          zIndex: 3,
        });

        bounds.extend({ lat: berth.lat!, lng: berth.lng! });
        hasAny = true;
        cleanups.push(() => { polygon.setMap(null); labelMarker.map = null; });
      });

    // ─── SeaHuts / Boxes (circle markers) ────────
    resources
      .filter((r) => r.type !== "Berth" && r.lat && r.lng)
      .forEach((res) => {
        const el = document.createElement("div");
        el.innerHTML = `<span>${res.markingCode}</span>`;
        el.style.cssText = `
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 50%;
          background: #00E5FF; border: 2px solid #00B8D4;
          color: #000; font-size: 10px; font-weight: 800;
          cursor: pointer; box-shadow: 0 0 10px 3px rgba(0,229,255,0.6);
          transition: transform 0.15s;
        `;
        el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.3)"; });
        el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
        el.addEventListener("click", () => onClickResource(res));

        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: res.lat!, lng: res.lng! },
          map,
          content: el,
          title: `${res.markingCode} (${res.type === "SeaHut" ? "Sjöbod" : "Låda"})`,
          zIndex: 5,
        });

        bounds.extend({ lat: res.lat!, lng: res.lng! });
        hasAny = true;
        cleanups.push(() => { marker.map = null; });
      });

    // ─── Land storage (orange circle markers) ────
    landEntries
      .filter((e) => e.lat && e.lng)
      .forEach((entry) => {
        const el = document.createElement("div");
        el.innerHTML = `<span>${entry.code}</span>`;
        el.style.cssText = `
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 50%;
          background: #F57C00; border: 2px solid #E65100;
          color: #fff; font-size: 10px; font-weight: 800;
          cursor: default; box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          text-shadow: 0 1px 2px rgba(0,0,0,0.6);
          transition: transform 0.15s;
        `;
        el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.3)"; });
        el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });

        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: entry.lat!, lng: entry.lng! },
          map,
          content: el,
          title: `${entry.code} — Markförvaring`,
          zIndex: 4,
        });

        bounds.extend({ lat: entry.lat!, lng: entry.lng! });
        hasAny = true;
        cleanups.push(() => { marker.map = null; });
      });

    // Auto-fit bounds to show all objects
    if (hasAny) {
      map.fitBounds(bounds, 60);
    }

    return () => { cleanups.forEach((fn) => fn()); };
  }, [map, coreLib, markerLib, resources, landEntries, currentUid, onClickResource]);

  return null;
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

  // Second-hand tenant lookup
  const [secondHandNames, setSecondHandNames] = useState<Record<string, string>>({});
  const [lookupBerthId, setLookupBerthId] = useState<string | null>(null);
  const [lookupInput, setLookupInput] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  // GPS editing state
  const isTouchDevice = useMediaQuery("(pointer: coarse)");
  const [gpsEditResource, setGpsEditResource] = useState<Resource | null>(null);
  const [gpsLat, setGpsLat] = useState<number | undefined>(undefined);
  const [gpsLng, setGpsLng] = useState<number | undefined>(undefined);
  const [gpsSaving, setGpsSaving] = useState(false);

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

      // Resolve second-hand tenant names
      const names: Record<string, string> = {};
      for (const d of myResSnap.docs) {
        const data = d.data() as Berth;
        if (data.secondHandTenantId) {
          const tenantDoc = await getDoc(doc(db, "users", data.secondHandTenantId));
          if (tenantDoc.exists()) {
            names[d.id] = tenantDoc.data().name || tenantDoc.data().email || "Unknown";
          }
        }
      }
      setSecondHandNames(names);

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

  // ── Second-hand tenant lookup ──
  const handleLookupTenant = async () => {
    if (!lookupBerthId || !lookupInput.trim()) return;
    setLookupLoading(true);
    setLookupError("");
    try {
      const input = lookupInput.trim();
      let foundUid = "";
      let foundName = "";

      // Try phone lookup first
      const normalized = normalizePhone(input);
      if (normalized) {
        const phoneSnap = await getDocs(
          query(collection(db, "users"), where("phone", "==", normalized))
        );
        if (!phoneSnap.empty) {
          const userData = phoneSnap.docs[0].data();
          foundUid = phoneSnap.docs[0].id;
          foundName = userData.name || userData.email || "Unknown";
        }
      }

      // Try email lookup if phone didn't match
      if (!foundUid && input.includes("@")) {
        const emailSnap = await getDocs(
          query(collection(db, "users"), where("email", "==", input.toLowerCase()))
        );
        if (!emailSnap.empty) {
          const userData = emailSnap.docs[0].data();
          foundUid = emailSnap.docs[0].id;
          foundName = userData.name || userData.email || "Unknown";
        }
      }

      if (!foundUid) {
        setLookupError(
          "No registered user found with that phone/email. Ask them to create an account first."
        );
        return;
      }

      // Save the tenant on the berth
      await updateDoc(doc(db, "resources", lookupBerthId), {
        secondHandTenantId: foundUid,
      });
      setResources((prev) =>
        prev.map((x) =>
          x.id === lookupBerthId
            ? { ...x, secondHandTenantId: foundUid } as Resource
            : x
        )
      );
      setSecondHandNames((prev) => ({ ...prev, [lookupBerthId]: foundName }));
      setLookupBerthId(null);
    } catch (err) {
      console.error("Tenant lookup error:", err);
      setLookupError("An error occurred. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const paymentColor = (status: string) =>
    status === "Paid" ? "success" : "error";

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 5 }}>
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

        {/* Personal map — my objects only */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: "100%", minHeight: 350 }}>
            <CardContent sx={{ p: 0, height: "100%", "&:last-child": { pb: 0 } }}>
              <Box sx={{ height: "100%", position: "relative" }}>
                <Box
                  sx={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    zIndex: 5,
                    bgcolor: "rgba(0,0,0,0.6)",
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                  }}
                >
                  <PlaceIcon sx={{ fontSize: 18, color: "primary.main" }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#fff" }}>
                    Mina objekt
                  </Typography>
                </Box>
                <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}>
                  <GMap
                    defaultCenter={HARBOR_CENTER}
                    defaultZoom={16}
                    mapId="dashboard-my-objects"
                    mapTypeId="satellite"
                    style={{ width: "100%", height: "100%", minHeight: 350, borderRadius: 8 }}
                    gestureHandling="greedy"
                    disableDefaultUI
                    zoomControl
                  >
                    <MyObjectsMapContent
                      resources={resources}
                      landEntries={landEntries}
                      currentUid={firebaseUser?.uid}
                      onClickResource={(r) => {
                        if (r.type !== "Berth" && (!r.lat || !r.lng)) {
                          setGpsEditResource(r);
                          setGpsLat(r.lat);
                          setGpsLng(r.lng);
                        }
                      }}
                    />
                  </GMap>
                </APIProvider>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Leases table */}
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
                        <TableCell>GPS</TableCell>
                        <TableCell>2:a-hand</TableCell>
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
                          {/* GPS position indicator */}
                          <TableCell>
                            {r.type !== "Berth" ? (
                              r.lat && r.lng ? (
                                <Tooltip title="GPS position set — click to edit">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setGpsEditResource(r);
                                      setGpsLat(r.lat);
                                      setGpsLng(r.lng);
                                    }}
                                    sx={{ color: "success.main" }}
                                  >
                                    <PlaceIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Tooltip title="GPS position missing — click to set">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setGpsEditResource(r);
                                      setGpsLat(r.lat);
                                      setGpsLng(r.lng);
                                    }}
                                    sx={{ color: "warning.main" }}
                                  >
                                    <WarningAmberIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )
                            ) : (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                          {/* Subletting toggles — only for Berths */}
                          <TableCell>
                            {r.type === "Berth" ? (
                              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.5 }}>
                                <Switch
                                  size="small"
                                  checked={(r as Berth).allowSecondHand ?? false}
                                  onChange={async (e) => {
                                    const val = e.target.checked;
                                    const updates: Record<string, unknown> = { allowSecondHand: val };
                                    if (!val) {
                                      updates.secondHandTenantId = deleteField();
                                      updates.invoiceSecondHandTenantDirectly = false;
                                    }
                                    await updateDoc(doc(db, "resources", r.id), updates);
                                    setResources((prev) =>
                                      prev.map((x) => x.id === r.id
                                        ? { ...x, allowSecondHand: val, ...(!val ? { secondHandTenantId: undefined, invoiceSecondHandTenantDirectly: false } : {}) } as Resource
                                        : x
                                      )
                                    );
                                  }}
                                />
                                {(r as Berth).allowSecondHand && (
                                  <>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 0.5 }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                                        Fakturera direkt
                                      </Typography>
                                      <Switch
                                        size="small"
                                        checked={(r as Berth).invoiceSecondHandTenantDirectly ?? false}
                                        onChange={async (e) => {
                                          const val = e.target.checked;
                                          await updateDoc(doc(db, "resources", r.id), { invoiceSecondHandTenantDirectly: val });
                                          setResources((prev) =>
                                            prev.map((x) => x.id === r.id ? { ...x, invoiceSecondHandTenantDirectly: val } as Resource : x)
                                          );
                                        }}
                                      />
                                    </Box>
                                    {/* Second-hand tenant display */}
                                    {(r as Berth).secondHandTenantId ? (
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 0.5 }}>
                                        <Chip
                                          label={secondHandNames[r.id] || "Loading..."}
                                          size="small"
                                          color="info"
                                          variant="outlined"
                                        />
                                        <IconButton
                                          size="small"
                                          color="error"
                                          onClick={async () => {
                                            await updateDoc(doc(db, "resources", r.id), { secondHandTenantId: deleteField() });
                                            setResources((prev) =>
                                              prev.map((x) => x.id === r.id ? { ...x, secondHandTenantId: undefined } as Resource : x)
                                            );
                                            setSecondHandNames((prev) => {
                                              const copy = { ...prev };
                                              delete copy[r.id];
                                              return copy;
                                            });
                                          }}
                                        >
                                          <PersonRemoveIcon fontSize="small" />
                                        </IconButton>
                                      </Box>
                                    ) : (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<PersonAddIcon />}
                                        onClick={() => {
                                          setLookupBerthId(r.id);
                                          setLookupInput("");
                                          setLookupError("");
                                        }}
                                        sx={{ ml: 0.5, textTransform: "none" }}
                                      >
                                        Add tenant
                                      </Button>
                                    )}
                                  </>
                                )}
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            )}
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
      {/* Second-hand tenant lookup dialog */}
      <Dialog
        open={!!lookupBerthId}
        onClose={() => setLookupBerthId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Find second-hand tenant</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the tenant&apos;s phone number or email address to look them up.
          </Typography>
          <TextField
            fullWidth
            label="Phone or email"
            value={lookupInput}
            onChange={(e) => { setLookupInput(e.target.value); setLookupError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleLookupTenant(); }}
            autoFocus
          />
          {lookupError && (
            <Alert severity="warning" sx={{ mt: 2 }}>{lookupError}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLookupBerthId(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleLookupTenant}
            disabled={lookupLoading || !lookupInput.trim()}
            startIcon={lookupLoading ? <CircularProgress size={16} /> : undefined}
          >
            Search
          </Button>
        </DialogActions>
      </Dialog>

      {/* GPS editing dialog */}
      <Dialog
        open={!!gpsEditResource}
        onClose={() => setGpsEditResource(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PlaceIcon color="primary" />
          Ange GPS-position
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Klicka på kartan för att placera din markering, eller använd din GPS-position.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              <PlaceIcon sx={{ fontSize: 18, verticalAlign: "text-bottom", mr: 0.5 }} />
              {gpsEditResource?.markingCode} — {gpsEditResource?.type}
            </Typography>
            {isTouchDevice && (
              <Button
                size="small"
                startIcon={<MyLocationIcon />}
                onClick={() => {
                  if (!navigator.geolocation) return;
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setGpsLat(pos.coords.latitude);
                      setGpsLng(pos.coords.longitude);
                    },
                    (err) => console.error("GPS error:", err),
                    { enableHighAccuracy: true }
                  );
                }}
              >
                Använd min GPS
              </Button>
            )}
          </Box>
          <Box sx={{ height: 300, border: '1px solid rgba(79,195,247,0.15)', borderRadius: 1, overflow: 'hidden', mb: 1 }}>
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}>
              <GMap
                defaultCenter={gpsLat && gpsLng ? { lat: gpsLat, lng: gpsLng } : HARBOR_CENTER}
                defaultZoom={18}
                mapId="edit-resource-gps-map"
                mapTypeId="satellite"
                style={{ width: '100%', height: '100%' }}
                gestureHandling="greedy"
                disableDefaultUI
                zoomControl
                onClick={(e) => {
                  const ll = e.detail?.latLng;
                  if (ll) {
                    setGpsLat(ll.lat);
                    setGpsLng(ll.lng);
                  }
                }}
              >
                {gpsLat && gpsLng && (
                  <AdvancedMarker position={{ lat: gpsLat, lng: gpsLng }} />
                )}
              </GMap>
            </APIProvider>
          </Box>
          {gpsLat && gpsLng && (
            <Typography variant="caption" color="text.secondary">
              Lat: {gpsLat.toFixed(6)}, Lng: {gpsLng.toFixed(6)}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGpsEditResource(null)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={gpsSaving || !gpsLat || !gpsLng}
            startIcon={gpsSaving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={async () => {
              if (!gpsEditResource || !gpsLat || !gpsLng) return;
              setGpsSaving(true);
              try {
                await updateDoc(doc(db, "resources", gpsEditResource.id), {
                  lat: gpsLat,
                  lng: gpsLng,
                });
                setResources((prev) =>
                  prev.map((x) =>
                    x.id === gpsEditResource.id
                      ? { ...x, lat: gpsLat, lng: gpsLng }
                      : x
                  ) as Resource[]
                );
                setSuccessMsg("GPS-position sparad!");
                setTimeout(() => setSuccessMsg(""), 3000);
                setGpsEditResource(null);
              } catch (err) {
                console.error("Error saving GPS:", err);
              } finally {
                setGpsSaving(false);
              }
            }}
          >
            {gpsSaving ? "Sparar..." : "Spara"}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

