import type { Prisma, UserRole } from "@prisma/client";
import type { Identity } from "@/lib/api-auth";
import { isPlatformRole } from "@/lib/roles";

/**
 * Which column on `Order` records an assignment to each kind of partner.
 *
 * This mapping had been written out separately in the assign endpoint, the
 * partner workload count, the booking handler and the seed — four copies of one
 * fact. The seed's copy was the one that drifted: it keyed off the SERVICE
 * rather than the provider and dumped every consultation into `assignedNurseId`,
 * so 44 orders had a doctor sitting in a nurse's slot and were paid through a
 * nurse's commission rule.
 */
export const PROVIDER_SLOT = {
  DOCTOR: "assignedDoctorId",
  LAB: "assignedLabId",
  PHARMACY: "assignedPharmacyId",
  RADIOLOGY: "assignedRadiologyId",
  NURSE: "assignedNurseId",
  DRIVER: "assignedDriverId",
} as const;

export type ProviderRole = keyof typeof PROVIDER_SLOT;
export type ProviderSlot = (typeof PROVIDER_SLOT)[ProviderRole];

/** Every assignment column, in the order settlement resolves a provider. */
export const PROVIDER_SLOTS_IN_PRECEDENCE: readonly ProviderSlot[] = [
  "assignedDoctorId",
  "assignedLabId",
  "assignedPharmacyId",
  "assignedRadiologyId",
  "assignedNurseId",
  "assignedDriverId",
];

/** Can a partner of this role be assigned an order at all? */
export function isProviderRole(role: UserRole): role is ProviderRole {
  return role in PROVIDER_SLOT;
}

/**
 * Limit an order query to what this caller is allowed to see.
 *
 * A platform role (SUPER_ADMIN, OPERATIONS) sees everything. A partner sees
 * only the orders assigned to THEM, in the one column their type occupies — a
 * nurse never sees a lab's queue.
 *
 * Fails closed: a partner-scoped role with no partner row matches the empty
 * string, which matches no order, rather than falling through to everything.
 */
export function orderScopeFor(identity: Identity): Prisma.OrderWhereInput {
  if (isPlatformRole(identity.role)) return {};

  if (!isProviderRole(identity.role)) {
    // A signed-in role that can never hold an assignment — a PATIENT reaching a
    // staff route, say. Match nothing.
    return { id: "__no_such_order__" };
  }

  return { [PROVIDER_SLOT[identity.role]]: identity.partnerId ?? "" };
}
