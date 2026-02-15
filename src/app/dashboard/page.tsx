"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { uploadBoatImage } from "@/lib/storage";
import { Resource } from "@/lib/types";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
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
import CircularProgress from "@mui/material/CircularProgress";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonIcon from "@mui/icons-material/Person";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { profile, firebaseUser } = useAuth();
  const [isPublic, setIsPublic] = useState(profile?.isPublic ?? false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setIsPublic(profile.isPublic);
    }
  }, [profile]);

  // Fetch resources rented by this user
  useEffect(() => {
    if (!firebaseUser) return;
    async function fetchResources() {
      setLoading(true);
      try {
        const q = query(
          collection(db, "resources"),
          where("occupantId", "==", firebaseUser!.uid)
        );
        const snap = await getDocs(q);
        setResources(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Resource)
        );
      } catch (err) {
        console.error("Error fetching resources:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchResources();
  }, [firebaseUser]);

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
        boatImageUrl: url,
      });
      // Update local state
      setResources((prev) =>
        prev.map((r) =>
          r.id === uploadTargetId ? { ...r, boatImageUrl: url } : r
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
                <Avatar
                  sx={{
                    width: 72,
                    height: 72,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    fontSize: 28,
                    fontWeight: 700,
                    mb: 2,
                  }}
                >
                  {profile?.name?.charAt(0)?.toUpperCase() || "U"}
                </Avatar>
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
              </Box>

              <Divider sx={{ mb: 2 }} />

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

              {profile?.phone && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Phone
                  </Typography>
                  <Typography variant="body2">{profile.phone}</Typography>
                </Box>
              )}
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
                              {r.boatImageUrl ? (
                                <Avatar
                                  src={r.boatImageUrl}
                                  variant="rounded"
                                  sx={{ width: 40, height: 40 }}
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
                                {r.boatImageUrl ? "Change" : "Upload"}
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
      </Grid>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </Box>
  );
}
