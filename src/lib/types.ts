import { Timestamp } from "firebase/firestore";

// ─── User roles ───────────────────────────────────────────
export type UserRole = "Superadmin" | "Dock Manager" | "Tenant";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isPublic: boolean; // Privacy setting for directory
  allowMapSms?: boolean; // Allow managers to send SMS from map (default true)
  phone: string;
  photoURL?: string; // Profile picture URL
  internalComment?: string; // Internal note visible only to managers/superadmin
  createdAt: Timestamp;
}

// External message sent to a user (subcollection: users/{uid}/messages)
export interface UserMessage {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  sentAsSms: boolean;
  read: boolean;
  createdAt: Timestamp;
  parentId?: string; // Reserved for future reply threading
}

// ─── Dock ─────────────────────────────────────────────────
export type DockType = "Private" | "Association";

export interface Dock {
  id: string;
  name: string;
  type: DockType;
  prefix?: string; // e.g. "A", "B", "C", "D"
  associationName?: string; // Name of the owning association (groups docks)
  imageUrl?: string; // Firebase Storage URL for dock photo
  managerIds: string[]; // List of User IDs who manage this dock
  lat?: number; // GPS latitude
  lng?: number; // GPS longitude
  heading?: number; // Orientation 0-360°
  maxWidth?: number; // Width in meters (for map rectangle)
  maxLength?: number; // Length in meters (for map rectangle)
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
  occupantIds: string[]; // FK to User (supports multiple tenants)
  objectImageUrl?: string; // Firebase Storage URL
  dockId?: string; // FK to Dock (only required for Berths)
  lat?: number; // GPS latitude for map positioning
  lng?: number; // GPS longitude for map positioning
  heading?: number; // Orientation in degrees (0-360)
  maxWidth?: number; // Width in meters (for map rectangle)
  maxLength?: number; // Length in meters (for map rectangle)
}

// ─── Resource subtypes ────────────────────────────────────
export type BerthDirection = "inside" | "outside";

export interface Berth extends Resource {
  type: "Berth";
  dockId: string; // Required for berths
  berthNumber: number; // The berth number within the dock
  sortOrder?: number; // Custom display order within dock
  direction?: BerthDirection; // inside = sheltered, outside = exposed
  width?: number;
  length?: number;
  maxWidth?: number; // Maximum allowed boat width (meters)
  maxLength?: number; // Maximum allowed boat length (meters)
  heading?: number; // Orientation in degrees (0-360)
  lat?: number; // GPS latitude for map positioning
  lng?: number; // GPS longitude for map positioning
  price2025?: number;
  price2026?: number;
  allowSecondHand?: boolean; // Allow tenant to sublet this berth
  invoiceSecondHandTenantDirectly?: boolean; // Invoice the second-hand tenant directly (only relevant if allowSecondHand is true)
  secondHandTenantId?: string; // UID of the second-hand tenant (if any)
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
  occupantFirstName?: string;
  occupantLastName?: string;
  occupantPhone?: string;
  occupantEmail?: string;
  occupantAddress?: string;
  occupantPostalAddress?: string;
  comment?: string;
}

export interface Box extends Resource {
  type: "Box";
  occupantFirstName?: string;
  occupantLastName?: string;
  occupantPhone?: string;
  occupantEmail?: string;
  occupantAddress?: string;
  occupantPostalAddress?: string;
  comment?: string;
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
  email?: string; // Occupant email (for matching to registered users)
  comment: string;
  occupantId?: string; // FK to User (if the occupant is registered)
  paymentStatus: PaymentStatus;
  season?: LandStorageSeason;
  lat?: number; // GPS latitude for map positioning
  lng?: number; // GPS longitude for map positioning
  imageUrl?: string; // Firebase Storage URL for entry photo
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
export type ListingCategory = "Sale" | "WantedToBuy" | "Service" | "SubletOffer" | "SubletWanted";
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
  abandonedObjectId?: string;  // Links listing to an abandoned object
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

// ─── Abandoned Objects ────────────────────────────────────
export type AbandonedObjectType = "Boat" | "SeaHut" | "Box" | "Other";

export interface AbandonedObject {
  id: string;
  abandonedId: number;                   // Auto-incremented display ID
  objectType: AbandonedObjectType;       // What kind of object (default: "Boat")
  lat: number;                           // GPS latitude
  lng: number;                           // GPS longitude
  imageUrl: string;                      // Photo URL
  abandonedSince: Timestamp;             // Abandoned since date
  comment?: string;                      // Optional notes
  claimedByUid?: string;                 // Firebase UID of the owner who claimed it
  claimedByName?: string;                // Display name of the claimer
  claimedByPhone?: string;               // Phone of the claimer (for admin to contact)
  claimedAt?: Timestamp;                 // When ownership was claimed
  purchaseListingId?: string;            // Linked marketplace listing ID
}

