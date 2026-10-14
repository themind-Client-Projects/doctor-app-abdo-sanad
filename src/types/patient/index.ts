import type { LucideIcon } from 'lucide-react';

// ─── Core Entity Types ──────────────────────────────────────────────────

export interface Doctor {
  /** `DoctorProfile.id`. */
  id: string;
  /**
   * `Partner.id` — a different id space, and the one the booking endpoint
   * prices against. Nullable: a doctor profile whose partner row is missing
   * cannot be charged, and the drawer refuses rather than posting the wrong
   * id. Three shipped defects in this codebase came from conflating the two.
   */
  partnerId?: string | null;
  name: string;
  specialty: string;
  specialtyId: string;
  rating: number;
  /** Completed tasks, not reviews — the platform records no reviews. */
  completedTasks: number;
  location: string;
  clinic: string;
  phone: string;
  price: string;
  isAvailable: boolean;
  experience: string;
  gender: 'male' | 'female';
  image?: string;
}

export interface Lab {
  id: string;
  name: string;
  location: string;
  phone: string;
  rating: number;
  features: string[];
  isOpen: boolean;
}

export interface Pharmacy {
  id: string;
  name: string;
  location: string;
  phone: string;
  rating: number;
}

export interface NursingCenter {
  id: string;
  name: string;
  location: string;
  phone: string;
  rating: number;
}

export interface PhysiotherapyClinic {
  id: string;
  name: string;
  location: string;
  phone: string;
  rating: number;
}

// ─── Booking Types ──────────────────────────────────────────────────────

export type BookingType = 'doctor' | 'lab' | 'physio';
export type BookingStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled';

export interface Booking {
  id: number;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  location: string;
  clinic: string;
  type: BookingType;
  status: BookingStatus;
  price: string;
  bookingRef: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

// ─── Search Types ───────────────────────────────────────────────────────

export type SearchCategory = 'all' | 'doctors' | 'labs' | 'pharmacies' | 'nursing' | 'physiotherapy';

export interface SearchResult {
  id: string;
  name: string;
  subtitle: string;
  category: SearchCategory;
  rating: number;
  location: string;
  href: string;
}

export interface RecentSearch {
  id: string;
  query: string;
  timestamp: number;
}

// ─── Specialization Type ────────────────────────────────────────────────

export interface Specialization {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
}

// ─── E-Commerce Types ───────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  /** Nullable: `Product.imageUrl` is optional, and the card draws a
   *  placeholder rather than pointing <Image> at an empty string. */
  image?: string | null;
  inStock: boolean;
  /** `pharmacyId` was `number`, which is why the detail page ran
   *  `Number(routeParam)` on a cuid and got NaN. It is a `Partner.id`. */
  pharmacyId: string;
  /** يحتاج وصفة طبية — shown on the card; dispensing policy is the
   *  pharmacy's. */
  requiresRx?: boolean;
  description?: string | null;
}
