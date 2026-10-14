import { Check, Clock, X } from 'lucide-react';

export type BookingStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled';

/**
 * How a booking's status is shown to a patient.
 *
 * Shared because /bookings and the سند home both render it, and the home used
 * to hardcode «مؤكد» in emerald on a card that was itself invented — so there
 * was no second definition to drift from, only a fiction. Now that the home
 * reads real bookings, one definition keeps the two screens honest about the
 * same row.
 */
export function getBookingStatusConfig(status: BookingStatus) {
  switch (status) {
    case 'confirmed':
      return { label: 'مؤكد', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', icon: <Check className="w-3 h-3" /> };
    case 'pending':
      return { label: 'بانتظار التأكيد', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', icon: <Clock className="w-3 h-3" /> };
    case 'completed':
      return { label: 'مكتمل', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: <Check className="w-3 h-3" /> };
    case 'cancelled':
      return { label: 'ملغي', bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-100', icon: <X className="w-3 h-3" /> };
  }
}
