"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { Dock, Resource, User, Berth, BerthTenant } from "@/lib/types";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import SmsBatchDialog, { SmsBatchRecipient } from "@/components/SmsBatchDialog";
import PriceBatchDialog from "@/components/PriceBatchDialog";
import BerthEditDialog from "@/components/BerthEditDialog";

// MUI
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import Autocomplete from "@mui/material/Autocomplete";
import Tooltip from "@mui/material/Tooltip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import InputAdornment from "@mui/material/InputAdornment";
import Avatar from "@mui/material/Avatar";
import Skeleton from "@mui/material/Skeleton";

import AnchorIcon from "@mui/icons-material/Anchor";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SmsIcon from "@mui/icons-material/Sms";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import SearchIcon from "@mui/icons-material/Search";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PaymentIcon from "@mui/icons-material/Payment";
import PeopleIcon from "@mui/icons-material/People";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";

// ─── Types ──────────────────────────────────────────────────

type ViewMode = "overview" | "payment" | "assignment";

const currentYear = new Date().getFullYear().toString();

// ─── Helpers ────────────────────────────────────────────────

/** Resolve the invoice responsible name + phone for a berth */
function resolveRecipient(
  r: Resource,
  occupants: Record<string, User>
): { name: string; phone: string } {
  const b = r as Berth;

  // 1) invoiceResponsibleId → tenants[]
  if (b.invoiceResponsibleId && b.tenants?.length) {
    const t = b.tenants.find(
      (t: BerthTenant) => t.uid === b.invoiceResponsibleId
    );
    if (t) return { name: t.name, phone: t.phone };
  }

  // 2) First tenant
  if (b.tenants?.length) {
    return { name: b.tenants[0].name, phone: b.tenants[0].phone };
  }

  // 3) occupantIds → users lookup
  if (r.occupantIds?.length) {
    const u = occupants[r.occupantIds[0]];
    if (u) return { name: u.name, phone: u.phone };
  }

  // 4) Legacy occupant fields
  const legacyName = [b.occupantFirstName, b.occupantLastName]
    .filter(Boolean)
    .join(" ");
  if (legacyName) return { name: legacyName, phone: b.occupantPhone || "" };

  return { name: "", phone: "" };
}

function getBerthPrice(r: Resource): number | undefined {
  const b = r as Berth;
  if (b.prices && b.prices[currentYear] != null) return b.prices[currentYear];
  return undefined;
}

// ─── Main Component ─────────────────────────────────────────

