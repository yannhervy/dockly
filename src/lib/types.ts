import { Timestamp } from "firebase/firestore";

// ─── User roles ───────────────────────────────────────────
export type UserRole = "Superadmin" | "Dock Manager" | "Tenant";

// What the user has or wants in the harbor (selected during registration)
export type EngagementType =
  | "berth"        // Jag har båtplats
  | "seahut"       // Jag har sjöbod
  | "box"          // Jag har låda
  | "landstorage"  // Jag har uppställning
  | "interest"     // Jag är intresserad av båtplats
  | "other";       // Övrigt

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isPublic: boolean; // Privacy setting for directory
  allowMapSms?: boolean; // Allow managers to send SMS from map (default true)
  phone: string;
  photoURL?: string; // Profile picture URL
  internalComments?: InternalComment[]; // Structured internal notes visible only to managers/superadmin
  engagement?: EngagementType[]; // Harbor engagement (selected during setup)
  registrationNote?: string; // Free-text note from registration (e.g. berth/seahut details)
  approved?: boolean; // false until approved by manager/superadmin (missing = approved for legacy users)
  phoneVerified?: boolean; // true when phone number has been verified via SMS code
  lastLogin?: Timestamp; // Updated each time the user signs in
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

// ─── Internal Comment ─────────────────────────────────────
export interface InternalComment {
  byWho: string;    // userId of the author
  date: Timestamp;  // When the comment was written
  comment: string;  // The comment text
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
  internalComments?: InternalComment[]; // Structured internal notes
}

// ─── Resource subtypes ────────────────────────────────────
export type BerthDirection = "inside" | "outside";

// Denormalized tenant info stored on berth document
export interface BerthTenant {
  uid: string;
  name: string;
  phone: string;
  email: string;
}

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
  prices?: Record<string, number>;  // Yearly price map, e.g. { "2025": 3500, "2026": 4000 }
  /** @deprecated Use prices map instead */
  price2025?: number;
  /** @deprecated Use prices map instead */
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
  tenants?: BerthTenant[]; // Denormalized tenant info (from accepted offers)
  invoiceResponsibleId?: string; // UID of the invoice-responsible tenant
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
  comment: string; // Legacy description (kept for display)
  internalComments?: InternalComment[]; // Structured internal notes
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

// ─── News & Reports ──────────────────────────────────────
// Configurable list of reaction emojis — edit this array to change available reactions
export const REACTION_EMOJIS = ["🐳", "⚓", "🦈", "🦐"];
export const REACTION_LABELS: Record<string, string> = {
  "🐳": "Bra val!",
  "⚓": "Förankrat!",
  "🦈": "Jag hajar!",
  "🦐": "Räkna med det!",
};

// Reactions stored as a map of emoji -> array of user IDs
export type ReactionMap = Record<string, string[]>;

export type PostType = "news" | "report";

export interface NewsPost {
  id: string;
  postType: PostType;              // "news" (admin only) or "report" (any user)
  title: string;
  body: string;
  slug?: string;                   // URL-friendly slug for detail pages
  imageUrls: string[];             // Multiple images supported
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
  reactions: ReactionMap;
  linkedDockIds?: string[];        // Docks related to the report
  linkedBerthCodes?: string[];     // Berth marking codes e.g. "D-9"
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
  preferredBerthId?: string; // Optional FK to a specific berth
  message?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  lastSeenRepliesAt?: Timestamp; // When the user last viewed replies
  status: InterestStatus;
  // Accepted offer tracking
  acceptedOfferId?: string;     // ID of the accepted reply
  acceptedBerthId?: string;     // FK to the accepted berth resource
  acceptedBerthCode?: string;   // Denormalized marking code e.g. "D-9"
}

// Single berth offer within a reply (supports multi-berth offers)
export interface OfferedBerth {
  berthId: string;
  berthCode: string;
  dockName: string;
  price?: number;
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
  // Multi-berth offer (new format)
  offeredBerths?: OfferedBerth[];
  // Legacy single-berth offer fields (backwards compat)
  offeredBerthId?: string;
  offeredBerthCode?: string;
  offeredDockName?: string;
  offeredPrice?: number;
  offerStatus?: "pending" | "accepted" | "declined";
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
  comment?: string;                      // Legacy notes (kept for display)
  internalComments?: InternalComment[]; // Structured internal notes
  claimedByUid?: string;                 // Firebase UID of the owner who claimed it
  claimedByName?: string;                // Display name of the claimer
  claimedByPhone?: string;               // Phone of the claimer (for admin to contact)
  claimedAt?: Timestamp;                 // When ownership was claimed
  purchaseListingId?: string;            // Linked marketplace listing ID
}

// ─── Points of Interest ───────────────────────────────────

export interface POI {
  id: string;              // Document ID = the POI name
  comment?: string;        // Description displayed on click
  imageUrl?: string;       // Optional photo
  lat: number;             // GPS latitude
  lng: number;             // GPS longitude
}
