"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, auth } from "@/lib/firebase";
import { deleteUser as firebaseDeleteUser, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from "firebase/auth";
import { uploadBoatImage, uploadProfileImage, uploadLandStorageImage, deleteStorageFile } from "@/lib/storage";
import { Resource, Berth, Dock, LandStorageEntry, UserMessage, User, EngagementType, BerthInterest, InterestReply, OfferedBerth, MarketplaceListing, ListingCategory } from "@/lib/types";
import { normalizePhone } from "@/lib/phoneUtils";
import { sendSms } from "@/lib/sms";
import { APIProvider, Map as GMap, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { computeBoatHull, HARBOR_CENTER } from "@/lib/mapUtils";
import { extractExifGps } from "@/lib/exifGps";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  arrayUnion,
  orderBy,
  writeBatch,
  deleteField,
  onSnapshot,
  Timestamp,
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
import LockIcon from "@mui/icons-material/Lock";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PlaceIcon from "@mui/icons-material/Place";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import StorefrontIcon from "@mui/icons-material/Storefront";


const ENGAGEMENT_LABELS: Record<EngagementType, string> = {
  berth: "Båtplats",
  seahut: "Sjöbod",
  box: "Låda",
  landstorage: "Uppställning",
  interest: "Intresserad",
  other: "Övrigt",
};

const LISTING_CATEGORY_LABELS: Record<ListingCategory, string> = {
  Sale: "Till salu",
  WantedToBuy: "Köpes",
  Service: "Tjänst",
  SubletOffer: "2-hand erbjudes",
  SubletWanted: "2-hand önskas",
};

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
  const { profile, firebaseUser, refreshProfile, effectiveUid, isViewingAs } = useAuth();
  const [isPublic, setIsPublic] = useState(profile?.isPublic ?? false);
  const [allowMapSms, setAllowMapSms] = useState(profile?.allowMapSms ?? true);
  const [resources, setResources] = useState<Resource[]>([]);
  const [subletResourceIds, setSubletResourceIds] = useState<Set<string>>(new Set());
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

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

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

  // GPS editing state for land storage
  const [gpsEditLandEntry, setGpsEditLandEntry] = useState<LandStorageEntry | null>(null);
  const [gpsLandLat, setGpsLandLat] = useState<number | undefined>(undefined);
  const [gpsLandLng, setGpsLandLng] = useState<number | undefined>(undefined);
  const [gpsLandSaving, setGpsLandSaving] = useState(false);

  // Interest registrations
  const [myInterests, setMyInterests] = useState<BerthInterest[]>([]);

  // Marketplace listings
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);
  const [interestReplies, setInterestReplies] = useState<Record<string, InterestReply[]>>({});

  // Lookup maps for resolving dock/berth IDs to human-readable names
  const [interestDockNames, setInterestDockNames] = useState<Record<string, string>>({});
  const [interestBerthCodes, setInterestBerthCodes] = useState<Record<string, string>>({});

  // Accept offer dialog state
  const [pendingAcceptOffer, setPendingAcceptOffer] = useState<{ ob: OfferedBerth; reply: InterestReply; interest: BerthInterest } | null>(null);
  const [acceptingOffer, setAcceptingOffer] = useState(false);

  // Generic confirmation dialog state (replaces native confirm())
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    if (!effectiveUid) return;
    const q = query(
      collection(db, "interests"),
      where("userId", "==", effectiveUid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const interests = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BerthInterest);
      setMyInterests(interests);
      // Fetch replies for each interest
      const repliesMap: Record<string, InterestReply[]> = {};
      await Promise.all(
        interests.map(async (interest) => {
          const rSnap = await getDocs(
            query(collection(db, "interests", interest.id, "replies"), orderBy("createdAt", "asc"))
          );
          repliesMap[interest.id] = rSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as InterestReply);
        })
      );
      setInterestReplies(repliesMap);

      // Resolve dock names and berth marking codes
      const dockIds = [...new Set(interests.map((i) => i.preferredDockId).filter(Boolean))] as string[];
      const berthIds = [...new Set(interests.map((i) => i.preferredBerthId).filter(Boolean))] as string[];

      const dockMap: Record<string, string> = {};
      await Promise.all(
        dockIds.map(async (dockId) => {
          try {
            const dockSnap = await getDoc(doc(db, "docks", dockId));
            if (dockSnap.exists()) {
              dockMap[dockId] = dockSnap.data().name || dockId;
            }
          } catch { /* ignore */ }
        })
      );
      setInterestDockNames(dockMap);

      const berthMap: Record<string, string> = {};
      await Promise.all(
        berthIds.map(async (berthId) => {
          try {
            const berthSnap = await getDoc(doc(db, "resources", berthId));
            if (berthSnap.exists()) {
              berthMap[berthId] = berthSnap.data().markingCode || berthId;
            }
          } catch { /* ignore */ }
        })
      );
      setInterestBerthCodes(berthMap);
    });
    return () => unsub();
  }, [effectiveUid]);

  // Fetch user's marketplace listings
  useEffect(() => {
    if (!effectiveUid) return;
    const q = query(
      collection(db, "marketplace"),
      where("createdBy", "==", effectiveUid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMyListings(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MarketplaceListing)
      );
    });
    return () => unsub();
  }, [effectiveUid]);

  const handleDeleteListing = async (listingId: string) => {
    try {
      const listing = myListings.find((l) => l.id === listingId);
      if (listing?.imageUrl) await deleteStorageFile(listing.imageUrl);
      await deleteDoc(doc(db, "marketplace", listingId));
      setSuccessMsg("Annons borttagen!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error deleting listing:", err);
    }
    setDeletingListingId(null);
  };

  // Pending users (for managers/superadmins)
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const isManagerOrAdmin = profile?.role === "Superadmin" || profile?.role === "Dock Manager";
  const [pendingLinkedObjects, setPendingLinkedObjects] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!isManagerOrAdmin) return;
    const q = query(collection(db, "users"), where("approved", "==", false));
    const unsub = onSnapshot(q, async (snap) => {
      const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as User);
      setPendingUsers(users);

      // Fetch linked objects for each pending user
      if (users.length > 0) {
        const objMap: Record<string, string[]> = {};
        const [resSnap, landSnap] = await Promise.all([
          getDocs(collection(db, "resources")),
          getDocs(collection(db, "landStorage")),
        ]);
        for (const u of users) {
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
    });
    return () => unsub();
  }, [isManagerOrAdmin]);

  const handleApproveUser = async (userId: string) => {
    setApprovingId(userId);
    try {
      const token = await auth.currentUser?.getIdToken();
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
      if (!res.ok || !data.success) throw new Error(data.error || "Approve failed");
      setSuccessMsg("Användaren har godkänts och fått SMS.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error approving user:", err);
      alert(err instanceof Error ? err.message : "Failed to approve user");
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    setConfirmDialog({
      title: "Neka konto",
      message: "Neka och radera detta konto?",
      onConfirm: async () => {
        setConfirmDialog(null);
        handleRejectUserConfirmed(userId);
      },
    });
  };

  const handleRejectUserConfirmed = async (userId: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
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
      if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");
      setSuccessMsg("Kontot har nekats och raderats.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error rejecting user:", err);
      alert(err instanceof Error ? err.message : "Failed to reject user");
    }
  };

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
    if (!effectiveUid || !profile) return;
    setLoading(true);

    const uid = effectiveUid;
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
      const myResources = myResSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Resource
      );

      // Also fetch berths where the user is a second-hand tenant
      const subletSnap = await getDocs(
        query(
          collection(db, "resources"),
          where("secondHandTenantId", "==", uid)
        )
      );
      const subletIds = new Set<string>();
      for (const d of subletSnap.docs) {
        subletIds.add(d.id);
        // Add if not already in myResources (avoid duplicates)
        if (!myResources.some((r) => r.id === d.id)) {
          myResources.push({ id: d.id, ...d.data() } as Resource);
        }
      }
      setSubletResourceIds(subletIds);
      setResources(myResources);

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
  }, [effectiveUid, profile]);

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
      setSuccessMsg("Profil uppdaterad!");
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

  // Check if user has email/password provider
  const hasPasswordProvider = firebaseUser?.providerData.some(
    (p) => p.providerId === "password"
  ) ?? false;

  // Handle user password change
  const handleChangePassword = async () => {
    if (!firebaseUser || !firebaseUser.email) return;
    if (newPassword.length < 6) {
      setPasswordError("Lösenordet måste vara minst 6 tecken.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("Lösenorden matchar inte.");
      return;
    }
    setPasswordError("");
    setPasswordLoading(true);
    try {
      // Re-authenticate with current password
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      // Update the password
      await updatePassword(firebaseUser, newPassword);
      setPasswordSuccess("Lösenordet har ändrats!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowPasswordChange(false);
      setTimeout(() => setPasswordSuccess(""), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("auth/wrong-password") || msg.includes("auth/invalid-credential")) {
        setPasswordError("Fel nuvarande lösenord.");
      } else if (msg.includes("auth/too-many-requests")) {
        setPasswordError("För många försök. Vänta en stund.");
      } else {
        setPasswordError("Kunde inte ändra lösenordet. Försök igen.");
      }
    } finally {
      setPasswordLoading(false);
    }
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
      setSuccessMsg("Profilbild uppdaterad!");
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

      // Extract EXIF GPS if the resource has no position yet
      const resource = resources.find((r) => r.id === uploadTargetId);
      if (resource && !resource.lat && !resource.lng) {
        const gps = await extractExifGps(file);
        if (gps) {
          await updateDoc(doc(db, "resources", uploadTargetId), {
            lat: gps.lat,
            lng: gps.lng,
          });
          setResources((prev) =>
            prev.map((r) =>
              r.id === uploadTargetId
                ? { ...r, objectImageUrl: url, lat: gps.lat, lng: gps.lng }
                : r
            )
          );
          setSuccessMsg(
            "Båtbild uppdaterad! GPS-position har hämtats från bilden. Kontrollera och justera positionen vid behov."
          );
          setTimeout(() => setSuccessMsg(""), 6000);
          return;
        }
      }

      // Update local state (no GPS extracted)
      setResources((prev) =>
        prev.map((r) =>
          r.id === uploadTargetId ? { ...r, objectImageUrl: url } : r
        )
      );
      setSuccessMsg("Båtbild uppdaterad!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error uploading image:", err);
    } finally {
      setUploading(null);
      setUploadTargetId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle land storage image upload
  const landFileInputRef = useRef<HTMLInputElement>(null);
  const [landUploadTargetId, setLandUploadTargetId] = useState<string | null>(null);

  const handleLandUploadClick = (entryId: string) => {
    setLandUploadTargetId(entryId);
    landFileInputRef.current?.click();
  };

  const handleLandFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !landUploadTargetId) return;

    setUploading(landUploadTargetId);
    try {
      const url = await uploadLandStorageImage(file, landUploadTargetId);
      await updateDoc(doc(db, "landStorage", landUploadTargetId), {
        imageUrl: url,
      });

      // Extract EXIF GPS if the entry has no position yet
      const entry = landEntries.find((x) => x.id === landUploadTargetId);
      if (entry && !entry.lat && !entry.lng) {
        const gps = await extractExifGps(file);
        if (gps) {
          await updateDoc(doc(db, "landStorage", landUploadTargetId), {
            lat: gps.lat,
            lng: gps.lng,
          });
          setLandEntries((prev) =>
            prev.map((x) =>
              x.id === landUploadTargetId
                ? { ...x, imageUrl: url, lat: gps.lat, lng: gps.lng }
                : x
            )
          );
          setSuccessMsg(
            "Bild för markförvaring uppdaterad! GPS-position har hämtats från bilden. Kontrollera och justera positionen vid behov."
          );
          setTimeout(() => setSuccessMsg(""), 6000);
          return;
        }
      }

      setLandEntries((prev) =>
        prev.map((x) =>
          x.id === landUploadTargetId ? { ...x, imageUrl: url } : x
        )
      );
      setSuccessMsg("Bild för markförvaring uppdaterad!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error uploading land storage image:", err);
    } finally {
      setUploading(null);
      setLandUploadTargetId(null);
      if (landFileInputRef.current) landFileInputRef.current.value = "";
    }
  };

  // Delete land storage image
  const handleDeleteLandImage = async (entryId: string) => {
    setConfirmDialog({
      title: "Ta bort bild",
      message: "Vill du ta bort bilden?",
      onConfirm: () => { setConfirmDialog(null); handleDeleteLandImageConfirmed(entryId); },
    });
  };

  const handleDeleteLandImageConfirmed = async (entryId: string) => {
    setUploading(entryId);
    try {
      await updateDoc(doc(db, "landStorage", entryId), {
        imageUrl: deleteField(),
      });
      setLandEntries((prev) =>
        prev.map((x) =>
          x.id === entryId ? { ...x, imageUrl: undefined } : x
        )
      );
      setSuccessMsg("Bilden har tagits bort.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error deleting land storage image:", err);
    } finally {
      setUploading(null);
    }
  };

  // Allocate a land storage code to the current user
  const [allocating, setAllocating] = useState(false);
  const handleAllocateLandCode = async () => {
    if (!firebaseUser) return;
    setAllocating(true);
    try {
      // Find the first available land storage entry
      const availSnap = await getDocs(
        query(
          collection(db, "landStorage"),
          where("status", "==", "Available")
        )
      );
      const available = availSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as LandStorageEntry)
        .filter((e) => !e.occupantId)
        .sort((a, b) => a.code.localeCompare(b.code));

      if (available.length === 0) {
        alert("Det finns inga lediga uppställningskoder just nu.");
        return;
      }

      const entry = available[0];
      await updateDoc(doc(db, "landStorage", entry.id), {
        occupantId: firebaseUser.uid,
        firstName: profile?.name?.split(" ")[0] || "",
        lastName: profile?.name?.split(" ").slice(1).join(" ") || "",
        phone: profile?.phone || "",
        email: firebaseUser.email || "",
        status: "Occupied",
      });

      setLandEntries((prev) => [
        ...prev,
        {
          ...entry,
          occupantId: firebaseUser.uid,
          firstName: profile?.name?.split(" ")[0] || "",
          lastName: profile?.name?.split(" ").slice(1).join(" ") || "",
          phone: profile?.phone || "",
          email: firebaseUser.email || "",
          status: "Occupied",
        },
      ]);
      setSuccessMsg(`Uppställningskod ${entry.code} har tilldelats dig!`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error allocating land storage code:", err);
      alert("Något gick fel. Försök igen.");
    } finally {
      setAllocating(false);
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
          Mina grejer
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Hantera din profil, båtbilder och se dina hyresavtal.
        </Typography>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMsg}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Pending users approval (managers/superadmins only) */}
        {isManagerOrAdmin && pendingUsers.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card sx={{ border: "1px solid rgba(255,183,77,0.3)", bgcolor: "rgba(255,183,77,0.04)" }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                  ⏳ Konton som väntar på godkännande ({pendingUsers.length})
                </Typography>
                {pendingUsers.map((u) => (
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
                      onClick={() => handleRejectUser(u.id)}
                    >
                      Neka
                    </Button>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}
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
                      label="Namn"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Telefon"
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
                        Spara
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CloseIcon />}
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        Avbryt
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {profile?.name || "Användare"}
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
                    Telefon
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
                  Redigera profil
                </Button>
              )}

              {/* Password change section */}
              {passwordSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>{passwordSuccess}</Alert>
              )}
              {hasPasswordProvider ? (
                <>
                  {!showPasswordChange ? (
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      startIcon={<LockIcon />}
                      onClick={() => setShowPasswordChange(true)}
                      sx={{ mb: 2, textTransform: "none" }}
                    >
                      Ändra lösenord
                    </Button>
                  ) : (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                        <LockIcon fontSize="small" color="primary" />
                        Ändra lösenord
                      </Typography>
                      {passwordError && (
                        <Alert severity="error" sx={{ mb: 1 }}>{passwordError}</Alert>
                      )}
                      <TextField
                        fullWidth
                        size="small"
                        type="password"
                        label="Nuvarande lösenord"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        sx={{ mb: 1.5 }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        type="password"
                        label="Nytt lösenord"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        sx={{ mb: 1.5 }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        type="password"
                        label="Bekräfta nytt lösenord"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        sx={{ mb: 1.5 }}
                      />
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleChangePassword}
                          disabled={passwordLoading || !currentPassword || !newPassword}
                          startIcon={passwordLoading ? <CircularProgress size={14} /> : <SaveIcon />}
                        >
                          {passwordLoading ? "Sparar..." : "Spara"}
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            setShowPasswordChange(false);
                            setPasswordError("");
                            setCurrentPassword("");
                            setNewPassword("");
                            setConfirmNewPassword("");
                          }}
                        >
                          Avbryt
                        </Button>
                      </Box>
                    </Box>
                  )}
                </>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Du loggar in med Google — lösenordet hanteras av Google.
                </Alert>
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
                      Profilsynlighet
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {isPublic
                        ? "Synlig i hamnkatalogen"
                        : "Dold från hamnkatalogen"}
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

              {/* Delete own account */}
              <Button
                fullWidth
                variant="text"
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={async () => {
                  setConfirmDialog({
                    title: "Radera konto",
                    message: "Är du säker på att du vill radera ditt konto? Ditt konto och all data kommer att raderas permanent. Denna åtgärd kan inte ångras.",
                    onConfirm: async () => {
                      setConfirmDialog(null);
                      try {
                        const user = auth.currentUser;
                        if (!user) return;
                        await deleteDoc(doc(db, "users", user.uid));
                        await firebaseDeleteUser(user);
                      } catch (err: unknown) {
                        if (err instanceof Error && 'code' in err && (err as { code: string }).code === "auth/requires-recent-login") {
                          alert("Du behöver logga in igen innan du kan radera ditt konto. Logga ut och in igen och försök sedan.");
                        } else {
                          console.error("Error deleting account:", err);
                          alert("Kunde inte radera kontot. Försök igen.");
                        }
                      }
                    },
                  });
                }}
                sx={{ mt: 2, textTransform: "none", opacity: 0.6, "&:hover": { opacity: 1 } }}
              >
                Radera mitt konto
              </Button>
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
                    defaultTilt={45}
                    mapId="dashboard-my-objects"
                    mapTypeId="satellite"
                    style={{ width: "100%", height: "100%", minHeight: 350, borderRadius: 8 }}
                    gestureHandling="greedy"
                    disableDefaultUI
                    zoomControl
                    headingInteractionEnabled={true}
                    tiltInteractionEnabled={true}
                    rotateControl={true}
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
                Mina hyresavtal
              </Typography>

              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : resources.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
                  <PersonIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                  <Typography>Inga aktiva hyresavtal hittades.</Typography>
                </Box>
              ) : (
                <TableContainer
                  component={Paper}
                  sx={{ bgcolor: "transparent", backgroundImage: "none" }}
                >
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Typ</TableCell>
                        <TableCell>Märkningskod</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Betalning</TableCell>
                        <TableCell>GPS</TableCell>
                        <TableCell>2:a-hand</TableCell>
                        <TableCell>Båtbild</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {resources.map((r) => {
                        const isSublet = subletResourceIds.has(r.id);
                        return (
                        <TableRow key={r.id} sx={isSublet ? { bgcolor: "rgba(33, 150, 243, 0.06)" } : undefined}>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <Chip label={r.type === "SeaHut" ? "Sjöbod" : r.type === "Berth" ? "Båtplats" : r.type === "Box" ? "Låda" : r.type} size="small" variant="outlined" />
                              {isSublet && (
                                <Chip label="Andrahand" size="small" color="info" sx={{ fontWeight: 600 }} />
                              )}
                            </Box>
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
                          {/* Subletting toggles — only for Berths owned by the user (not sublet) */}
                          <TableCell>
                            {isSublet ? (
                              <Typography variant="caption" color="info.main" sx={{ fontStyle: "italic" }}>
                                Du hyr i andrahand
                              </Typography>
                            ) : r.type === "Berth" ? (
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
                            {isSublet ? (
                              r.objectImageUrl ? (
                                <Avatar
                                  src={r.objectImageUrl}
                                  variant="rounded"
                                  sx={{ width: 40, height: 40, cursor: "pointer" }}
                                  onClick={() => setPreviewImageUrl(r.objectImageUrl!)}
                                />
                              ) : (
                                <Typography variant="caption" color="text.secondary">—</Typography>
                              )
                            ) : (
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
                                {r.objectImageUrl ? "Ändra" : "Ladda upp"}
                              </Button>
                            </Box>
                            )}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Land Storage entries */}
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
                  Min markförvaring
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  När du förvarar något på föreningens mark ska du markera detta med en GPS-position, bild och märka båten/kärran med uppläggningskod.
                  När du tar bort din båt eller trailer ska du ta bort din GPS-position.
                  Kom ihåg att det är upp till dig att löpande betala in uppställningsavgiften.
                  Kontroller sker löpande och efterdebitering sker.
                  Se <a href="/info/upplagning" style={{ color: "#4FC3F7" }}>/info/upplagning</a> för mer info.
                </Typography>

                {landEntries.length === 0 && (
                  <Button
                    variant="outlined"
                    startIcon={allocating ? <CircularProgress size={16} /> : <ConstructionIcon />}
                    onClick={handleAllocateLandCode}
                    disabled={allocating}
                    sx={{ mb: 2 }}
                  >
                    Jag behöver en uppställningskod
                  </Button>
                )}

                {landEntries.length > 0 && (
                <TableContainer
                  component={Paper}
                  sx={{ bgcolor: "transparent", backgroundImage: "none" }}
                >
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Kod</TableCell>
                        <TableCell>Säsong</TableCell>
                        <TableCell>Betalning</TableCell>
                        <TableCell>GPS</TableCell>
                        <TableCell>Bild</TableCell>
                        <TableCell>Kommentar</TableCell>
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
                            {entry.lat && entry.lng ? (
                              <Box sx={{ display: "flex", alignItems: "center" }}>
                                <Tooltip title="GPS-position angiven — klicka för att redigera">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setGpsEditLandEntry(entry);
                                      setGpsLandLat(entry.lat);
                                      setGpsLandLng(entry.lng);
                                    }}
                                    sx={{ color: "success.main" }}
                                  >
                                    <PlaceIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Ta bort GPS-position">
                                  <IconButton
                                    size="small"
                                    onClick={async () => {
                                      setConfirmDialog({
                                        title: "Ta bort GPS-position",
                                        message: "Genom att ta bort din GPS-position bekräftar du att du inte längre har något uppställt på hamnens mark.",
                                        onConfirm: async () => {
                                          setConfirmDialog(null);
                                          try {
                                        await updateDoc(doc(db, "landStorage", entry.id), {
                                          lat: deleteField(),
                                          lng: deleteField(),
                                        });
                                        setLandEntries((prev) =>
                                          prev.map((x) =>
                                            x.id === entry.id
                                              ? { ...x, lat: undefined, lng: undefined }
                                              : x
                                          )
                                        );
                                        setSuccessMsg("GPS-position borttagen!");
                                        setTimeout(() => setSuccessMsg(""), 3000);
                                          } catch (err) {
                                            console.error("Error deleting GPS:", err);
                                          }
                                        },
                                      });
                                    }}
                                    sx={{ color: "error.main", ml: -0.5 }}
                                  >
                                    <CloseIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            ) : (
                              <Tooltip title="GPS-position saknas — klicka för att ange">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setGpsEditLandEntry(entry);
                                    setGpsLandLat(entry.lat);
                                    setGpsLandLng(entry.lng);
                                  }}
                                  sx={{ color: "warning.main" }}
                                >
                                  <WarningAmberIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {entry.imageUrl ? (
                                <Avatar
                                  src={entry.imageUrl}
                                  variant="rounded"
                                  sx={{ width: 40, height: 40, cursor: "pointer" }}
                                  onClick={() => setPreviewImageUrl(entry.imageUrl!)}
                                />
                              ) : null}
                              <Button
                                size="small"
                                startIcon={
                                  uploading === entry.id ? (
                                    <CircularProgress size={14} />
                                  ) : (
                                    <PhotoCameraIcon />
                                  )
                                }
                                onClick={() => handleLandUploadClick(entry.id)}
                                disabled={uploading === entry.id}
                                color={entry.imageUrl ? "primary" : "warning"}
                              >
                                {entry.imageUrl ? "Ändra" : "Ladda upp bild"}
                              </Button>
                              {entry.imageUrl && (
                                <Tooltip title="Ta bort bild">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteLandImage(entry.id)}
                                    disabled={uploading === entry.id}
                                    sx={{ color: "error.main" }}
                                  >
                                    <CloseIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {entry.comment || "—"}
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

        {/* My Marketplace Listings */}
        {myListings.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography
                  variant="h6"
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
                >
                  <StorefrontIcon sx={{ color: "#FFB74D" }} />
                  Mina annonser ({myListings.length})
                </Typography>
                <TableContainer
                  component={Paper}
                  sx={{ bgcolor: "transparent", backgroundImage: "none" }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Titel</TableCell>
                        <TableCell>Kategori</TableCell>
                        <TableCell>Pris</TableCell>
                        <TableCell>Skapad</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Ta bort</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {myListings.map((listing) => (
                        <TableRow key={listing.id}>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {listing.title}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={LISTING_CATEGORY_LABELS[listing.category] || listing.category}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            {listing.price > 0
                              ? `${listing.price.toLocaleString("sv-SE")} kr`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {listing.createdAt?.toDate?.()?.toLocaleDateString("sv-SE") || "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={listing.status === "Active" ? "Aktiv" : listing.status === "Sold" ? "Såld" : "Stängd"}
                              size="small"
                              color={listing.status === "Active" ? "success" : "default"}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {deletingListingId === listing.id ? (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifyContent: "flex-end" }}>
                                <Typography variant="caption" color="error.main" sx={{ whiteSpace: "nowrap" }}>
                                  Är du säker?
                                </Typography>
                                <Button
                                  size="small"
                                  color="error"
                                  variant="contained"
                                  onClick={() => handleDeleteListing(listing.id)}
                                  sx={{ minWidth: 0, px: 1 }}
                                >
                                  Ja
                                </Button>
                                <Button
                                  size="small"
                                  onClick={() => setDeletingListingId(null)}
                                  sx={{ minWidth: 0, px: 1 }}
                                >
                                  Nej
                                </Button>
                              </Box>
                            ) : (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeletingListingId(listing.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
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

        {/* My Interest Registrations */}
        {myInterests.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card sx={{ border: "1px solid rgba(79, 195, 247, 0.2)" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography
                  variant="h6"
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
                >
                  ⚓ Mina intresseanmälningar ({myInterests.length})
                </Typography>
                {myInterests.map((interest) => {
                  const replies = interestReplies[interest.id] || [];
                  const hasUnseen = replies.some(
                    (r) => !interest.lastSeenRepliesAt || r.createdAt.toMillis() > interest.lastSeenRepliesAt.toMillis()
                  );
                  return (
                    <Box
                      key={interest.id}
                      sx={{
                        p: 2,
                        mb: 1.5,
                        borderRadius: 2,
                        bgcolor: "rgba(79, 195, 247, 0.04)",
                        border: hasUnseen
                          ? "1px solid rgba(255, 183, 77, 0.4)"
                          : "1px solid rgba(79, 195, 247, 0.1)",
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {interest.boatWidth}×{interest.boatLength}m
                            {interest.preferredDockId && ` · Brygga ${interestDockNames[interest.preferredDockId] || interest.preferredDockId}`}
                            {interest.preferredBerthId && ` plats ${interestBerthCodes[interest.preferredBerthId] || interest.preferredBerthId}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {interest.createdAt.toDate().toLocaleDateString("sv-SE")}
                            {interest.message && ` · "${interest.message}"`}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {hasUnseen && (
                            <Chip
                              label="Nytt svar!"
                              size="small"
                              color="warning"
                              sx={{ fontWeight: 700 }}
                            />
                          )}
                          <Chip
                            label={
                              interest.status === "Pending" ? "Väntar" :
                              interest.status === "Contacted" ? "Kontaktad" : "Löst"
                            }
                            size="small"
                            color={
                              interest.status === "Pending" ? "warning" :
                              interest.status === "Contacted" ? "info" : "success"
                            }
                            variant="outlined"
                          />
                        </Box>
                      </Box>

                      {/* Replies — always visible */}
                      {replies.length > 0 && (
                        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                          {replies.map((reply) => {
                            const isNew = !interest.lastSeenRepliesAt || reply.createdAt.toMillis() > interest.lastSeenRepliesAt.toMillis();
                            const offeredBerths = reply.offeredBerths
                              ?? (reply.offeredBerthId
                                ? [{ berthId: reply.offeredBerthId, berthCode: reply.offeredBerthCode || reply.offeredBerthId, dockName: reply.offeredDockName || "", price: reply.offeredPrice }]
                                : []);
                            const isOffer = offeredBerths.length > 0;
                            const isResolved = interest.status === "Resolved";
                            const isAccepted = reply.offerStatus === "accepted";
                            const isDeclined = reply.offerStatus === "declined";
                            return (
                              <Box
                                key={reply.id}
                                sx={{
                                  p: 1.5,
                                  mb: 1,
                                  borderRadius: 1.5,
                                  bgcolor: isOffer
                                    ? isAccepted
                                      ? "rgba(102, 187, 106, 0.12)"
                                      : isDeclined
                                      ? "rgba(255,255,255,0.03)"
                                      : "rgba(102, 187, 106, 0.06)"
                                    : isNew
                                    ? "rgba(255, 183, 77, 0.08)"
                                    : "rgba(79, 195, 247, 0.08)",
                                  borderLeft: isOffer
                                    ? isAccepted
                                      ? "3px solid #66BB6A"
                                      : isDeclined
                                      ? "3px solid #666"
                                      : "3px solid #66BB6A"
                                    : isNew
                                    ? "3px solid #FFB74D"
                                    : "3px solid #4FC3F7",
                                  opacity: isDeclined ? 0.5 : 1,
                                }}
                              >
                                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                  {reply.authorName}
                                  {isNew && !isOffer && " 🆕"}
                                </Typography>
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
                                          {isAccepted && interest.acceptedBerthId === ob.berthId && (
                                            <Chip label="Accepterat" size="small" color="success" />
                                          )}
                                        </Box>
                                        {/* Accept button per berth */}
                                        {reply.offerStatus === "pending" && !isResolved && (
                                          <Button
                                            variant="contained"
                                            size="small"
                                            color="success"
                                            onClick={() => setPendingAcceptOffer({ ob, reply, interest })}
                                          >
                                            ✅ Acceptera {ob.berthCode}
                                          </Button>
                                        )}
                                      </Box>
                                    ))}
                                    {isDeclined && (
                                      <Chip label="Avböjt" size="small" variant="outlined" sx={{ alignSelf: "flex-start" }} />
                                    )}
                                  </Box>
                                )}
                                <Typography variant="body2">{reply.message}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                                  {reply.createdAt.toDate().toLocaleString("sv-SE")}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      )}

                      {/* Mark as seen button if unseen */}
                      {hasUnseen && (
                        <Button
                          size="small"
                          variant="text"
                          sx={{ mt: 1, textTransform: "none" }}
                          onClick={async () => {
                            await updateDoc(doc(db, "interests", interest.id), {
                              lastSeenRepliesAt: Timestamp.now(),
                            });
                            setMyInterests((prev) =>
                              prev.map((i) =>
                                i.id === interest.id
                                  ? { ...i, lastSeenRepliesAt: Timestamp.now() }
                                  : i
                              )
                            );
                          }}
                        >
                          ✓ Markera som läst
                        </Button>
                      )}
                      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                        <Button
                          size="small"
                          variant="text"
                          color="error"
                          startIcon={<DeleteIcon />}
                          sx={{ textTransform: "none", opacity: 0.6, "&:hover": { opacity: 1 } }}
                          onClick={async () => {
                            setConfirmDialog({
                              title: "Ta bort intresseanmälan",
                              message: "Vill du ta bort denna intresseanmälan?",
                              onConfirm: async () => {
                                setConfirmDialog(null);
                                try {
                              await deleteDoc(doc(db, "interests", interest.id));
                              setMyInterests((prev) => prev.filter((i) => i.id !== interest.id));
                              setSuccessMsg("Intresseanmälan borttagen.");
                              setTimeout(() => setSuccessMsg(""), 3000);
                            } catch (err) {
                              console.error("Error deleting interest:", err);
                              alert("Kunde inte ta bort intresseanmälan.");
                                }
                              },
                            });
                          }}
                        >
                          Ta bort
                        </Button>
                      </Box>
                    </Box>
                  );
                })}
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
                    Meddelanden ({messages.length})
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<MarkEmailReadIcon />}
                    onClick={handleClearMessages}
                  >
                    Rensa alla
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
                      Från {msg.authorName}
                      {msg.sentAsSms && " · Skickat som SMS"}
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
      <input
        ref={landFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleLandFileChange}
      />
      {/* Second-hand tenant lookup dialog */}
      <Dialog
        open={!!lookupBerthId}
        onClose={() => setLookupBerthId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Hitta andrahandshyresgäst</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ange hyresgästens telefonnummer eller e-postadress för att söka.
          </Typography>
          <TextField
            fullWidth
            label="Telefon eller e-post"
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
          <Button onClick={() => setLookupBerthId(null)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleLookupTenant}
            disabled={lookupLoading || !lookupInput.trim()}
            startIcon={lookupLoading ? <CircularProgress size={16} /> : undefined}
          >
            Sök
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

      {/* GPS editing dialog for Land Storage */}
      <Dialog
        open={!!gpsEditLandEntry}
        onClose={() => setGpsEditLandEntry(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PlaceIcon color="primary" />
          Ange GPS-position
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Klicka p&aring; kartan f&ouml;r att placera din markering, eller anv&auml;nd din GPS-position.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              <PlaceIcon sx={{ fontSize: 18, verticalAlign: "text-bottom", mr: 0.5 }} />
              {gpsEditLandEntry?.code} &mdash; Markf&ouml;rvaring
            </Typography>
            {isTouchDevice && (
              <Button
                size="small"
                startIcon={<MyLocationIcon />}
                onClick={() => {
                  if (!navigator.geolocation) return;
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setGpsLandLat(pos.coords.latitude);
                      setGpsLandLng(pos.coords.longitude);
                    },
                    (err) => console.error("GPS error:", err),
                    { enableHighAccuracy: true }
                  );
                }}
              >
                Anv&auml;nd min GPS
              </Button>
            )}
          </Box>
          <Box sx={{ height: 300, border: '1px solid rgba(79,195,247,0.15)', borderRadius: 1, overflow: 'hidden', mb: 1 }}>
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}>
              <GMap
                defaultCenter={gpsLandLat && gpsLandLng ? { lat: gpsLandLat, lng: gpsLandLng } : HARBOR_CENTER}
                defaultZoom={18}
                mapId="edit-land-gps-map"
                mapTypeId="satellite"
                style={{ width: '100%', height: '100%' }}
                gestureHandling="greedy"
                disableDefaultUI
                zoomControl
                onClick={(e) => {
                  const ll = e.detail?.latLng;
                  if (ll) {
                    setGpsLandLat(ll.lat);
                    setGpsLandLng(ll.lng);
                  }
                }}
              >
                {gpsLandLat && gpsLandLng && (
                  <AdvancedMarker position={{ lat: gpsLandLat, lng: gpsLandLng }} />
                )}
              </GMap>
            </APIProvider>
          </Box>
          {gpsLandLat && gpsLandLng && (
            <Typography variant="caption" color="text.secondary">
              Lat: {gpsLandLat.toFixed(6)}, Lng: {gpsLandLng.toFixed(6)}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGpsEditLandEntry(null)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={gpsLandSaving || !gpsLandLat || !gpsLandLng}
            startIcon={gpsLandSaving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={async () => {
              if (!gpsEditLandEntry || !gpsLandLat || !gpsLandLng) return;
              setGpsLandSaving(true);
              try {
                await updateDoc(doc(db, "landStorage", gpsEditLandEntry.id), {
                  lat: gpsLandLat,
                  lng: gpsLandLng,
                });
                setLandEntries((prev) =>
                  prev.map((x) =>
                    x.id === gpsEditLandEntry.id
                      ? { ...x, lat: gpsLandLat, lng: gpsLandLng }
                      : x
                  )
                );
                setSuccessMsg("GPS-position sparad!");
                setTimeout(() => setSuccessMsg(""), 3000);
                setGpsEditLandEntry(null);
              } catch (err) {
                console.error("Error saving GPS:", err);
              } finally {
                setGpsLandSaving(false);
              }
            }}
          >
            {gpsLandSaving ? "Sparar..." : "Spara"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Accept offer confirmation dialog */}
      <Dialog open={!!pendingAcceptOffer} onClose={() => setPendingAcceptOffer(null)}>
        <DialogTitle>Acceptera plats?</DialogTitle>
        <DialogContent>
          <Typography>
            Vill du acceptera platsen <strong>{pendingAcceptOffer?.ob.berthCode}</strong>?
            Du kommer automatiskt s{"\u00e4"}ttas upp p{"\u00e5"} platsen.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingAcceptOffer(null)} disabled={acceptingOffer}>Avbryt</Button>
          <Button
            variant="contained"
            color="success"
            disabled={acceptingOffer}
            onClick={async () => {
              if (!pendingAcceptOffer) return;
              const { ob, reply, interest } = pendingAcceptOffer;
              setAcceptingOffer(true);
              try {
                // 1. Update berth: set occupied + add user + write tenant data
                const berthUpdate: Record<string, unknown> = {
                  status: "Occupied",
                  occupantIds: arrayUnion(effectiveUid),
                  tenants: arrayUnion({
                    uid: effectiveUid,
                    name: profile?.name || "",
                    phone: profile?.phone || "",
                    email: profile?.email || "",
                  }),
                  invoiceResponsibleId: effectiveUid,
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
                setMyInterests((prev) =>
                  prev.map((i) =>
                    i.id === interest.id
                      ? { ...i, status: "Resolved" as const, acceptedOfferId: reply.id, acceptedBerthId: ob.berthId, acceptedBerthCode: ob.berthCode }
                      : i
                  )
                );
                setSuccessMsg(`Du har accepterat plats ${ob.berthCode}!`);
                setTimeout(() => setSuccessMsg(""), 5000);
                setPendingAcceptOffer(null);
              } catch (err) {
                console.error("Error accepting offer:", err);
                alert("N\u00e5got gick fel vid acceptering. F\u00f6rs\u00f6k igen.");
              } finally {
                setAcceptingOffer(false);
              }
            }}
          >
            {acceptingOffer ? "Accepterar..." : "Ja, acceptera"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reusable confirmation dialog (replaces native confirm()) */}
      <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)}>
        <DialogTitle>{confirmDialog?.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog?.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>Avbryt</Button>
          <Button variant="contained" color="error" onClick={() => confirmDialog?.onConfirm()}>
            Ja, fortsätt
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

