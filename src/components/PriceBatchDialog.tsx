"use client";

import React, { useState, useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ToggleButton from "@mui/material/ToggleButton";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { Resource, Berth } from "@/lib/types";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ──────────────────────────────────────────────
interface PriceBatchDialogProps {
  open: boolean;
  onClose: () => void;
  resources: Resource[];
  /** Called after successful update so parent can refresh state */
  onUpdated: (updatedResources: Resource[]) => void;
}

type PriceAction = "copy" | "increase" | "remove";

const currentYear = new Date().getFullYear().toString();
const lastYear = (new Date().getFullYear() - 1).toString();

// ─── Component ──────────────────────────────────────────
export default function PriceBatchDialog({
  open,
  onClose,
  resources,
  onUpdated,
}: PriceBatchDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [action, setAction] = useState<PriceAction>("copy");
  const [increasePercent, setIncreasePercent] = useState<string>("5");
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setAction("copy");
      setIncreasePercent("5");
      setConfirmRemove(false);
    }
  }, [open]);

  // Compute preview rows
  const previewRows = useMemo(() => {
    const pct = parseFloat(increasePercent) || 0;

    return resources.map((r) => {
      const b = r as Berth;
      const priceLastYear = b.prices?.[lastYear] ?? undefined;
      const priceThisYear = b.prices?.[currentYear] ?? undefined;
      const hasExistingPrice = priceThisYear != null;

      let newPrice: number | undefined;
      switch (action) {
        case "copy":
          newPrice = priceLastYear != null ? Math.round(priceLastYear) : undefined;
          break;
        case "increase":
          // Increase from last year's price (or this year if no last year)
          const base = priceLastYear ?? priceThisYear;
          newPrice = base != null ? Math.round(base * (1 + pct / 100)) : undefined;
          break;
        case "remove":
          newPrice = undefined;
          break;
      }

      const willChange = action === "remove"
        ? hasExistingPrice
        : newPrice != null && newPrice !== priceThisYear;

      return {
        id: r.id,
        markingCode: r.markingCode,
        priceLastYear,
        priceThisYear,
        newPrice,
        hasExistingPrice,
        willChange,
        noSource: action !== "remove" && newPrice == null,
      };
    });
  }, [resources, action, increasePercent]);

  const changedRows = previewRows.filter((r) => r.willChange);
  const overwriteRows = previewRows.filter((r) => r.willChange && r.hasExistingPrice);
  const noSourceRows = previewRows.filter((r) => r.noSource);

  // Save prices
  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedResources: Resource[] = [];

      for (const row of previewRows) {
        if (!row.willChange) continue;

        const r = resources.find((res) => res.id === row.id)!;
        const b = r as Berth;
        const existingPrices = b.prices || {};

        let newPrices: Record<string, number>;
        if (action === "remove") {
          // Remove the current year entry
          newPrices = { ...existingPrices };
          delete newPrices[currentYear];
        } else {
          newPrices = { ...existingPrices, [currentYear]: row.newPrice! };
        }

        await updateDoc(doc(db, "resources", r.id), { prices: newPrices });
        updatedResources.push({ ...r, prices: newPrices } as unknown as Resource);
      }

      onUpdated(updatedResources);
      onClose();
    } catch (err) {
      console.error("Error updating prices:", err);
    } finally {
      setSaving(false);
    }
  };

  // Handle remove with confirmation
  const handleRemoveClick = () => {
    if (action === "remove" && !confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    handleSave();
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        💰 Hantera priser {currentYear}
        <Chip label={`${resources.length} platser`} size="small" color="primary" sx={{ ml: 1 }} />
      </DialogTitle>

      <DialogContent dividers>
        {/* Action selector */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Åtgärd</Typography>
          <ToggleButtonGroup
            value={action}
            exclusive
            onChange={(_e, val) => { if (val) { setAction(val); setConfirmRemove(false); } }}
            size="small"
          >
            <ToggleButton value="copy">
              Kopiera förra årets pris ({lastYear})
            </ToggleButton>
            <ToggleButton value="increase">
              Procentuell ökning
            </ToggleButton>
            <ToggleButton value="remove" sx={{ color: "error.main" }}>
              Ta bort årets pris
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Percentage input */}
        {action === "increase" && (
          <Box sx={{ mb: 3 }}>
            <TextField
              label="Ökning (%)"
              type="number"
              value={increasePercent}
              onChange={(e) => setIncreasePercent(e.target.value)}
              size="small"
              sx={{ width: 150 }}
              slotProps={{ htmlInput: { min: -100, max: 1000, step: 0.5 } }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
              Bas: förra årets pris ({lastYear}). Om det saknas används nuvarande årets pris.
            </Typography>
          </Box>
        )}

        {/* Warnings */}
        {overwriteRows.length > 0 && action !== "remove" && (
          <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningAmberIcon />}>
            <strong>{overwriteRows.length} plats(er) har redan ett pris för {currentYear}.</strong>{" "}
            Dessa kommer att skrivas över om du sparar.
          </Alert>
        )}

        {noSourceRows.length > 0 && action !== "remove" && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {noSourceRows.length} plats(er) saknar källpris och kommer inte att uppdateras.
          </Alert>
        )}

        {confirmRemove && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Är du säker?</strong> Du är på väg att ta bort priset för {currentYear} på{" "}
            {changedRows.length} plats(er). Klicka &quot;Bekräfta och ta bort&quot; för att fortsätta.
          </Alert>
        )}

        {/* Preview table */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Förhandsgranskning
        </Typography>
        <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Platskod</TableCell>
                <TableCell align="right">Pris {lastYear}</TableCell>
                <TableCell align="right">Nuv. pris {currentYear}</TableCell>
                <TableCell align="right">
                  {action === "remove" ? "Resultat" : `Nytt pris ${currentYear}`}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {previewRows.map((row) => (
                <TableRow
                  key={row.id}
                  sx={{
                    bgcolor: row.hasExistingPrice && row.willChange && action !== "remove"
                      ? "rgba(255, 183, 77, 0.08)"
                      : row.willChange && action === "remove"
                      ? "rgba(244, 67, 54, 0.06)"
                      : undefined,
                  }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>{row.markingCode}</TableCell>
                  <TableCell align="right">
                    {row.priceLastYear != null
                      ? `${row.priceLastYear.toLocaleString("sv-SE")} kr`
                      : <Typography variant="caption" color="text.secondary">—</Typography>}
                  </TableCell>
                  <TableCell align="right">
                    {row.priceThisYear != null ? (
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {row.priceThisYear.toLocaleString("sv-SE")} kr
                        </Typography>
                        {row.willChange && action !== "remove" && (
                          <WarningAmberIcon sx={{ color: "warning.main", fontSize: 16 }} titleAccess="Kommer att skrivas över" />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {action === "remove" ? (
                      row.willChange ? (
                        <Chip label="Tas bort" size="small" color="error" variant="outlined" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">Inget pris</Typography>
                      )
                    ) : row.newPrice != null ? (
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: row.willChange ? "success.main" : "text.primary",
                        }}
                      >
                        {row.newPrice.toLocaleString("sv-SE")} kr
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Saknar källpris</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.hasExistingPrice && row.willChange && action !== "remove" && (
                      <Chip
                        label="Skrivs över"
                        size="small"
                        sx={{
                          bgcolor: "rgba(255, 183, 77, 0.15)",
                          color: "warning.main",
                          fontWeight: 600,
                          fontSize: "0.7rem",
                        }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Summary */}
        <Box sx={{ mt: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Chip
            label={`${changedRows.length} ändras`}
            size="small"
            color={changedRows.length > 0 ? "primary" : "default"}
          />
          {overwriteRows.length > 0 && action !== "remove" && (
            <Chip
              label={`${overwriteRows.length} skrivs över`}
              size="small"
              sx={{ bgcolor: "rgba(255, 183, 77, 0.15)", color: "warning.main" }}
            />
          )}
          {noSourceRows.length > 0 && action !== "remove" && (
            <Chip label={`${noSourceRows.length} saknar källa`} size="small" />
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Avbryt
        </Button>
        <Button
          variant="contained"
          color={action === "remove" ? "error" : "primary"}
          onClick={handleRemoveClick}
          disabled={saving || changedRows.length === 0}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {action === "remove"
            ? confirmRemove
              ? `Bekräfta och ta bort (${changedRows.length} st)`
              : `Ta bort priser (${changedRows.length} st)`
            : `Spara priser (${changedRows.length} st)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
