"use client";

import React, { useState, useMemo, useRef } from "react";
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
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SendIcon from "@mui/icons-material/Send";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { sendSms } from "@/lib/sms";

// ─── Types ──────────────────────────────────────────────
export interface SmsBatchRecipient {
  /** Resource marking code, e.g. "E-1" */
  markingCode: string;
  /** Recipient full name (resolved from invoice responsible / tenants / legacy) */
  name: string;
  /** Recipient phone number (may be empty) */
  phone: string;
  /** Yearly price for this resource */
  price?: number;
}

interface SmsBatchDialogProps {
  open: boolean;
  onClose: () => void;
  recipients: SmsBatchRecipient[];
  /** Default swish receiver phone (logged-in user's phone) */
  defaultSwishPhone: string;
}

// ─── GSM-7 segment calculation ──────────────────────────
const SMS_COST_SEK = 0.52;

function countSmsSegments(text: string): number {
  if (!text) return 0;
  const len = text.length;
  if (len <= 160) return 1;
  return Math.ceil(len / 153); // concatenated SMS uses 153 chars per segment
}

// ─── Placeholder insertion helper ───────────────────────
const PLACEHOLDERS = [
  { value: "{id}", label: "Platskod" },
  { value: "{namn}", label: "Namn" },
  { value: "{pris}", label: "Pris" },
  { value: "{lastPaymentDate}", label: "Sista betalningsdag" },
] as const;

function interpolateMessage(
  template: string,
  recipient: SmsBatchRecipient,
  lastPaymentDate: string
): string {
  return template
    .replace(/\{id\}/g, recipient.markingCode || "—")
    .replace(/\{namn\}/g, recipient.name || "—")
    .replace(/\{pris\}/g, recipient.price != null ? `${recipient.price.toLocaleString("sv-SE")} kr` : "—")
    .replace(/\{lastPaymentDate\}/g, lastPaymentDate || "—");
}

function buildSwishUrl(swishPhone: string, amount: number | undefined, markingCode: string): string {
  const phone = swishPhone.replace(/\s+/g, "");
  const amt = amount != null ? amount.toFixed(2) : "0.00";
  return `https://app.swish.nu/1/p/sw/?sw=${encodeURIComponent(phone)}&amt=${amt}&cur=SEK&msg=${encodeURIComponent(markingCode)}&src=qr`;
}

