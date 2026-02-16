import { Timestamp } from "firebase/firestore";

// ─── User roles ───────────────────────────────────────────
export type UserRole = "Superadmin" | "Dock Manager" | "Tenant";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isPublic: boolean; // Privacy setting for directory
  phone: string;
  createdAt: Timestamp;
}

// ─── Dock ─────────────────────────────────────────────────
export type DockType = "Private" | "Association";

export interface Dock {
  id: string;
  name: string;
  type: DockType;
  managerIds: string[]; // List of User IDs who manage this dock
}

// ─── Resource (polymorphic base) ──────────────────────────
export type ResourceType = "Berth" | "SeaHut" | "Box" | "LandStorage";
export type ResourceStatus = "Available" | "Occupied";
export type PaymentStatus = "Paid" | "Unpaid";

export interface Resource {
  id: string;
  type: ResourceType;
  status: ResourceStatus;
  paymentStatus: PaymentStatus;
  markingCode: string; // Unique marking code, e.g. V-104
  occupantId?: string; // FK to User (optional, not all occupants are registered)
  boatImageUrl?: string; // Firebase Storage URL
  dockId?: string; // FK to Dock (only required for Berths)
}

// ─── Resource subtypes ────────────────────────────────────
export interface Berth extends Resource {
  type: "Berth";
  dockId: string; // Required for berths
  berthNumber: number; // The berth number within the dock
  width?: number;
  length?: number;
  price2025?: number;
  price2026?: number;
  occupantFirstName?: string;
  occupantLastName?: string;
  occupantPhone?: string;
  occupantEmail?: string;
  occupantAddress?: string;
  occupantPostalAddress?: string;
  comment?: string;
  secret?: boolean; // When true, only superadmin can see occupant info
}

export type SeaHutSize = "Large" | "Small";

export interface SeaHut extends Resource {
  type: "SeaHut";
  size: SeaHutSize;
}

export interface Box extends Resource {
  type: "Box";
}

export type LandStorageSeason = "Winter" | "Summer" | "Year-round";

// ─── Land Storage ─────────────────────────────────────────
// Uses pre-generated 4-digit codes. Occupants may or may not
// be registered users in the system.
export interface LandStorageEntry {
  id: string;
  code: string; // 4-digit non-sequential code
  status: ResourceStatus;
  firstName: string;
  lastName: string;
  phone: string;
  comment: string;
  occupantId?: string; // FK to User (if the occupant is registered)
  paymentStatus: PaymentStatus;
  season?: LandStorageSeason;
  updatedAt?: Timestamp;
}

export interface LandStorage extends Resource {
  type: "LandStorage";
  season: LandStorageSeason;
  locationNote: string;
}

// Union type for all resource variants
export type AnyResource = Berth | SeaHut | Box | LandStorage;

// ─── Marketplace ──────────────────────────────────────────
export type ListingCategory = "Sale" | "Service" | "SubletOffer" | "SubletWanted";
export type ListingStatus = "Active" | "Sold" | "Closed";

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: ListingCategory;
  imageUrl?: string;
  contactEmail: string;
  contactPhone?: string;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp; // Auto-removed after 6 months
  status: ListingStatus;
}

// ─── News ─────────────────────────────────────────────────
// Configurable list of reaction emojis — edit this array to change available reactions
export const REACTION_EMOJIS = ["🐟", "🦀", "🧜", "🌊", "⚓", "☠️"];

// Reactions stored as a map of emoji -> array of user IDs
export type ReactionMap = Record<string, string[]>;

export interface NewsPost {
  id: string;
  title: string;
  body: string;
  imageUrls: string[]; // Multiple images supported
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
  reactions: ReactionMap;
}

// ─── Berth Interest Registration ──────────────────────────
export type InterestStatus = "Pending" | "Contacted" | "Resolved";

export interface BerthInterest {
  id: string;
  userId: string;
  userName: string;
  email: string;
  phone: string;
  boatWidth: number;   // meters
  boatLength: number;  // meters
  preferredDockId?: string;
  message?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  status: InterestStatus;
}

// Reply on an interest registration (subcollection: interests/{id}/replies)
export interface InterestReply {
  id: string;
  interestId: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorPhone: string;
  message: string;
  createdAt: Timestamp;
}

