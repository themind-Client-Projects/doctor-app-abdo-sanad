import type { OrderSource } from "@prisma/client";

/**
 * Where a storefront's own version of a page lives.
 *
 * سند and the public app are two catalogues over the same models: different
 * providers, different prices, separate routes. The pages are already paired —
 * `/doctors` and `/sanad/doctors`, `/labs` and `/sanad/labs` — but the links
 * between them were written by hand, and the Sanad home pointed all five of its
 * categories at the PUBLIC routes. Tapping "الأطباء" inside سند dropped the
 * patient into the public pool, at public prices, with nothing saying so.
 *
 * The same slip appeared on the doctor's profile: reached from سند it still
 * asked the API for the DIRECT price, so a doctor browsed at 20,000 opened at
 * 25,000.
 *
 * Deriving both from the channel means the pair can no longer drift.
 */

/**
 * Any sales channel. COMPLEX is accepted deliberately.
 *
 * Only DIRECT and SANAD have browse routes of their own; a complex is reached
 * through `/complexes/[id]`, not a parallel catalogue. Rather than force every
 * caller to narrow the type — which invites a cast, and a cast invites the
 * wrong prefix — COMPLEX resolves to the public routes, which is where a
 * complex's providers are actually listed.
 */
export type StorefrontChannel = OrderSource;

/** Path prefix for a channel: "" for the public app, "/sanad" for سند. */
export function channelPrefix(channel: StorefrontChannel): string {
  return channel === "SANAD" ? "/sanad" : "";
}

/**
 * A storefront path within the given channel.
 *
 * `channelPath("SANAD", "/doctors")` → `/sanad/doctors`
 * `channelPath("DIRECT", "/doctors")` → `/doctors`
 */
export function channelPath(channel: StorefrontChannel, path: `/${string}`): string {
  return `${channelPrefix(channel)}${path}`;
}

/** A doctor's profile inside the channel the patient is browsing. */
export function doctorProfilePath(channel: StorefrontChannel, doctorId: string): string {
  return channelPath(channel, `/doctors/profile/${doctorId}`);
}

/** The five browse categories, in the channel they belong to. */
export function storefrontCategories(channel: StorefrontChannel) {
  return {
    doctors: channelPath(channel, "/doctors"),
    labs: channelPath(channel, "/labs"),
    pharmacies: channelPath(channel, "/pharmacies"),
    nursing: channelPath(channel, "/nursing"),
    physiotherapy: channelPath(channel, "/physiotherapy"),
  } as const;
}

/**
 * Which browse page a service belongs to.
 *
 * Offers name a `serviceType`, and the card has to lead somewhere real. Falls
 * back to `/services`, which lists everything, rather than guessing at a route
 * that may not exist.
 */
export function serviceBrowsePath(
  channel: StorefrontChannel,
  serviceType: string | null | undefined
): string {
  switch (serviceType) {
    case "IN_PERSON_CONSULT":
    case "ONLINE_CONSULT":
    case "HOME_VISIT":
      return channelPath(channel, "/doctors");
    case "LAB_TEST":
    case "HOME_LAB_TEST":
    case "HOME_BLOOD_DRAW":
      return channelPath(channel, "/labs");
    case "PHARMACY_DISPENSE":
    case "MEDICINE_DELIVERY":
      return channelPath(channel, "/pharmacies");
    case "NURSING":
      return channelPath(channel, "/nursing");
    case "PHYSIOTHERAPY":
      return channelPath(channel, "/physiotherapy");
    default:
      return "/services";
  }
}

/**
 * Where an offer card leads.
 *
 * The provider's own profile when we can address it — a doctor is keyed by
 * `DoctorProfile.id` — otherwise the browse page for the service being
 * discounted, so the card always goes somewhere the offer is actually usable.
 */
export function offerPath(
  channel: StorefrontChannel,
  offer: {
    partnerType?: string | null;
    doctorProfileId?: string | null;
    serviceType?: string | null;
  }
): string {
  if (offer.partnerType === "DOCTOR" && offer.doctorProfileId) {
    return doctorProfilePath(channel, offer.doctorProfileId);
  }
  return serviceBrowsePath(channel, offer.serviceType);
}