export default function BerthManagement() {
  const { firebaseUser, profile, isSuperadmin, isDockManager } = useAuth();
  const isManager = isSuperadmin || isDockManager;

  // Data state
  const [docks, setDocks] = useState<Dock[]>([]);
  const [selectedDockId, setSelectedDockId] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [occupants, setOccupants] = useState<Record<string, User>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [loadingDocks, setLoadingDocks] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [search, setSearch] = useState("");

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("overview");

  // Privacy: does the current user have any resources?
  const [userHasResources, setUserHasResources] = useState(false);

  // Batch selection (payment view)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);

  // Detail panel state (handled by BerthEditDialog)
  const [detailBerth, setDetailBerth] = useState<Berth | null>(null);

  // ─── Data Fetching ───────────────────────────────────────

  // Fetch docks (filtered by manager role)
  useEffect(() => {
    if (!firebaseUser) return;
    async function fetchDocks() {
      try {
        let items: Dock[];
        if (isSuperadmin) {
          const snap = await getDocs(collection(db, "docks"));
          items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock);
        } else if (isDockManager) {
          const q = query(
            collection(db, "docks"),
            where("managerIds", "array-contains", firebaseUser!.uid)
          );
          const snap = await getDocs(q);
          items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock);
        } else {
          // Regular user — fetch all docks
          const snap = await getDocs(collection(db, "docks"));
          items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock);
        }
        const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
        setDocks(sorted);
        if (sorted.length > 0) setSelectedDockId(sorted[0].id);
      } catch (err) {
        console.error("Error fetching docks:", err);
      } finally {
        setLoadingDocks(false);
      }
    }
    fetchDocks();
  }, [firebaseUser, isSuperadmin, isDockManager]);

  // Fetch users (for tenant assignment autocomplete)
  useEffect(() => {
    if (!isManager) return;
    async function fetchUsers() {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as User));
    }
    fetchUsers();
  }, [isManager]);

  // Check if current user has any resources (for privacy)
  useEffect(() => {
    if (!firebaseUser || isManager) return;
    async function checkUserResources() {
      try {
        const q = query(
          collection(db, "resources"),
          where("occupantIds", "array-contains", firebaseUser!.uid)
        );
        const snap = await getDocs(q);
        if (snap.size > 0) {
          setUserHasResources(true);
          return;
        }
        const lsQ = query(
          collection(db, "landStorage"),
          where("occupantId", "==", firebaseUser!.uid)
        );
        const lsSnap = await getDocs(lsQ);
        if (lsSnap.size > 0) setUserHasResources(true);
      } catch {
        // Silently fail — default to no resources (most restrictive)
      }
    }
    checkUserResources();
  }, [firebaseUser, isManager]);

  // Fetch resources for selected dock
  useEffect(() => {
    if (!selectedDockId) return;
    setSelectedIds(new Set());
    async function fetchResources() {
      setLoadingResources(true);
      try {
        const q = query(
          collection(db, "resources"),
          where("dockId", "==", selectedDockId)
        );
        const snap = await getDocs(q);
        const items = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Resource
        );
        setResources(items);

        // Fetch occupant info
        const uniqueIds = [
          ...new Set(items.flatMap((r) => r.occupantIds || [])),
        ];
        const oMap: Record<string, User> = {};
        for (const uid of uniqueIds) {
          const userSnap = await getDoc(doc(db, "users", uid));
          if (userSnap.exists()) {
            oMap[uid] = { id: userSnap.id, ...userSnap.data() } as User;
          }
        }
        setOccupants(oMap);
      } catch (err) {
        console.error("Error fetching resources:", err);
      } finally {
        setLoadingResources(false);
      }
    }
    fetchResources();
  }, [selectedDockId]);

  // ─── Privacy Helpers ─────────────────────────────────────

  const canSeeNames = (berth: Berth): boolean => {
    if (isSuperadmin) return true;
    if (berth.secret) return false;
    if (isDockManager) return true;
    if (userHasResources) return true;
    return false;
  };

  const canSeeContact = (berth: Berth): boolean => {
    if (isSuperadmin) return true;
    if (berth.secret) return false;
    if (isDockManager) return true;
    return false;
  };

  // ─── Sorted & Filtered Resources ────────────────────────

  const sortedResources = useMemo(() => {
    let items = [...resources].sort((a, b) =>
      a.markingCode.localeCompare(b.markingCode, "sv-SE", { numeric: true })
    );
    if (search.trim()) {
      const term = search.toLowerCase();
      items = items.filter((r) => {
        const b = r as Berth;
        const name = [b.occupantFirstName, b.occupantLastName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          r.markingCode.toLowerCase().includes(term) ||
          name.includes(term)
        );
      });
    }
    return items;
  }, [resources, search]);

  // ─── Stats ───────────────────────────────────────────────

  const totalCount = resources.length;
  const occupiedCount = resources.filter(
    (r) => r.status === "Occupied"
  ).length;
  const availableCount = resources.filter(
    (r) => r.status === "Available"
  ).length;
  const unpaidCount = resources.filter(
    (r) => r.paymentStatus === "Unpaid"
  ).length;

  // ─── Payment View Handlers ──────────────────────────────

  const setPaymentStatus = async (resourceId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "resources", resourceId), {
        paymentStatus: newStatus,
      });
      setResources((prev) =>
        prev.map((r) =>
          r.id === resourceId
            ? {
                ...r,
                paymentStatus:
                  newStatus as Resource["paymentStatus"],
              }
            : r
        )
      );
    } catch (err) {
      console.error("Error updating payment:", err);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedResources.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedResources.map((r) => r.id)));
    }
  };

  const smsRecipients: SmsBatchRecipient[] = useMemo(() => {
    return resources
      .filter((r) => selectedIds.has(r.id))
      .map((r) => {
        const { name, phone } = resolveRecipient(r, occupants);
        return {
          markingCode: r.markingCode,
          name,
          phone,
          price: getBerthPrice(r),
        };
      });
  }, [resources, selectedIds, occupants]);

  // ─── Assignment View Handlers ───────────────────────────

  const handleTenantChange = async (
    resourceId: string,
    userIds: string[]
  ) => {
    try {
      // Ensure all user objects are loaded
      const updatedOccupants = { ...occupants };
      for (const uid of userIds) {
        if (!updatedOccupants[uid]) {
          const userSnap = await getDoc(doc(db, "users", uid));
          if (userSnap.exists()) {
            updatedOccupants[uid] = { id: userSnap.id, ...userSnap.data() } as User;
          }
        }
      }
      setOccupants(updatedOccupants);

      // Build denormalized tenants array
      const tenants: BerthTenant[] = userIds
        .map((uid) => {
          const u = updatedOccupants[uid];
          if (!u) return null;
          return { uid: u.id, name: u.name, phone: u.phone, email: u.email };
        })
        .filter(Boolean) as BerthTenant[];

      // Determine invoice responsible
      const currentResource = resources.find((r) => r.id === resourceId) as Berth | undefined;
      const currentInvoiceId = currentResource?.invoiceResponsibleId || "";
      let invoiceResponsibleId = "";

      if (tenants.length === 0) {
        // No tenants → no invoice responsible
        invoiceResponsibleId = "";
      } else if (currentInvoiceId && tenants.some((t) => t.uid === currentInvoiceId)) {
        // Current invoice responsible is still among the tenants → keep them
        invoiceResponsibleId = currentInvoiceId;
      } else {
        // First person (or previous was removed) → promote first tenant
        invoiceResponsibleId = tenants[0].uid;
      }

      await updateDoc(doc(db, "resources", resourceId), {
        occupantIds: userIds,
        tenants,
        invoiceResponsibleId: invoiceResponsibleId || null,
        status: userIds.length > 0 ? "Occupied" : "Available",
      });
      setResources((prev) =>
        prev.map((r) =>
          r.id === resourceId
            ? {
                ...r,
                occupantIds: userIds,
                tenants,
                invoiceResponsibleId,
                status: (userIds.length > 0
                  ? "Occupied"
                  : "Available") as Resource["status"],
              } as Resource
            : r
        )
      );
    } catch (err) {
      console.error("Error assigning tenant:", err);
    }
  };

  const getTenants = (ids: string[] | undefined): User[] =>
    (ids || []).map((id) => occupants[id]).filter(Boolean) as User[];

  // ─── Detail Panel Handler ──────────────────────────────

  const handleBerthSaved = (updated: Berth, moved: Record<string, { lat: number; lng: number }>) => {
    setResources((prev) =>
      prev.map((r) => {
        if (r.id === updated.id) return updated;
        const movedPos = moved[r.id];
        if (movedPos) return { ...r, lat: movedPos.lat, lng: movedPos.lng };
        return r;
      })
    );
    setDetailBerth(null);
    const movedCount = Object.keys(moved).length;
    setSuccessMsg(`Plats uppdaterad!${movedCount > 0 ? ` ${movedCount} plats(er) omplacerade.` : ""}`);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  // ─── Render ──────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <AnchorIcon sx={{ color: "primary.main" }} />
          Bryggöversikt
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {isManager
            ? "Hantera platser, tilldelning och betalningar för dina bryggor."
            : "Se platser och status för bryggorna i hamnen."}
        </Typography>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      {/* Dock selector + View mode toggle */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 3,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <FormControl sx={{ minWidth: 240 }}>
          <InputLabel>Välj brygga</InputLabel>
          <Select
            value={selectedDockId}
            label="Välj brygga"
            onChange={(e: SelectChangeEvent) =>
              setSelectedDockId(e.target.value)
            }
            disabled={loadingDocks}
          >
            {docks.map((dock) => (
              <MenuItem key={dock.id} value={dock.id}>
                {dock.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <ToggleButtonGroup
          size="small"
          value={viewMode}
          exclusive
          onChange={(_, val) => val && setViewMode(val)}
          sx={{ flexShrink: 0 }}
        >
          <ToggleButton value="overview">
            <ListAltIcon sx={{ mr: 0.5, fontSize: 18 }} />
            Översikt
          </ToggleButton>
          {isManager && (
            <ToggleButton value="payment">
              <PaymentIcon sx={{ mr: 0.5, fontSize: 18 }} />
              Betalning
            </ToggleButton>
          )}
          {isManager && (
            <ToggleButton value="assignment">
              <PeopleIcon sx={{ mr: 0.5, fontSize: 18 }} />
              Tilldelning
            </ToggleButton>
          )}
        </ToggleButtonGroup>

        {/* Search (overview mode) */}
        {viewMode === "overview" && (
          <TextField
            size="small"
            placeholder="Sök platskod eller namn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 200 }}
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
        )}

        {/* Batch actions (payment mode) */}
        {viewMode === "payment" && isManager && (
          <>
            <Button
              variant="contained"
              startIcon={<SmsIcon />}
              onClick={() => setSmsDialogOpen(true)}
              disabled={selectedIds.size === 0}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              SMS / Swish
              {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
            <Button
              variant="outlined"
              startIcon={<AttachMoneyIcon />}
              onClick={() => setPriceDialogOpen(true)}
              disabled={selectedIds.size === 0}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Priser
              {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
          </>
        )}
      </Box>

      {/* Loading state */}
      {loadingDocks ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : docks.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography color="text.secondary">
              {isManager
                ? "Du är inte tilldelad som ansvarig för någon brygga."
                : "Inga bryggor finns registrerade."}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card>
                <CardContent sx={{ textAlign: "center", py: 2 }}>
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: 700, color: "primary.main" }}
                  >
                    {totalCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Totalt
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card>
                <CardContent sx={{ textAlign: "center", py: 2 }}>
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: 700, color: "success.main" }}
                  >
                    {availableCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Lediga
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card>
                <CardContent sx={{ textAlign: "center", py: 2 }}>
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: 700, color: "warning.main" }}
                  >
                    {occupiedCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Belagda
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card>
                <CardContent sx={{ textAlign: "center", py: 2 }}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      color:
                        viewMode === "payment"
                          ? "error.main"
                          : "text.secondary",
                    }}
                  >
                    {unpaidCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Obetalda
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Table */}
          {loadingResources ? (
            <Skeleton
              variant="rectangular"
              height={300}
              sx={{ borderRadius: 2 }}
            />
          ) : (
            <TableContainer
              component={Paper}
              sx={{ bgcolor: "background.paper", backgroundImage: "none" }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {/* Checkbox column (payment mode) */}
                    {viewMode === "payment" && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={
                            sortedResources.length > 0 &&
                            selectedIds.size === sortedResources.length
                          }
                          indeterminate={
                            selectedIds.size > 0 &&
                            selectedIds.size < sortedResources.length
                          }
                          onChange={toggleSelectAll}
                        />
                      </TableCell>
                    )}
                    <TableCell>Platskod</TableCell>
                    <TableCell>Status</TableCell>

                    {/* Overview-specific columns */}
                    {viewMode === "overview" && (
                      <>
                        <TableCell>Ansvarig</TableCell>
                        <TableCell>Telefon</TableCell>
                        <TableCell>Bild</TableCell>
                      </>
                    )}

                    {/* Payment-specific columns */}
                    {viewMode === "payment" && (
                      <>
                        <TableCell>Ansvarig</TableCell>
                        <TableCell>Telefon</TableCell>
                        <TableCell>Pris {currentYear}</TableCell>
                        <TableCell>Betalning</TableCell>
                      </>
                    )}

                    {/* Assignment-specific columns */}
                    {viewMode === "assignment" && (
                      <>
                        <TableCell>Legacy-namn</TableCell>
                        <TableCell>Kopplat konto</TableCell>
                        <TableCell sx={{ minWidth: 220 }}>
                          Tilldela
                          <Typography variant="caption" display="block" color="error.main" sx={{ fontWeight: 600, fontSize: 10 }}>
                            Röd = faktureringsansvarig
                          </Typography>
                        </TableCell>
                      </>
                    )}

                    {/* Edit button column (overview mode for managers) */}
                    {viewMode === "overview" && isManager && (
                      <TableCell align="right"></TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedResources.map((r) => {
                    const b = r as Berth;
                    const isAvailable = r.status === "Available";
                    const showNames = canSeeNames(b);
                    const showContact = canSeeContact(b);
                    const displayName =
                      b.occupantFirstName || b.occupantLastName
                        ? `${b.occupantFirstName || ""} ${b.occupantLastName || ""}`.trim()
                        : "";
                    const price = getBerthPrice(r);
                    const {
                      name: responsibleName,
                      phone: responsiblePhone,
                    } = resolveRecipient(r, occupants);
                    // Use tenant-resolved name if available, otherwise legacy
                    const nameToShow = responsibleName || displayName;

                    return (
                      <TableRow
                        key={r.id}
                        hover
                        selected={selectedIds.has(r.id)}
                        sx={{
                          cursor:
                            viewMode === "overview" ? "pointer" : undefined,
                          bgcolor: isAvailable
                            ? "rgba(102, 187, 106, 0.04)"
                            : "transparent",
                        }}
                        onClick={
                          viewMode === "overview"
                            ? () => setDetailBerth(b)
                            : undefined
                        }
                      >
                        {/* Checkbox (payment mode) */}
                        {viewMode === "payment" && (
                          <TableCell
                            padding="checkbox"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleSelect(r.id)}
                            />
                          </TableCell>
                        )}

                        {/* Marking code */}
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
                              <Tooltip title="Hemlig — bara synlig för Superadmin">
                                <LockIcon
                                  fontSize="small"
                                  sx={{ color: "warning.main", ml: 0.5 }}
                                />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Chip
                            label={isAvailable ? "Ledig" : "Belagd"}
                            size="small"
                            color={isAvailable ? "success" : "warning"}
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>

                        {/* ─── Overview columns ─── */}
                        {viewMode === "overview" && (
                          <>
                            <TableCell>
                              {isAvailable
                                ? "—"
                                : showNames
                                  ? nameToShow || "Belagd"
                                  : b.secret && !isSuperadmin
                                    ? "🔒 Dold"
                                    : "Belagd"}
                            </TableCell>
                            <TableCell sx={{ color: "text.secondary" }}>
                              {showContact
                                ? responsiblePhone ||
                                  b.occupantPhone ||
                                  "—"
                                : "—"}
                            </TableCell>
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                            >
                              {b.objectImageUrl ? (
                                <Avatar
                                  src={b.objectImageUrl}
                                  sx={{
                                    width: 36,
                                    height: 36,
                                  }}
                                />
                              ) : (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  —
                                </Typography>
                              )}
                            </TableCell>
                          </>
                        )}

                        {/* ─── Payment columns ─── */}
                        {viewMode === "payment" && (
                          <>
                            <TableCell>
                              {responsibleName ? (
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {responsibleName}
                                </Typography>
                              ) : (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  —
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {responsiblePhone ? (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {responsiblePhone}
                                </Typography>
                              ) : r.status === "Occupied" ? (
                                <Tooltip title="Telefonnummer saknas">
                                  <WarningAmberIcon
                                    sx={{
                                      color: "warning.main",
                                      fontSize: 16,
                                    }}
                                  />
                                </Tooltip>
                              ) : (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  —
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {price != null ? (
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {price.toLocaleString("sv-SE")} kr
                                </Typography>
                              ) : (
                                <Tooltip title="Årspris saknas">
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 0.5,
                                    }}
                                  >
                                    <WarningAmberIcon
                                      sx={{
                                        color: "warning.main",
                                        fontSize: 18,
                                      }}
                                    />
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Saknas
                                    </Typography>
                                  </Box>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Select
                                value={r.paymentStatus}
                                onChange={(e) =>
                                  setPaymentStatus(
                                    r.id,
                                    e.target.value as string
                                  )
                                }
                                size="small"
                                sx={{
                                  fontSize: "0.8rem",
                                  fontWeight: 600,
                                  minWidth: 100,
                                  color:
                                    r.paymentStatus === "Paid"
                                      ? "success.main"
                                      : "error.main",
                                  "& .MuiSelect-select": { py: 0.5 },
                                }}
                              >
                                <MenuItem value="Paid">✅ Betald</MenuItem>
                                <MenuItem value="Unpaid">
                                  ❌ Obetald
                                </MenuItem>
                              </Select>
                            </TableCell>
                          </>
                        )}

                        {/* ─── Assignment columns ─── */}
                        {viewMode === "assignment" && (
                          <>
                            <TableCell>
                              {displayName || (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  —
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                if (
                                  b.tenants &&
                                  b.tenants.length > 0
                                ) {
                                  return b.tenants.map(
                                    (t: BerthTenant) => (
                                      <Chip
                                        key={t.uid}
                                        label={t.name}
                                        size="small"
                                        color={
                                          t.uid === b.invoiceResponsibleId
                                            ? "error"
                                            : "default"
                                        }
                                        sx={{ mr: 0.5, mb: 0.5 }}
                                      />
                                    )
                                  );
                                }
                                const tenants = getTenants(
                                  r.occupantIds
                                );
                                if (tenants.length > 0) {
                                  return tenants.map((u, idx) => (
                                    <Chip
                                      key={u.id}
                                      label={u.name}
                                      size="small"
                                      color={
                                        (b.invoiceResponsibleId && u.id === b.invoiceResponsibleId) ||
                                        (!b.invoiceResponsibleId && idx === 0)
                                          ? "error"
                                          : "default"
                                      }
                                      sx={{ mr: 0.5, mb: 0.5 }}
                                    />
                                  ));
                                }
                                return (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    Ej kopplad
                                  </Typography>
                                );
                              })()}
                            </TableCell>
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Autocomplete
                                multiple
                                size="small"
                                options={users}
                                getOptionLabel={(u) =>
                                  `${u.name} (${u.email})`
                                }
                                value={getTenants(r.occupantIds)}
                                onChange={(_e, newVal) =>
                                  handleTenantChange(
                                    r.id,
                                    newVal.map((u) => u.id)
                                  )
                                }
                                isOptionEqualToValue={(opt, val) =>
                                  opt.id === val.id
                                }
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    placeholder="Tilldela..."
                                    variant="outlined"
                                    size="small"
                                  />
                                )}
                                sx={{ minWidth: 220 }}
                              />
                            </TableCell>
                          </>
                        )}

                        {/* Edit button (overview mode for managers) */}
                        {viewMode === "overview" && isManager && (
                          <TableCell
                            align="right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="small"
                              startIcon={<EditIcon />}
                              onClick={() => setDetailBerth(b)}
                            >
                              Redigera
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
        </>
      )}

      {/* ─── Berth Edit Dialog (shared component) ─────────── */}
      <BerthEditDialog
        berth={detailBerth}
        onClose={() => setDetailBerth(null)}
        onSaved={handleBerthSaved}
        docks={docks}
        users={users}
        allBerths={resources.filter((r) => (r as Berth).type === "Berth" || !(r as Berth).type) as Berth[]}
        readOnly={!isManager}
      />

      {/* SMS Batch Dialog */}
      <SmsBatchDialog
        open={smsDialogOpen}
        onClose={() => setSmsDialogOpen(false)}
        recipients={smsRecipients}
        defaultSwishPhone={profile?.phone || ""}
      />

      {/* Price Batch Dialog */}
      <PriceBatchDialog
        open={priceDialogOpen}
        onClose={() => setPriceDialogOpen(false)}
        resources={resources.filter((r) => selectedIds.has(r.id))}
        onUpdated={(updated) => {
          setResources((prev) =>
            prev.map((r) => {
              const u = updated.find((ur) => ur.id === r.id);
              return u || r;
            })
          );
          setSuccessMsg(
            `Priser uppdaterade för ${updated.length} plats(er)`
          );
          setTimeout(() => setSuccessMsg(""), 3000);
        }}
      />
    </Box>
  );
}