// ─── Component ──────────────────────────────────────────
export default function SmsBatchDialog({
  open,
  onClose,
  recipients,
  defaultSwishPhone,
}: SmsBatchDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [message, setMessage] = useState("");
  const [swishPhone, setSwishPhone] = useState(defaultSwishPhone);
  const [includeSwish, setIncludeSwish] = useState(true);
  const [lastPaymentDate, setLastPaymentDate] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const [testSent, setTestSent] = useState(false);

  // Ref to the message textarea for caret-position insertion
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setSwishPhone(defaultSwishPhone);
      setSendResult(null);
      setTestSent(false);
    }
  }, [open, defaultSwishPhone]);

  // Build preview rows
  const previewRows = useMemo(() => {
    return recipients.map((r) => {
      const interpolated = interpolateMessage(message, r, lastPaymentDate);
      const swishUrl = includeSwish ? buildSwishUrl(swishPhone, r.price, r.markingCode) : "";
      const fullMessage = swishUrl ? `${interpolated}\n\nBetala via Swish:\n${swishUrl}` : interpolated;
      const hasWarning = !r.phone || (includeSwish && r.price == null);
      const warnings: string[] = [];
      if (!r.phone) warnings.push("Saknar telefonnummer");
      if (includeSwish && r.price == null) warnings.push("Saknar årspris");
      return { ...r, interpolated, swishUrl, fullMessage, hasWarning, warnings };
    });
  }, [recipients, message, swishPhone, includeSwish, lastPaymentDate]);

  const sendableRows = previewRows.filter((r) => r.phone);

  // Insert placeholder at cursor (caret) position
  const handleInsertPlaceholder = (placeholder: string) => {
    const el = messageRef.current;
    if (el) {
      const start = el.selectionStart ?? message.length;
      const end = el.selectionEnd ?? message.length;
      const before = message.slice(0, start);
      const after = message.slice(end);
      const newMsg = before + placeholder + after;
      setMessage(newMsg);
      // Restore focus and move caret after the inserted placeholder
      requestAnimationFrame(() => {
        el.focus();
        const newPos = start + placeholder.length;
        el.setSelectionRange(newPos, newPos);
      });
    } else {
      setMessage((prev) => prev + placeholder);
    }
  };

  // Send test SMS to self (only to the logged-in user's phone)
  const handleTestSms = async () => {
    if (previewRows.length === 0 || !defaultSwishPhone) return;
    setSendingTest(true);
    try {
      const first = previewRows[0];
      await sendSms(defaultSwishPhone, `[TEST] ${first.fullMessage}`);
      setTestSent(true);
      setTimeout(() => setTestSent(false), 5000);
    } catch (err) {
      console.error("Test SMS failed:", err);
    } finally {
      setSendingTest(false);
    }
  };

  const busy = sendingTest || sendingAll;

  // Send all SMS
  const handleSendAll = async () => {
    setSendingAll(true);
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const row of previewRows) {
      if (!row.phone) {
        skipped++;
        continue;
      }
      try {
        await sendSms(row.phone, row.fullMessage);
        sent++;
      } catch {
        failed++;
      }
    }
    setSendResult({ sent, failed, skipped });
    setSendingAll(false);
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        📱 Skicka SMS / Betalning
        <Chip label={`${recipients.length} valda`} size="small" color="primary" sx={{ ml: 1 }} />
      </DialogTitle>

      <DialogContent dividers>
        {sendResult ? (
          <Box sx={{ py: 3, textAlign: "center" }}>
            <Alert severity={sendResult.failed > 0 ? "warning" : "success"} sx={{ mb: 2 }}>
              {sendResult.sent} SMS skickade
              {sendResult.skipped > 0 && `, ${sendResult.skipped} hoppade över (saknar telefon)`}
              {sendResult.failed > 0 && `, ${sendResult.failed} misslyckades`}
            </Alert>
            <Button variant="outlined" onClick={onClose}>
              Stäng
            </Button>
          </Box>
        ) : (
          <>
            {/* Swish receiver */}
            <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
              <TextField
                label="Swish-mottagare (ditt nummer)"
                value={swishPhone}
                onChange={(e) => setSwishPhone(e.target.value)}
                size="small"
                sx={{ minWidth: 220 }}
              />
              <TextField
                label="Sista betalningsdag"
                type="date"
                value={lastPaymentDate}
                onChange={(e) => setLastPaymentDate(e.target.value)}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 180 }}
              />
            </Box>

            {/* Message template */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="subtitle2">Meddelande</Typography>
                <Select
                  value=""
                  size="small"
                  displayEmpty
                  onChange={(e) => {
                    if (e.target.value) handleInsertPlaceholder(e.target.value as string);
                  }}
                  renderValue={() => "Infoga parameter ▾"}
                  sx={{ minWidth: 180, fontSize: "0.85rem" }}
                >
                  {PLACEHOLDERS.map((p) => (
                    <MenuItem key={p.value} value={p.value}>
                      {p.label} — <code>{p.value}</code>
                    </MenuItem>
                  ))}
                </Select>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                inputRef={messageRef}
                placeholder="Skriv ditt meddelande här... Använd {id}, {namn}, {pris}, {lastPaymentDate} som platshållare."
              />
            </Box>

            {/* Include Swish link */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeSwish}
                  onChange={(e) => setIncludeSwish(e.target.checked)}
                />
              }
              label="Inkludera Swish-betalningslänk"
              sx={{ mb: 2 }}
            />

            {/* SMS cost estimation */}
            {(() => {
              const longest = sendableRows.reduce(
                (max, r) => Math.max(max, r.fullMessage.length),
                0
              );
              const segmentsPerMsg = countSmsSegments(
                sendableRows[0]?.fullMessage || ""
              );
              const totalSegments = sendableRows.reduce(
                (sum, r) => sum + countSmsSegments(r.fullMessage),
                0
              );
              const totalCost = totalSegments * SMS_COST_SEK;
              const hasMultiSegment = segmentsPerMsg > 1;

              return (
                <Box sx={{ mb: 2 }}>
                  {hasMultiSegment && (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                      Meddelandet är {longest} tecken — det blir {segmentsPerMsg} SMS per mottagare.
                      Håll dig under 160 tecken för att skicka 1 SMS.
                    </Alert>
                  )}
                  <Box
                    sx={{
                      display: "flex",
                      gap: 3,
                      alignItems: "center",
                      flexWrap: "wrap",
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <Typography variant="body2">
                      Längsta meddelande: <strong>{longest}</strong> tecken → <strong>{segmentsPerMsg}</strong> SMS/st
                    </Typography>
                    <Typography variant="body2">
                      Totalt: <strong>{totalSegments}</strong> segment × {SMS_COST_SEK.toFixed(2)} kr = <strong>{totalCost.toFixed(2)} kr</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ({sendableRows.length} mottagare)
                    </Typography>
                  </Box>
                </Box>
              );
            })()}

            {/* Preview table */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Förhandsgranskning ({previewRows.length} st, {sendableRows.length} skickbara)
            </Typography>
            <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Platskod</TableCell>
                    <TableCell>Mottagare</TableCell>
                    <TableCell>Telefon</TableCell>
                    <TableCell sx={{ minWidth: 300 }}>Meddelande</TableCell>
                    {includeSwish && <TableCell>Swish-länk</TableCell>}
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.map((row) => (
                    <TableRow key={row.markingCode} sx={{ opacity: row.hasWarning ? 0.7 : 1 }}>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{row.markingCode}</TableCell>
                      <TableCell>{row.name || "—"}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{row.phone || "—"}</TableCell>
                      <TableCell sx={{ whiteSpace: "pre-wrap", fontSize: "0.82rem", maxWidth: 350 }}>
                        {row.interpolated || <Typography variant="caption" color="text.secondary">Skriv ett meddelande ovan</Typography>}
                      </TableCell>
                      {includeSwish && (
                        <TableCell sx={{ fontSize: "0.75rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {row.price != null ? (
                            <a href={row.swishUrl} target="_blank" rel="noopener" style={{ color: "#4FC3F7" }}>
                              Öppna
                            </a>
                          ) : "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        {row.hasWarning && (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <WarningAmberIcon sx={{ color: "warning.main", fontSize: 18 }} />
                            <Typography variant="caption" color="warning.main">
                              {row.warnings.join(", ")}
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>

      {!sendResult && (
        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap" }}>
          <Button onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
          <Box sx={{ flex: 1 }} />
          {testSent && (
            <Chip label="Test-SMS skickat ✓" size="small" color="success" />
          )}
          <Button
            variant="outlined"
            onClick={handleTestSms}
            disabled={busy || previewRows.length === 0 || !message.trim()}
            startIcon={sendingTest ? <CircularProgress size={16} /> : undefined}
          >
            Skicka test-SMS
          </Button>
          <Button
            variant="contained"
            onClick={handleSendAll}
            disabled={busy || sendableRows.length === 0 || !message.trim()}
            startIcon={sendingAll ? <CircularProgress size={16} /> : <SendIcon />}
          >
            Skicka alla ({sendableRows.length} st)
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
