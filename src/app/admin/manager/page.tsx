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
import ProtectedRoute from "@/components/ProtectedRoute";
import SmsBatchDialog, { SmsBatchRecipient } from "@/components/SmsBatchDialog";
import PriceBatchDialog from "@/components/PriceBatchDialog";

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
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";

import AnchorIcon from "@mui/icons-material/Anchor";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SmsIcon from "@mui/icons-material/Sms";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";

export default function ManagerPage() {
  return (
    <ProtectedRoute allowedRoles={["Superadmin", "Dock Manager"]}>
      <ManagerContent />
    </ProtectedRoute>
  );
}

// ─── Helpers ────────────────────────────────────────────
const currentYear = new Date().getFullYear().toString();

/** Resolve the invoice responsible name + phone for a berth */
function resolveRecipient(r: Resource, occupants: Record<string, User>): { name: string; phone: string } {
  const b = r as Berth;

  // 1) invoiceResponsibleId → tenants[]
  if (b.invoiceResponsibleId && b.tenants?.length) {
    const t = b.tenants.find((t: BerthTenant) => t.uid === b.invoiceResponsibleId);
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
  const legacyName = [b.occupantFirstName, b.occupantLastName].filter(Boolean).join(" ");
  if (legacyName) return { name: legacyName, phone: b.occupantPhone || "" };

  return { name: "", phone: "" };
}

function getBerthPrice(r: Resource): number | undefined {
  const b = r as Berth;
  if (b.prices && b.prices[currentYear] != null) return b.prices[currentYear];
  return undefined;
}

// ─── Main content ───────────────────────────────────────
function ManagerContent() {
  const { firebaseUser, profile, isSuperadmin } = useAuth();
  const [docks, setDocks] = useState<Dock[]>([]);
  const [selectedDockId, setSelectedDockId] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [occupants, setOccupants] = useState<Record<string, User>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [loadingDocks, setLoadingDocks] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // SMS dialog
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);

  // Fetch docks managed by this user (or all docks for Superadmin)
  useEffect(() => {
    if (!firebaseUser) return;
    async function fetchDocks() {
      try {
        let items: Dock[];
        if (isSuperadmin) {
          const snap = await getDocs(collection(db, "docks"));
          items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock);
        } else {
          const q = query(
            collection(db, "docks"),
            where("managerIds", "array-contains", firebaseUser!.uid)
          );
          const snap = await getDocs(q);
          items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dock);
        }
        setDocks(items.sort((a, b) => a.name.localeCompare(b.name)));
        if (items.length > 0) setSelectedDockId(items[0].id);
      } catch (err) {
        console.error("Error fetching docks:", err);
      } finally {
        setLoadingDocks(false);
      }
    }
    fetchDocks();
  }, [firebaseUser, isSuperadmin]);

  // Fetch all users (for tenant autocomplete)
  useEffect(() => {
    async function fetchUsers() {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as User));
    }
    fetchUsers();
  }, []);

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

  const handleDockChange = (event: SelectChangeEvent) => {
    setSelectedDockId(event.target.value);
  };

  // Set payment status directly
  const setPaymentStatus = async (resourceId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "resources", resourceId), {
        paymentStatus: newStatus,
      });
      setResources((prev) =>
        prev.map((r) =>
          r.id === resourceId ? { ...r, paymentStatus: newStatus as Resource["paymentStatus"] } : r
        )
      );
    } catch (err) {
      console.error("Error updating payment:", err);
    }
  };

  // Handle tenant assignment (reuses same logic as ResourcesTab)
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
      // Also update occupants map for any new users
      for (const uid of userIds) {
        if (!occupants[uid]) {
          const userSnap = await getDoc(doc(db, "users", uid));
          if (userSnap.exists()) {
            setOccupants((prev) => ({
              ...prev,
              [uid]: { id: userSnap.id, ...userSnap.data() } as User,
            }));
          }
        }
      }
    } catch (err) {
      console.error("Error assigning tenant:", err);
    }
  };

  // Tenant lookup helper for Autocomplete
  const getTenants = (ids: string[] | undefined): User[] =>
    (ids || []).map((id) => occupants[id]).filter(Boolean) as User[];

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === resources.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(resources.map((r) => r.id)));
    }
  };

  // Build SMS recipients from selected resources
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

  // Sort resources by markingCode naturally
  const sortedResources = useMemo(() => {
    return [...resources].sort((a, b) =>
      a.markingCode.localeCompare(b.markingCode, "sv-SE", { numeric: true })
    );
  }, [resources]);

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <AnchorIcon sx={{ color: "primary.main" }} />
          Bryggöversikt
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Hantera platser, tilldelning och betalningar för dina bryggor.
        </Typography>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMsg}
        </Alert>
      )}

      {/* Dock selector + SMS button */}
      <Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap", alignItems: "center" }}>
        <FormControl sx={{ minWidth: 280 }}>
          <InputLabel>Välj brygga</InputLabel>
          <Select
            value={selectedDockId}
            label="Välj brygga"
            onChange={handleDockChange}
            disabled={loadingDocks}
          >
            {docks.map((dock) => (
              <MenuItem key={dock.id} value={dock.id}>
                {dock.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          startIcon={<SmsIcon />}
          onClick={() => setSmsDialogOpen(true)}
          disabled={selectedIds.size === 0}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Skicka SMS / Betalning{selectedIds.size > 0 ? ` (${selectedIds.size} st)` : ""}
        </Button>
        <Button
          variant="outlined"
          startIcon={<AttachMoneyIcon />}
          onClick={() => setPriceDialogOpen(true)}
          disabled={selectedIds.size === 0}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Hantera priser{selectedIds.size > 0 ? ` (${selectedIds.size} st)` : ""}
        </Button>
      </Box>

      {loadingDocks ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : docks.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography color="text.secondary">
              Du är inte tilldelad som ansvarig för någon brygga.
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
                  <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.main" }}>
                    {resources.length}
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
                  <Typography variant="h4" sx={{ fontWeight: 700, color: "success.main" }}>
                    {resources.filter((r) => r.status === "Available").length}
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
                  <Typography variant="h4" sx={{ fontWeight: 700, color: "warning.main" }}>
                    {resources.filter((r) => r.status === "Occupied").length}
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
                  <Typography variant="h4" sx={{ fontWeight: 700, color: "error.main" }}>
                    {resources.filter((r) => r.paymentStatus === "Unpaid").length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Obetalda
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Resources table */}
          {loadingResources ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer
              component={Paper}
              sx={{ bgcolor: "background.paper", backgroundImage: "none" }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={resources.length > 0 && selectedIds.size === resources.length}
                        indeterminate={selectedIds.size > 0 && selectedIds.size < resources.length}
                        onChange={toggleSelectAll}
                      />
                    </TableCell>
                    <TableCell>Platskod</TableCell>
                    <TableCell>Typ</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Betalning</TableCell>
                    <TableCell>Årspris {currentYear}</TableCell>
                    <TableCell>Ansvarig</TableCell>
                    <TableCell sx={{ minWidth: 220 }}>Tilldelad</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedResources.map((r) => {
                    const price = getBerthPrice(r);
                    const { name: responsibleName, phone: responsiblePhone } = resolveRecipient(r, occupants);
                    const isOccupied = r.status === "Occupied";
                    const missingPhone = isOccupied && !responsiblePhone;
                    const missingPrice = isOccupied && price == null;

                    return (
                      <TableRow key={r.id} hover selected={selectedIds.has(r.id)}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleSelect(r.id)}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{r.markingCode}</TableCell>
                        <TableCell>
                          <Chip label={r.type} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={r.status === "Available" ? "Ledig" : "Belagd"}
                            size="small"
                            color={r.status === "Available" ? "success" : "warning"}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={r.paymentStatus}
                            onChange={(e) => setPaymentStatus(r.id, e.target.value as string)}
                            size="small"
                            sx={{
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              minWidth: 100,
                              color: r.paymentStatus === "Paid" ? "success.main" : "error.main",
                              "& .MuiSelect-select": { py: 0.5 },
                            }}
                          >
                            <MenuItem value="Paid">✅ Betald</MenuItem>
                            <MenuItem value="Unpaid">❌ Obetald</MenuItem>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {price != null ? (
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {price.toLocaleString("sv-SE")} kr
                            </Typography>
                          ) : (
                            <Tooltip title="Årspris saknas — ange i Resurser-admin">
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <WarningAmberIcon sx={{ color: "warning.main", fontSize: 18 }} />
                                <Typography variant="caption" color="text.secondary">Saknas</Typography>
                              </Box>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          {responsibleName ? (
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {responsibleName}
                              </Typography>
                              {responsiblePhone ? (
                                <Typography variant="caption" color="text.secondary">
                                  {responsiblePhone}
                                </Typography>
                              ) : missingPhone ? (
                                <Tooltip title="Telefonnummer saknas">
                                  <WarningAmberIcon sx={{ color: "warning.main", fontSize: 16 }} />
                                </Tooltip>
                              ) : null}
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Autocomplete
                            multiple
                            size="small"
                            options={users}
                            getOptionLabel={(u) => `${u.name} (${u.email})`}
                            value={getTenants(r.occupantIds)}
                            onChange={(_e, newVal) =>
                              handleTenantChange(r.id, newVal.map((u) => u.id))
                            }
                            isOptionEqualToValue={(opt, val) => opt.id === val.id}
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

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
          setSuccessMsg(`Priser uppdaterade för ${updated.length} plats(er)`);
          setTimeout(() => setSuccessMsg(""), 3000);
        }}
      />
    </Box>
  );
}
