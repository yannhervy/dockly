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
  occupantId: string; // FK to User
  boatImageUrl: string; // Firebase Storage URL
  dockId: string; // FK to Dock
}

// ─── Resource subtypes ────────────────────────────────────
export interface Berth extends Resource {
  type: "Berth";
  width: number;
  length: number;
}

export type SeaHutSize = "Large" | "Small";

export interface SeaHut extends Resource {
  type: "SeaHut";
  size: SeaHutSize;
}

export interface Box extends Resource {
  type: "Box";
}

export type LandStorageSeason = "Winter" | "Summer";

export interface LandStorage extends Resource {
  type: "LandStorage";
  season: LandStorageSeason;
  locationNote: string;
}

// Union type for all resource variants
export type AnyResource = Berth | SeaHut | Box | LandStorage;
