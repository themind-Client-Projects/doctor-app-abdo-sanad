import type { LucideIcon } from 'lucide-react';

// ─── Core Entity Types ──────────────────────────────────────────────────

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  specialtyId: string;
  rating: number;
  reviewCount: number;
  location: string;
  clinic: string;
  phone: string;
  price: string;
  isAvailable: boolean;
  experience: string;
  gender: 'male' | 'female';
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
