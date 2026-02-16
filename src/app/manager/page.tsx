"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { Dock, Resource, User } from "@/lib/types";
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
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

export default function ManagerPage() {
  return (
    <ProtectedRoute allowedRoles={["Superadmin", "Dock Manager"]}>
      <ManagerContent />
    </ProtectedRoute>
  );
}

function ManagerContent() {
  const { firebaseUser, profile, isSuperadmin } = useAuth();
  const [docks, setDocks] = useState<Dock[]>([]);
  const [selectedDockId, setSelectedDockId] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [occupants, setOccupants] = useState<Record<string, User>>({});
  const [loadingDocks, setLoadingDocks] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

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

  // Fetch resources for selected dock
  useEffect(() => {
    if (!selectedDockId) return;
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

  // Toggle payment status
  const togglePayment = async (resourceId: string, current: string) => {
    const newStatus = current === "Paid" ? "Unpaid" : "Paid";
    try {
      await updateDoc(doc(db, "resources", resourceId), {
        paymentStatus: newStatus,
      });
      setResources((prev) =>
        prev.map((r) =>
          r.id === resourceId ? { ...r, paymentStatus: newStatus as Resource["paymentStatus"] } : r
        )
      );
      setSuccessMsg(`Payment status updated to ${newStatus}`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error updating payment:", err);
    }
  };

  // Toggle resource status
  const toggleStatus = async (resourceId: string, current: string) => {
    const newStatus = current === "Available" ? "Occupied" : "Available";
    try {
      await updateDoc(doc(db, "resources", resourceId), {
        status: newStatus,
      });
      setResources((prev) =>
        prev.map((r) =>
          r.id === resourceId ? { ...r, status: newStatus as Resource["status"] } : r
        )
      );
      setSuccessMsg(`Resource status updated to ${newStatus}`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1.5 }}
        >
          <ManageAccountsIcon sx={{ color: "primary.main" }} />
          Dock Manager
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage resources and payments for your assigned docks.
        </Typography>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMsg}
        </Alert>
      )}

      {/* Dock selector */}
      <FormControl fullWidth sx={{ mb: 4, maxWidth: 400 }}>
        <InputLabel>Select Dock</InputLabel>
        <Select
          value={selectedDockId}
          label="Select Dock"
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

      {loadingDocks ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : docks.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography color="text.secondary">
              You are not assigned as manager for any docks.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card>
                <CardContent sx={{ textAlign: "center", py: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.main" }}>
                    {resources.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Resources
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
                    Available
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
                    Occupied
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
                    Unpaid
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
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Marking Code</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell>Occupant</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resources.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {r.markingCode}
                      </TableCell>
                      <TableCell>
                        <Chip label={r.type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={r.status}
                          size="small"
                          color={r.status === "Available" ? "success" : "warning"}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={r.paymentStatus}
                          size="small"
                          color={r.paymentStatus === "Paid" ? "success" : "error"}
                        />
                      </TableCell>
                      <TableCell>
                        {r.occupantIds && r.occupantIds.length > 0
                          ? r.occupantIds.map((id) => occupants[id]?.name || id).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={
                            r.status === "Available" ? (
                              <CancelIcon />
                            ) : (
                              <CheckCircleIcon />
                            )
                          }
                          onClick={() => toggleStatus(r.id, r.status)}
                          sx={{ mr: 1 }}
                        >
                          {r.status === "Available"
                            ? "Set Occupied"
                            : "Set Available"}
                        </Button>
                        <Button
                          size="small"
                          color={r.paymentStatus === "Paid" ? "error" : "success"}
                          onClick={() => togglePayment(r.id, r.paymentStatus)}
                        >
                          {r.paymentStatus === "Paid"
                            ? "Mark Unpaid"
                            : "Mark Paid"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  );
}
