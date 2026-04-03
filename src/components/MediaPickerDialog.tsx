"use client";

import React, { useRef, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import useMediaQuery from "@mui/material/useMediaQuery";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";

interface MediaPickerDialogProps {
  /** Controls visibility */
  open: boolean;
  /** Called when the dialog is closed */
  onClose: () => void;
  /** Called when file(s) are selected */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Allow multiple files */
  multiple?: boolean;
  /** MIME type accept string, e.g. "audio/mpeg,audio/mp3" */
  accept?: string;
  /** Dialog title text */
  title?: string;
  /** Button label text */
  buttonLabel?: string;
  /** Icon for the button */
  icon?: React.ReactNode;
}

/**
 * Generic file picker dialog for non-image media (audio, etc.).
 * On mobile (touch): shows a bottom-sheet dialog with a file picker button.
 * On desktop: opens the file picker directly (no dialog).
 */
export default function MediaPickerDialog({
  open,
  onClose,
  onChange,
  multiple = false,
  accept = "audio/mpeg,audio/mp3,audio/x-m4a",
  title = "Lägg till ljud",
  buttonLabel = "Välj filer",
  icon = <AudioFileIcon />,
}: MediaPickerDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isTouchDevice = useMediaQuery("(pointer: coarse)");

  // On desktop: skip dialog, open file picker directly
  useEffect(() => {
    if (open && !isTouchDevice) {
      const timer = setTimeout(() => {
        fileRef.current?.click();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, isTouchDevice]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    onClose();
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    if (!isTouchDevice) {
      setTimeout(() => onClose(), 300);
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        hidden
        multiple={multiple}
        onChange={handleChange}
        onBlur={handleClose}
      />

      {/* Mobile-only dialog */}
      {isTouchDevice && (
        <Dialog
          open={open}
          onClose={onClose}
          PaperProps={{
            sx: {
              position: "fixed",
              bottom: 0,
              m: 0,
              width: "100%",
              maxWidth: "100%",
              borderRadius: "16px 16px 0 0",
              bgcolor: "rgba(13, 33, 55, 0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(79,195,247,0.12)",
              borderBottom: "none",
            },
          }}
          slotProps={{
            backdrop: {
              sx: { bgcolor: "rgba(0,0,0,0.5)" },
            },
          }}
        >
          <DialogTitle
            sx={{
              textAlign: "center",
              fontWeight: 700,
              pb: 1,
              fontSize: "1.1rem",
            }}
          >
            {title}
          </DialogTitle>
          <Box sx={{ px: 3, pb: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={icon}
              onClick={() => fileRef.current?.click()}
              sx={{
                py: 1.5,
                textTransform: "none",
                borderRadius: 2,
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              {buttonLabel}
            </Button>
            <Button
              fullWidth
              size="small"
              onClick={onClose}
              sx={{
                mt: 0.5,
                textTransform: "none",
                color: "text.secondary",
              }}
            >
              Avbryt
            </Button>
          </Box>
        </Dialog>
      )}
    </>
  );
}
