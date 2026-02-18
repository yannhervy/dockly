"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { resizeImage } from "@/lib/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { MarketplaceListing } from "@/lib/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import LinearProgress from "@mui/material/LinearProgress";
import StorefrontIcon from "@mui/icons-material/Storefront";
import AddIcon from "@mui/icons-material/Add";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import BuildIcon from "@mui/icons-material/Build";
import SellIcon from "@mui/icons-material/Sell";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import ScheduleIcon from "@mui/icons-material/Schedule";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AnchorIcon from "@mui/icons-material/Anchor";
import SearchIcon from "@mui/icons-material/Search";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import type { ListingCategory } from "@/lib/types";

// Category helpers
const CATEGORY_LABELS: Record<ListingCategory, string> = {
  Sale: "Till salu",
  WantedToBuy: "Köpes",
  Service: "Tjänst",
  SubletOffer: "2-handuthyrning erbjudes",
  SubletWanted: "2-handuthyrning önskas",
};

const CATEGORY_ICONS: Record<ListingCategory, React.ReactNode> = {
  Sale: <SellIcon />,
  WantedToBuy: <ShoppingCartIcon />,
  Service: <BuildIcon />,
  SubletOffer: <AnchorIcon />,
  SubletWanted: <SearchIcon />,
};

const CATEGORY_COLORS: Record<ListingCategory, "primary" | "warning" | "success" | "info"> = {
  Sale: "primary",
  WantedToBuy: "info",
  Service: "warning",
  SubletOffer: "success",
  SubletWanted: "info",
};

// Listings auto-expire after 6 months
const EXPIRY_MONTHS = 6;

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return "";
  return ts.toDate().toLocaleDateString("sv-SE");
}

function getExpiryDate(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + EXPIRY_MONTHS);
  return d;
}

function buildImageFileName(originalName: string): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const ext = originalName.split(".").pop() || "jpg";
  return `buysell_${today}_${Date.now()}.${ext}`;
}

type FormState = {
  title: string;
  description: string;
  price: string;
  category: ListingCategory;
  contactEmail: string;
  contactPhone: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  price: "",
  category: "Sale",
  contactEmail: "",
  contactPhone: "",
};

