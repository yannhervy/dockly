"use client";

import React, { useRef, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import useMediaQuery from "@mui/material/useMediaQuery";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";

interface ImagePickerDialogProps {
  /** Controls visibility — set to true to open the picker */
  open: boolean;
  /** Called when the dialog is closed (cancel or after selecting a file) */
  onClose: () => void;
  /** Called when a file is selected, same signature as input onChange */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Allow multiple files (e.g. news images) */
  multiple?: boolean;
}

/**
 * On mobile (touch device): shows a dialog with "Take a photo" and "Choose from gallery".
 * On desktop: opens the file picker directly (no dialog).
 */
export default function ImagePickerDialog({
  open,
  onClose,
  onChange,
  multiple = false,
}: ImagePickerDialogProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Detect touch device (mobile/tablet)
  const isTouchDevice = useMediaQuery("(pointer: coarse)");

  // On desktop: skip dialog like before, just open file picker directly
  useEffect(() => {
    if (open && !isTouchDevice) {
      // Small delay to ensure the ref is mounted
      const timer = setTimeout(() => {
        galleryRef.current?.click();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, isTouchDevice]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    onClose();
    // Reset both inputs so the same file can be selected again
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  };

  // Handle gallery close without selection (desktop: user cancelled file picker)
  const handleGalleryClose = () => {
    // On desktop, when the file picker closes without selection,
    // there's no reliable event. The dialog is already not shown,
    // so we rely on the onChange not being called. Close after a delay.
    if (!isTouchDevice) {
      setTimeout(() => onClose(), 300);
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        multiple={multiple}
        onChange={handleChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        multiple={multiple}
        onChange={handleChange}
        onBlur={handleGalleryClose}
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
            Lägg till bild
          </DialogTitle>
          <Box sx={{ px: 3, pb: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<CameraAltIcon />}
              onClick={() => cameraRef.current?.click()}
              sx={{
                py: 1.5,
                textTransform: "none",
                borderRadius: 2,
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              Ta en bild
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              startIcon={<PhotoLibraryIcon />}
              onClick={() => galleryRef.current?.click()}
              sx={{
                py: 1.5,
                textTransform: "none",
                borderRadius: 2,
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              Välj från galleriet
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
