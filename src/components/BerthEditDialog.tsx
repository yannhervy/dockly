"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Berth, BerthTenant, Dock, User, InternalComment } from "@/lib/types";
import { uploadBoatImage } from "@/lib/storage";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import InternalCommentsPanel from "@/components/InternalCommentsPanel";
import ImagePickerDialog from "@/components/ImagePickerDialog";
import { extractExifGps } from "@/lib/exifGps";
import { HARBOR_CENTER } from "@/lib/mapUtils";
import { APIProvider, Map as GMap } from "@vis.gl/react-google-maps";
import EditBerthPolygon from "@/components/EditBerthPolygon";

// MUI
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";

import AnchorIcon from "@mui/icons-material/Anchor";
import LockIcon from "@mui/icons-material/Lock";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import Alert from "@mui/material/Alert";
import DeleteIcon from "@mui/icons-material/Delete";

// ─── Props ──────────────────────────────────────────────────

interface BerthEditDialogProps {
  /** The berth to edit (null = closed) */
  berth: Berth | null;
  /** Called when the dialog closes */
  onClose: () => void;
  /** Called after a successful save with the updated berth data */
  onSaved: (updated: Berth) => void;
  /** Available docks (for dock reassignment) */
  docks: Dock[];
  /** All users (for user name resolution in internal comments) */
  users: User[];
  /** All berths on the same dock (for map context overlays) */
  allBerths: Berth[];
  /** Whether the current user is a read-only viewer */
  readOnly?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────

const currentYear = new Date().getFullYear().toString();
const prevYear = (parseInt(currentYear) - 1).toString();

// ─── Component ──────────────────────────────────────────────

export default function BerthEditDialog({
  berth,
  onClose,
  onSaved,
  docks,
  users,
  allBerths,
  readOnly = false,
}: BerthEditDialogProps) {
  // Local edit state — initialized from berth when opened
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // Image state
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // GPS feedback message
  const [gpsMsg, setGpsMsg] = useState("");

  // Track moved berths from dragging other berths on the map
  const [movedBerths, setMovedBerths] = useState<Record<string, { lat: number; lng: number }>>({});

  // Confirm dialog for tenant removal
  const [confirmRemoveTenant, setConfirmRemoveTenant] = useState<BerthTenant | null>(null);

  // Initialize form when berth changes
  useEffect(() => {
    if (!berth) return;

    // Merge legacy prices into prices map
    const pricesMap: Record<string, number> = { ...(berth.prices || {}) };
    if (berth.price2025 && !pricesMap["2025"]) pricesMap["2025"] = berth.price2025;
    if (berth.price2026 && !pricesMap["2026"]) pricesMap["2026"] = berth.price2026;

    setForm({
      // Identity
      markingCode: berth.markingCode || "",
      sortOrder: berth.sortOrder ?? "",
      direction: berth.direction || "",
      dockId: berth.dockId || "",
      // Occupant info
      occupantFirstName: berth.occupantFirstName || "",
      occupantLastName: berth.occupantLastName || "",
      occupantPhone: berth.occupantPhone || "",
      occupantEmail: berth.occupantEmail || "",
      occupantAddress: berth.occupantAddress || "",
      occupantPostalAddress: berth.occupantPostalAddress || "",
      comment: berth.comment || "",
      // Flags
      secret: berth.secret || false,
      allowSecondHand: berth.allowSecondHand || false,
      invoiceSecondHandTenantDirectly: berth.invoiceSecondHandTenantDirectly || false,
      // Dimensions
      maxWidth: berth.maxWidth ?? "",
      maxLength: berth.maxLength ?? "",
      heading: berth.heading ?? "",
      // GPS position
      lat: berth.lat != null ? String(berth.lat) : "",
      lng: berth.lng != null ? String(berth.lng) : "",
      // Pricing
      prices: pricesMap,
      // Tenants
      tenants: berth.tenants || [],
      invoiceResponsibleId: berth.invoiceResponsibleId || "",
      // Internal comments
      internalComments: berth.internalComments || [],
    });
    setImageFile(null);
    setImagePreview(berth.objectImageUrl || null);
    setRemoveImage(false);
    setMovedBerths({});
  }, [berth]);

  // User names map for InternalCommentsPanel
  const userNames = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.name])),
    [users]
  );

  // Prices helper
  const pricesMap = (form.prices || {}) as Record<string, number>;
  const priceYears = Object.keys(pricesMap).sort();
  const hasCurrentYear = priceYears.includes(currentYear);

  // ─── Handlers ─────────────────────────────────────────────

  const updateForm = (patch: Record<string, unknown>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);

    // Extract EXIF GPS if lat/lng are empty
    const latStr = String(form.lat || "").trim();
    const lngStr = String(form.lng || "").trim();
    if (!latStr && !lngStr) {
      const gps = await extractExifGps(file);
      if (gps) {
        updateForm({ lat: String(gps.lat), lng: String(gps.lng) });
        setGpsMsg("GPS-position har hämtats från bilden.");
        setTimeout(() => setGpsMsg(""), 6000);
      }
    }
  };

  const handleRemoveTenant = (tenant: BerthTenant) => {
    const updatedTenants = ((form.tenants || []) as BerthTenant[]).filter(
      (t) => t.uid !== tenant.uid
    );
    const newInvoiceId =
      form.invoiceResponsibleId === tenant.uid
        ? updatedTenants.length > 0
          ? updatedTenants[0].uid
          : ""
        : form.invoiceResponsibleId;
    updateForm({
      tenants: updatedTenants,
      invoiceResponsibleId: newInvoiceId,
    });
    setConfirmRemoveTenant(null);
  };

  const handleSave = async () => {
    if (!berth) return;
    setSaving(true);
    try {
      // Upload new image if selected
      let objectImageUrl = berth.objectImageUrl;
      if (imageFile) {
        objectImageUrl = await uploadBoatImage(imageFile, berth.id);
      } else if (removeImage) {
        objectImageUrl = undefined;
      }

      const isOccupied =
        (form.occupantFirstName as string).trim().length > 0 ||
        ((form.tenants as BerthTenant[]) || []).length > 0;

      const updateData: Record<string, unknown> = {
        // Identity
        markingCode: form.markingCode,
        sortOrder: form.sortOrder !== "" ? Number(form.sortOrder) : null,
        direction: (form.direction as string) || null,
        dockId: form.dockId,
        // Occupant
        occupantFirstName: form.occupantFirstName,
        occupantLastName: form.occupantLastName,
        occupantPhone: form.occupantPhone,
        occupantEmail: form.occupantEmail,
        occupantAddress: form.occupantAddress,
        occupantPostalAddress: form.occupantPostalAddress,
        comment: form.comment,
        // Flags
        secret: form.secret,
        allowSecondHand: form.allowSecondHand,
        invoiceSecondHandTenantDirectly: form.allowSecondHand
          ? form.invoiceSecondHandTenantDirectly
          : false,
        // Dimensions
        maxWidth: form.maxWidth !== "" ? Number(form.maxWidth) : null,
        maxLength: form.maxLength !== "" ? Number(form.maxLength) : null,
        heading: form.heading !== "" ? Number(form.heading) : null,
        // GPS
        lat: String(form.lat || "").trim() ? Number(form.lat) : null,
        lng: String(form.lng || "").trim() ? Number(form.lng) : null,
        // Pricing (replaces legacy fields)
        prices: form.prices,
        price2025: null,
        price2026: null,
        // Tenants
        tenants: form.tenants,
        invoiceResponsibleId: form.invoiceResponsibleId || null,
        // Internal comments
        internalComments: form.internalComments,
        // Image
        objectImageUrl: objectImageUrl || null,
        // Status
        status: isOccupied ? "Occupied" : "Available",
      };

      await updateDoc(doc(db, "resources", berth.id), updateData);

      // Batch-save any other berths that were repositioned by dragging
      const moveEntries = Object.entries(movedBerths);
      for (const [berthId, pos] of moveEntries) {
        if (berthId !== berth.id) {
          await updateDoc(doc(db, "resources", berthId), { lat: pos.lat, lng: pos.lng });
        }
      }

      // Build updated berth object for the callback
      const updated: Berth = {
        ...berth,
        ...(updateData as Partial<Berth>),
        objectImageUrl,
      };

      onSaved(updated);
    } catch (err) {
      console.error("Error saving berth:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async () => {
    if (!berth) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "resources", berth.id), {
        occupantFirstName: "",
        occupantLastName: "",
        occupantPhone: "",
        occupantEmail: "",
        occupantAddress: "",
        occupantPostalAddress: "",
        status: "Available",
        paymentStatus: "Unpaid",
      });
      onSaved({
        ...berth,
        occupantFirstName: "",
        occupantLastName: "",
        occupantPhone: "",
        occupantEmail: "",
        occupantAddress: "",
        occupantPostalAddress: "",
        status: "Available",
        paymentStatus: "Unpaid",
      });
    } catch (err) {
      console.error("Error releasing berth:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!berth) return null;

  return (
    <>
      <Dialog
        open={!!berth}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AnchorIcon sx={{ color: "primary.main" }} />
          {String(form.markingCode || "") || berth.berthNumber}
          {!!form.secret && (
            <LockIcon fontSize="small" sx={{ color: "warning.main", ml: 0.5 }} />
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0 }}>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* SECTION 1: Occupant Information                       */}
            {/* ═══════════════════════════════════════════════════════ */}
            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main" }}>
                Användare
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth label="Förnamn" disabled={readOnly}
                value={form.occupantFirstName || ""}
                onChange={(e) => updateForm({ occupantFirstName: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth label="Efternamn" disabled={readOnly}
                value={form.occupantLastName || ""}
                onChange={(e) => updateForm({ occupantLastName: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth label="Telefon" disabled={readOnly}
                value={form.occupantPhone || ""}
                onChange={(e) => updateForm({ occupantPhone: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth label="E-post" type="email" disabled={readOnly}
                value={form.occupantEmail || ""}
                onChange={(e) => updateForm({ occupantEmail: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth label="Adress" disabled={readOnly}
                value={form.occupantAddress || ""}
                onChange={(e) => updateForm({ occupantAddress: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth label="Postadress" disabled={readOnly}
                value={form.occupantPostalAddress || ""}
                onChange={(e) => updateForm({ occupantPostalAddress: e.target.value })}
              />
            </Grid>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* SECTION 2: Tenants (linked accounts)                  */}
            {/* ═══════════════════════════════════════════════════════ */}
            {((form.tenants as BerthTenant[]) || []).length > 0 && (
              <>
                <Grid size={12}><Divider sx={{ borderColor: "rgba(79,195,247,0.15)" }} /></Grid>
                <Grid size={12}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main" }}>
                    Hyresgäster
                  </Typography>
                  <RadioGroup
                    value={(form.invoiceResponsibleId as string) || ""}
                    onChange={(e) => updateForm({ invoiceResponsibleId: e.target.value })}
                  >
                    {((form.tenants as BerthTenant[]) || []).map((t: BerthTenant) => (
                      <Box
                        key={t.uid}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 1,
                          p: 1,
                          borderRadius: 1,
                          bgcolor: "rgba(79,195,247,0.05)",
                          border: "1px solid rgba(79,195,247,0.1)",
                        }}
                      >
                        <FormControlLabel
                          value={t.uid}
                          control={<Radio size="small" />}
                          label=""
                          sx={{ mr: 0 }}
                          disabled={readOnly}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {t.name}
                            {form.invoiceResponsibleId === t.uid && (
                              <Chip
                                label="Faktureringsansvarig"
                                size="small"
                                color="primary"
                                sx={{ ml: 1, height: 20, fontSize: 11 }}
                              />
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t.phone} &middot; {t.email}
                          </Typography>
                        </Box>
                        {!readOnly && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setConfirmRemoveTenant(t)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    ))}
                  </RadioGroup>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    Välj faktureringsansvarig med radioknappen
                  </Typography>
                </Grid>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* SECTION 3: Berth Properties                           */}
            {/* ═══════════════════════════════════════════════════════ */}
            <Grid size={12}><Divider sx={{ borderColor: "rgba(79,195,247,0.15)" }} /></Grid>
            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main" }}>
                Platsuppgifter
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth label="Platskod" disabled={readOnly}
                value={String(form.markingCode || "")}
                onChange={(e) => updateForm({ markingCode: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth label="Sorteringsordning" type="number" disabled={readOnly}
                value={form.sortOrder ?? ""}
                onChange={(e) =>
                  updateForm({ sortOrder: e.target.value ? Number(e.target.value) : "" })
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <FormControl fullWidth disabled={readOnly}>
                <InputLabel>Riktning</InputLabel>
                <Select
                  value={(form.direction as string) || ""}
                  label="Riktning"
                  onChange={(e: SelectChangeEvent) => updateForm({ direction: e.target.value })}
                >
                  <MenuItem value=""><em>Ej vald</em></MenuItem>
                  <MenuItem value="inside">Insida (skyddad)</MenuItem>
                  <MenuItem value="outside">Utsida (exponerad)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <FormControl fullWidth disabled={readOnly}>
                <InputLabel>Brygga</InputLabel>
                <Select
                  value={(form.dockId as string) || ""}
                  label="Brygga"
                  onChange={(e: SelectChangeEvent) => updateForm({ dockId: e.target.value })}
                >
                  {docks.map((d) => (
                    <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Dimensions */}
            <Grid size={{ xs: 4, md: 2 }}>
              <TextField
                fullWidth label="Max bredd (m)" type="number" disabled={readOnly}
                value={form.maxWidth ?? ""}
                onChange={(e) => updateForm({ maxWidth: e.target.value })}
                slotProps={{ htmlInput: { step: 0.1 } }}
              />
            </Grid>
            <Grid size={{ xs: 4, md: 2 }}>
              <TextField
                fullWidth label="Max längd (m)" type="number" disabled={readOnly}
                value={form.maxLength ?? ""}
                onChange={(e) => updateForm({ maxLength: e.target.value })}
                slotProps={{ htmlInput: { step: 0.1 } }}
              />
            </Grid>
            <Grid size={{ xs: 4, md: 2 }}>
              <TextField
                fullWidth label="Heading (°)" type="number" disabled={readOnly}
                value={form.heading ?? ""}
                onChange={(e) => updateForm({ heading: e.target.value })}
                slotProps={{ htmlInput: { step: 1, min: 0, max: 360 } }}
                helperText="0=N, 90=Ö"
              />
            </Grid>

            {/* Flags */}
            <Grid size={{ xs: 6, md: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!form.secret}
                    onChange={(e) => updateForm({ secret: e.target.checked })}
                    disabled={readOnly}
                  />
                }
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <LockIcon fontSize="small" />
                    Hemlig
                  </Box>
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!form.allowSecondHand}
                    onChange={(e) =>
                      updateForm({
                        allowSecondHand: e.target.checked,
                        invoiceSecondHandTenantDirectly: e.target.checked
                          ? form.invoiceSecondHandTenantDirectly
                          : false,
                      })
                    }
                    disabled={readOnly}
                  />
                }
                label="Tillåt andrahand"
              />
            </Grid>
            {!!form.allowSecondHand && (
              <Grid size={{ xs: 6, md: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!form.invoiceSecondHandTenantDirectly}
                      onChange={(e) =>
                        updateForm({ invoiceSecondHandTenantDirectly: e.target.checked })
                      }
                      disabled={readOnly}
                    />
                  }
                  label="Fakturera andrahand direkt"
                />
              </Grid>
            )}

            {/* Comment */}
            <Grid size={12}>
              <TextField
                fullWidth label="Kommentar" multiline minRows={2} disabled={readOnly}
                value={form.comment || ""}
                onChange={(e) => updateForm({ comment: e.target.value })}
              />
            </Grid>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* SECTION 3.5: Map Position                              */}
            {/* ═══════════════════════════════════════════════════════ */}
            <Grid size={12}><Divider sx={{ borderColor: "rgba(79,195,247,0.15)" }} /></Grid>
            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main", mb: 1 }}>
                Kartposition
              </Typography>
              {gpsMsg && (
                <Alert severity="success" sx={{ mb: 1 }}>{gpsMsg}</Alert>
              )}
              <Box sx={{ height: 350, border: "1px solid rgba(79,195,247,0.15)", borderRadius: 1, overflow: "hidden", mb: 1 }}>
                <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}>
                  <GMap
                    key={String(form.lat || "") && String(form.lng || "") ? "has-coords" : "no-coords"}
                    defaultCenter={
                      String(form.lat || "") && String(form.lng || "") &&
                      !isNaN(parseFloat(String(form.lat))) && !isNaN(parseFloat(String(form.lng)))
                        ? { lat: parseFloat(String(form.lat)), lng: parseFloat(String(form.lng)) }
                        : HARBOR_CENTER
                    }
                    defaultZoom={19}
                    mapId="berth-edit-map"
                    mapTypeId="satellite"
                    style={{ width: "100%", height: "100%" }}
                    gestureHandling="greedy"
                    disableDefaultUI
                    zoomControl
                    onClick={(e) => {
                      if (readOnly) return;
                      const ll = e.detail?.latLng;
                      if (ll) updateForm({
                        lat: String(ll.lat),
                        lng: String(ll.lng),
                        maxWidth: form.maxWidth || 2,
                        maxLength: form.maxLength || 5,
                      });
                    }}
                  >
                    <EditBerthPolygon
                      lat={String(form.lat || "").trim() ? parseFloat(String(form.lat)) : undefined}
                      lng={String(form.lng || "").trim() ? parseFloat(String(form.lng)) : undefined}
                      width={Number(form.maxWidth) || 2}
                      length={Number(form.maxLength) || 5}
                      heading={Number(form.heading) || 0}
                      label={String(form.markingCode || "")}
                      onMove={(lat, lng) => updateForm({ lat: String(lat), lng: String(lng) })}
                      onMoveOther={(id, lat, lng) => setMovedBerths((prev) => ({ ...prev, [id]: { lat, lng } }))}
                      allBerths={allBerths}
                      currentId={berth.id}
                    />
                  </GMap>
                </APIProvider>
              </Box>
              <Box sx={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
                <TextField
                  label="Latitud" type="number" size="small" disabled={readOnly}
                  value={String(form.lat ?? "")}
                  onChange={(e) => updateForm({ lat: e.target.value })}
                  slotProps={{ htmlInput: { step: 0.000001 } }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Longitud" type="number" size="small" disabled={readOnly}
                  value={String(form.lng ?? "")}
                  onChange={(e) => updateForm({ lng: e.target.value })}
                  slotProps={{ htmlInput: { step: 0.000001 } }}
                  sx={{ flex: 1 }}
                />
                {!readOnly && (String(form.lat || "") || String(form.lng || "")) && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={() => updateForm({ lat: "", lng: "" })}
                    sx={{ whiteSpace: "nowrap", minWidth: "auto" }}
                  >
                    Rensa GPS
                  </Button>
                )}
              </Box>
              {!readOnly && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  Klicka på kartan för att placera platsen, eller ladda upp en bild med GPS-data.
                </Typography>
              )}
            </Grid>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* SECTION 4: Pricing                                    */}
            {/* ═══════════════════════════════════════════════════════ */}
            <Grid size={12}><Divider sx={{ borderColor: "rgba(79,195,247,0.15)" }} /></Grid>
            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main", mb: 1 }}>
                Prisutveckling
              </Typography>
              <Table size="small" sx={{ mb: 1, "& td, & th": { borderColor: "rgba(79,195,247,0.1)" } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: 100 }}>År</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Pris (kr)</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 60 }} align="right">Ändring</TableCell>
                    {!readOnly && <TableCell sx={{ width: 50 }} />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {priceYears.map((year, idx) => {
                    const price = pricesMap[year];
                    const prevPrice = idx > 0 ? pricesMap[priceYears[idx - 1]] : null;
                    const change =
                      prevPrice != null && prevPrice > 0
                        ? (((price - prevPrice) / prevPrice) * 100).toFixed(0)
                        : null;
                    return (
                      <TableRow key={year}>
                        <TableCell sx={{ fontWeight: 600 }}>{year}</TableCell>
                        <TableCell>
                          {readOnly ? (
                            <Typography variant="body2">{price?.toLocaleString("sv-SE")} kr</Typography>
                          ) : (
                            <TextField
                              size="small"
                              type="number"
                              value={price}
                              onChange={(e) => {
                                const newPrices = {
                                  ...pricesMap,
                                  [year]: e.target.value ? Number(e.target.value) : 0,
                                };
                                updateForm({ prices: newPrices });
                              }}
                              slotProps={{ htmlInput: { min: 0, step: 100 } }}
                              sx={{ width: 140 }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {change != null && (
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 600,
                                color:
                                  parseInt(change) > 0
                                    ? "#EF5350"
                                    : parseInt(change) < 0
                                      ? "#66BB6A"
                                      : "text.secondary",
                              }}
                            >
                              {parseInt(change) > 0 ? "+" : ""}
                              {change}%
                            </Typography>
                          )}
                        </TableCell>
                        {!readOnly && (
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                const { [year]: _, ...rest } = pricesMap;
                                updateForm({ prices: rest });
                              }}
                              title="Ta bort"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {priceYears.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={readOnly ? 3 : 4}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                          Inga priser registrerade
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {!readOnly && (
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {!hasCurrentYear && pricesMap[prevYear] && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      sx={{ textTransform: "none" }}
                      onClick={() => {
                        updateForm({
                          prices: { ...pricesMap, [currentYear]: pricesMap[prevYear] },
                        });
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
                        updateForm({
                          prices: { ...pricesMap, [currentYear]: 0 },
                        });
                      }}
                    >
                      + Nytt pris {currentYear}
                    </Button>
                  )}
                </Box>
              )}
            </Grid>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* SECTION 5: Photo                                      */}
            {/* ═══════════════════════════════════════════════════════ */}
            <Grid size={12}><Divider sx={{ borderColor: "rgba(79,195,247,0.15)" }} /></Grid>
            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main", mb: 1 }}>
                Foto
              </Typography>
              {imagePreview && !removeImage ? (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                  <Box
                    component="img"
                    src={imagePreview}
                    alt="Berth"
                    sx={{
                      width: 180,
                      height: 120,
                      objectFit: "cover",
                      borderRadius: 1,
                      border: "1px solid rgba(79,195,247,0.2)",
                      cursor: "pointer",
                    }}
                    onClick={() => setPreviewImageUrl(imagePreview)}
                  />
                  {!readOnly && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<PhotoCameraIcon />}
                        onClick={() => setImagePickerOpen(true)}
                      >
                        Byt bild
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setRemoveImage(true);
                          setImageFile(null);
                        }}
                      >
                        Ta bort
                      </Button>
                    </Box>
                  )}
                </Box>
              ) : (
                !readOnly && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PhotoCameraIcon />}
                    onClick={() => setImagePickerOpen(true)}
                  >
                    Ladda upp foto
                  </Button>
                )
              )}
            </Grid>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* SECTION 6: Internal Comments                          */}
            {/* ═══════════════════════════════════════════════════════ */}
            {!readOnly && (
              <>
                <Grid size={12}><Divider sx={{ borderColor: "rgba(79,195,247,0.15)" }} /></Grid>
                <Grid size={12}>
                  <InternalCommentsPanel
                    comments={(form.internalComments || []) as InternalComment[]}
                    onChange={(updated) => updateForm({ internalComments: updated })}
                    userNames={userNames}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          {!readOnly && berth.status === "Occupied" && (
            <Button
              color="error"
              onClick={handleRelease}
              disabled={saving}
              sx={{ mr: "auto" }}
            >
              Frigör plats
            </Button>
          )}
          <Button onClick={onClose}>
            {readOnly ? "Stäng" : "Avbryt"}
          </Button>
          {!readOnly && (
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : undefined}
            >
              {saving ? "Sparar..." : "Spara"}
            </Button>
          )}
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

      {/* Image picker */}
      <ImagePickerDialog
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onChange={handleImageChange}
      />

      {/* Confirm tenant removal */}
      <Dialog open={!!confirmRemoveTenant} onClose={() => setConfirmRemoveTenant(null)}>
        <DialogContent>
          <Typography>
            Vill du ta bort {confirmRemoveTenant?.name} från denna plats?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemoveTenant(null)}>Avbryt</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => confirmRemoveTenant && handleRemoveTenant(confirmRemoveTenant)}
          >
            Ja, ta bort
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