export default function MarketplacePage() {
  const { firebaseUser, profile } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState(0); // 0=All, 1=Sale, 2=Service, 3=SubletOffer, 4=SubletWanted
  const [editingId, setEditingId] = useState<string | null>(null); // null = creating
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  // Role checks
  const isAdmin =
    profile?.role === "Superadmin" || profile?.role === "Dock Manager";

  const canEditListing = (listing: MarketplaceListing) =>
    firebaseUser?.uid === listing.createdBy;

  const canDeleteListing = (listing: MarketplaceListing) =>
    firebaseUser?.uid === listing.createdBy || isAdmin;

  useEffect(() => {
    fetchListings();
  }, []);

  async function fetchListings() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "marketplace"),
        where("status", "==", "Active"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const now = new Date();
      setListings(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as MarketplaceListing)
          .filter((l) => !l.expiresAt || l.expiresAt.toDate() > now)
      );
    } catch (err) {
      console.error("Error fetching listings:", err);
      try {
        const snap = await getDocs(collection(db, "marketplace"));
        const now = new Date();
        setListings(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as MarketplaceListing)
            .filter(
              (l) =>
                l.status === "Active" &&
                (!l.expiresAt || l.expiresAt.toDate() > now)
            )
        );
      } catch {
        // Ignore
      }
    } finally {
      setLoading(false);
    }
  }

  const categoryByTab: (ListingCategory | null)[] = [null, "Sale", "WantedToBuy", "Service", "SubletOffer", "SubletWanted"];
  const activeCategory = categoryByTab[tab] ?? null;
  const filteredListings = activeCategory
    ? listings.filter((l) => l.category === activeCategory)
    : listings;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setExistingImageUrl(null); // New image replaces old one
    }
  };

  // Open dialog for creating a new listing
  const openCreateDialog = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      contactEmail: profile?.email || firebaseUser?.email || "",
      contactPhone: profile?.phone || "",
    });
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    setDialogOpen(true);
  };

  // Open dialog for editing an existing listing
  const openEditDialog = (listing: MarketplaceListing) => {
    setEditingId(listing.id);
    setForm({
      title: listing.title,
      description: listing.description,
      price: listing.price > 0 ? String(listing.price) : "",
      category: listing.category,
      contactEmail: listing.contactEmail,
      contactPhone: listing.contactPhone || "",
    });
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(listing.imageUrl || null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firebaseUser) return;
    setUploading(true);

    try {
      let imageUrl: string | null = existingImageUrl;

      // Upload new image if selected
      if (imageFile) {
        const fileName = buildImageFileName(imageFile.name);
        const storageRef = ref(storage, `marketplace/${fileName}`);
        const resizedBlob = await resizeImage(imageFile);
        await uploadBytes(storageRef, resizedBlob, { contentType: "image/jpeg" });
        imageUrl = await getDownloadURL(storageRef);
      }

      if (editingId) {
        // Update existing listing
        await updateDoc(doc(db, "marketplace", editingId), {
          title: form.title,
          description: form.description,
          price: Number(form.price) || 0,
          category: form.category,
          imageUrl: imageUrl || null,
          contactEmail:
            form.contactEmail || profile?.email || firebaseUser.email,
          contactPhone: form.contactPhone,
        });
        setSuccess("Annons uppdaterad!");
      } else {
        // Create new listing
        const expiresAt = Timestamp.fromDate(getExpiryDate());
        await addDoc(collection(db, "marketplace"), {
          title: form.title,
          description: form.description,
          price: Number(form.price) || 0,
          category: form.category,
          imageUrl: imageUrl || null,
          contactEmail:
            form.contactEmail || profile?.email || firebaseUser.email,
          contactPhone: form.contactPhone,
          createdBy: firebaseUser.uid,
          createdAt: Timestamp.now(),
          expiresAt,
          status: "Active",
        });
        setSuccess("Annons skapad!");
      }

      setDialogOpen(false);
      resetForm();
      setTimeout(() => setSuccess(""), 3000);
      fetchListings();
    } catch (err) {
      console.error("Error saving listing:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (listingId: string) => {
    try {
      await deleteDoc(doc(db, "marketplace", listingId));
      setSuccess("Annons borttagen!");
      setTimeout(() => setSuccess(""), 3000);
      setDeleteConfirmId(null);
      fetchListings();
    } catch (err) {
      console.error("Error deleting listing:", err);
    }
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 5 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <StorefrontIcon sx={{ fontSize: 36, color: "#FFB74D" }} />
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Köp &amp; Sälj
          </Typography>
        </Box>
        {firebaseUser && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            Skapa annons
          </Button>
        )}
      </Box>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 3, maxWidth: 600 }}
      >
        Marknadsplats för båtutrustning, tjänster och mer. Annonser tas bort
        automatiskt efter {EXPIRY_MONTHS} månader.
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          "& .MuiTab-root": { textTransform: "none", fontWeight: 600 },
        }}
      >
        <Tab label="Alla" />
        <Tab icon={<SellIcon />} iconPosition="start" label="Till salu" />
        <Tab icon={<ShoppingCartIcon />} iconPosition="start" label="Köpes" />
        <Tab icon={<BuildIcon />} iconPosition="start" label="Tjänster" />
        <Tab icon={<AnchorIcon />} iconPosition="start" label="2-handuthyrning erbjudes" />
        <Tab icon={<SearchIcon />} iconPosition="start" label="2-handuthyrning önskas" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredListings.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography color="text.secondary">
            {tab === 0
              ? "Inga annonser ännu. Bli den första!"
              : "Inga annonser i denna kategori."}
          </Typography>
          {!firebaseUser && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1 }}
            >
              Logga in för att skapa en annons.
            </Typography>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredListings.map((listing) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={listing.id}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  bgcolor: "rgba(13, 33, 55, 0.6)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(79,195,247,0.08)",
                  transition: "all 0.3s",
                  "&:hover": {
                    transform: "translateY(-3px)",
                    border: "1px solid rgba(79,195,247,0.2)",
                  },
                }}
              >
                {/* Image */}
                {listing.imageUrl && (
                  <CardMedia
                    component="img"
                    height="180"
                    image={listing.imageUrl}
                    alt={listing.title}
                    sx={{ objectFit: "cover" }}
                  />
                )}

                <CardContent
                  sx={{
                    p: 3,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 1,
                    }}
                  >
                    <Chip
                      icon={CATEGORY_ICONS[listing.category] as React.ReactElement}
                      label={CATEGORY_LABELS[listing.category]}
                      size="small"
                      color={CATEGORY_COLORS[listing.category]}
                    />
                    {listing.price > 0 && (
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, color: "#66BB6A" }}
                      >
                        {listing.price.toLocaleString("sv-SE")} kr
                      </Typography>
                    )}
                  </Box>

                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, mt: 1, mb: 1 }}
                  >
                    {listing.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 2,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      lineHeight: 1.6,
                      flex: 1,
                    }}
                  >
                    {listing.description}
                  </Typography>

                  {/* Expiry info */}
                  {listing.expiresAt && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mb: 1.5,
                      }}
                    >
                      <ScheduleIcon
                        sx={{ fontSize: 14, color: "text.secondary" }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Utgår {formatDate(listing.expiresAt)}
                      </Typography>
                    </Box>
                  )}

                  {/* Contact */}
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.5,
                    }}
                  >
                    {listing.contactEmail && (
                      <Button
                        size="small"
                        startIcon={<EmailIcon />}
                        href={`mailto:${listing.contactEmail}`}
                        sx={{
                          textTransform: "none",
                          justifyContent: "flex-start",
                        }}
                      >
                        {listing.contactEmail}
                      </Button>
                    )}
                    {listing.contactPhone && (
                      <Button
                        size="small"
                        startIcon={<PhoneIcon />}
                        href={`tel:${listing.contactPhone}`}
                        sx={{
                          textTransform: "none",
                          justifyContent: "flex-start",
                        }}
                      >
                        {listing.contactPhone}
                      </Button>
                    )}
                  </Box>

                  {/* Edit / Delete actions */}
                  {(canEditListing(listing) || canDeleteListing(listing)) && (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 0.5,
                        mt: 2,
                        pt: 1.5,
                        borderTop: "1px solid rgba(79,195,247,0.08)",
                      }}
                    >
                      {canEditListing(listing) && (
                        <IconButton
                          size="small"
                          onClick={() => openEditDialog(listing)}
                          sx={{
                            color: "primary.main",
                            "&:hover": {
                              bgcolor: "rgba(79,195,247,0.1)",
                            },
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                      {canDeleteListing(listing) && (
                        <IconButton
                          size="small"
                          onClick={() => setDeleteConfirmId(listing.id)}
                          sx={{
                            color: "error.main",
                            "&:hover": {
                              bgcolor: "rgba(239,83,80,0.1)",
                            },
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create / Edit Listing Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          resetForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingId ? "Redigera annons" : "Skapa annons"}
        </DialogTitle>
        <DialogContent>
          {uploading && <LinearProgress sx={{ mb: 2 }} />}

          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel>Kategori</InputLabel>
            <Select
              value={form.category}
              label="Kategori"
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value as ListingCategory,
                })
              }
            >
              <MenuItem value="Sale">Till salu</MenuItem>
              <MenuItem value="WantedToBuy">Köpes</MenuItem>
              <MenuItem value="Service">Tjänst</MenuItem>
              <MenuItem value="SubletOffer">2-handuthyrning erbjudes</MenuItem>
              <MenuItem value="SubletWanted">2-handuthyrning önskas</MenuItem>
            </Select>
          </FormControl>

          {form.category === "SubletOffer" && (
            <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
              <strong>Observera:</strong> Kontakta bryggansvarig för din brygga innan du hyr ut i andra hand. Uthyrning utöver ordinarie pris är ej tillåtet.
            </Alert>
          )}

          <TextField
            fullWidth
            label="Titel"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            sx={{ mb: 2 }}
            placeholder={
              form.category === "Sale"
                ? "T.ex. Ankare 15kg, begagnad"
                : "T.ex. Krympplastning av båt"
            }
          />

          <TextField
            fullWidth
            label="Beskrivning"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Pris (kr)"
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            sx={{ mb: 2 }}
            helperText={
              form.category === "Service"
                ? "Ange 0 för pris enligt offert"
                : ""
            }
          />

          {/* Image upload */}
          <Box sx={{ mb: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageSelect}
            />
            <Button
              variant="outlined"
              startIcon={<AddPhotoAlternateIcon />}
              onClick={() => fileInputRef.current?.click()}
              fullWidth
              sx={{
                textTransform: "none",
                py: 1.5,
                borderStyle: "dashed",
              }}
            >
              {imageFile
                ? imageFile.name
                : existingImageUrl
                ? "Byt bild"
                : "Lägg till bild (valfritt)"}
            </Button>

            {/* Show existing image when editing */}
            {existingImageUrl && !imagePreview && (
              <Box sx={{ mt: 1 }}>
                <Box
                  component="img"
                  src={existingImageUrl}
                  alt="Current"
                  sx={{
                    width: "100%",
                    maxHeight: 200,
                    objectFit: "cover",
                    borderRadius: 2,
                    opacity: 0.8,
                  }}
                />
              </Box>
            )}

            {/* Show new image preview */}
            {imagePreview && (
              <Box sx={{ mt: 1, position: "relative" }}>
                <Box
                  component="img"
                  src={imagePreview}
                  alt="Preview"
                  sx={{
                    width: "100%",
                    maxHeight: 200,
                    objectFit: "cover",
                    borderRadius: 2,
                  }}
                />
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  sx={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    minWidth: 0,
                    bgcolor: "rgba(0,0,0,0.6)",
                  }}
                >
                  ✕
                </Button>
              </Box>
            )}
          </Box>

          <TextField
            fullWidth
            label="E-post"
            value={form.contactEmail}
            onChange={(e) =>
              setForm({ ...form, contactEmail: e.target.value })
            }
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Telefon (valfritt)"
            value={form.contactPhone}
            onChange={(e) =>
              setForm({ ...form, contactPhone: e.target.value })
            }
            sx={{ mb: 2 }}
          />

          {!editingId && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Annonsen tas bort automatiskt efter {EXPIRY_MONTHS} månader
              (utgår {getExpiryDate().toLocaleDateString("sv-SE")}).
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDialogOpen(false);
              resetForm();
            }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={
              !form.title.trim() || !form.description.trim() || uploading
            }
          >
            {uploading
              ? "Laddar upp..."
              : editingId
              ? "Spara ändringar"
              : "Publicera"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        maxWidth="xs"
      >
        <DialogTitle>Ta bort annons?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Annonsen tas bort permanent och kan inte återställas.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>Avbryt</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
          >
            Ta bort
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
