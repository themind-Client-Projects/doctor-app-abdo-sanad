import { z } from "zod";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody, serviceTypeSchema } from "@/lib/validation";

/**
 * Onboard a service provider — "إضافة طبيب / مجمع / مختبر…" (req L128-182).
 *
 * A partner is not one row. `Partner.userId` is required and @unique, so a
 * partner cannot exist without a `User`; settlement needs a `Wallet`; a doctor
 * needs a `DoctorProfile` to hold their specialty and schedules; and a medical
 * complex is a `Partner` **plus** a `MedicalComplex` row that owns it
 * (`MedicalComplex.partnerId` is @unique).
 *
 * `POST /api/partners` only ever accepted an existing `userId`, so the admin UI
 * had nowhere to send a new doctor — which is why its "إضافة شريك" button
 * pointed at a `/admin/partners/new` page that was never built. This creates
 * the whole graph in ONE transaction, so a half-onboarded partner (a User with
 * no Partner, or a Partner with no Wallet whose first settled order would
 * fail) cannot exist.
 *
 * No password is set. Staff sign in with a password an administrator sets
 * afterwards, and issuing credentials over this endpoint would mean a
 * plaintext password crossing the wire and landing in a request log.
 */

const partnerType = z.enum(["DOCTOR", "LAB", "PHARMACY", "NURSE", "DRIVER", "RADIOLOGY"], {
  message: "نوع الشريك غير صالح",
});

/** Contract term. Long and open-ended beats a date that silently lapses. */
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;

const onboardSchema = z
  .object({
    // Identity
    name: z.string().trim().min(2, { message: "الاسم مطلوب" }).max(120),
    phone: z.string().trim().min(6, { message: "رقم الهاتف مطلوب" }).max(32),
    email: z.string().trim().toLowerCase().email({ message: "بريد إلكتروني غير صالح" }).optional(),

    // Partner
    type: partnerType,
    status: z.enum(["ACTIVE", "SUSPENDED", "PENDING", "PAUSED"]).default("PENDING"),
    governorateId: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).max(240).optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),

    // Relations the requirement calls out: "ربطه بمجمع أو سند".
    complexId: z.string().trim().min(1).optional(),

    /**
     * Which storefronts this provider sells through — the admin's
     * "سند فقط / خارج سند فقط / الاثنان" choice.
     *
     * At least one, because a partner in no channel appears on no page and is
     * therefore invisible the moment they are created.
     */
    channels: z
      .array(z.enum(["DIRECT", "SANAD", "COMPLEX"]))
      .min(1, { message: "اختر قناة واحدة على الأقل" })
      .default(["DIRECT"]),

    // DOCTOR only
    specialtyId: z.string().trim().min(1).optional(),
    experience: z.number().int().min(0).max(70).optional(),
    gender: z.enum(["MALE", "FEMALE"]).optional(),

    /** Present when this partner also owns a medical complex. */
    complexName: z.string().trim().min(2).max(120).optional(),

    /**
     * نسبة الشريك من ١٠٠ — the cut this provider keeps of every order they
     * serve. The remainder goes to the platform.
     *
     * Not a decorative field: it becomes a real `CommissionRule` on a real
     * `Contract`. Settlement refuses a provider with neither, so a partner
     * onboarded without this could never be paid — which is exactly what used
     * to happen, silently, to every partner added through this endpoint.
     */
    partnerShare: z.number().finite().min(1).max(100).default(70),

    /** Services this provider offers. Drives `ServiceConfig` and the contract. */
    services: z.array(serviceTypeSchema).min(1, { message: "اختر خدمة واحدة على الأقل" }),
  })
  .strict();

export const POST = withAuth({ roles: ROLES.ADMIN }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, onboardSchema);

  // `User.phone` and `User.email` are @unique. Checking first turns the common
  // mistake — re-adding someone who already exists — into a message naming the
  // conflict, rather than a bare 409 from the constraint.
  const clash = await prisma.user.findFirst({
    where: {
      OR: [{ phone: input.phone }, ...(input.email ? [{ email: input.email }] : [])],
    },
    select: { id: true, phone: true, email: true },
  });
  if (clash) {
    return fail(
      ErrorCode.DUPLICATE_RESOURCE,
      409,
      clash.phone === input.phone
        ? "رقم الهاتف مسجّل مسبقاً لمستخدم آخر"
        : "البريد الإلكتروني مسجّل مسبقاً لمستخدم آخر",
      { requestId }
    );
  }

  const partnerId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        // The provider's role IS their partner type — a LAB user and a LAB
        // partner that disagree would authorise against one and dispatch
        // against the other.
        role: input.type,
        governorateId: input.governorateId,
        isActive: input.status === "ACTIVE",
      },
    });

    const partner = await tx.partner.create({
      data: {
        userId: user.id,
        type: input.type,
        name: input.name,
        phone: input.phone,
        email: input.email,
        governorateId: input.governorateId,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        status: input.status,
        complexId: input.complexId,
      },
    });

    // Channel membership is a row per storefront, deduped: a doctor picked as
    // "الاثنان" who also belongs to a complex must not attempt COMPLEX twice.
    const channels = [
      ...new Set([...input.channels, ...(input.complexId ? (["COMPLEX"] as const) : [])]),
    ];
    await tx.partnerChannel.createMany({
      data: channels.map((channel) => ({ partnerId: partner.id, channel })),
    });

    // Every partner gets a wallet at creation. Creating it lazily on first
    // settlement means the settlement is the thing that fails.
    await tx.wallet.create({ data: { partnerId: partner.id } });

    if (input.type === "DOCTOR") {
      await tx.doctorProfile.create({
        data: {
          userId: user.id,
          specialtyId: input.specialtyId,
          complexId: input.complexId,
          experience: input.experience,
          gender: input.gender,
        },
      });
    }

    if (input.complexName) {
      await tx.medicalComplex.create({
        data: { partnerId: partner.id, name: input.complexName },
      });
    }

    // ── The contract, without which the partner can never be paid ──────────
    //
    // A wallet alone is not enough: `settleOrder` resolves the provider's
    // contract and the commission rule in force at the order's date, and throws
    // NO_CONTRACT when either is missing. Onboarding created the wallet and
    // stopped there, so every partner added here was unsettleable from birth —
    // 33 of 35 at the time this was found.
    //
    // Dated from today and open-ended: the audit ran into contracts whose fixed
    // end date had quietly passed, turning settlement failures into a mystery.
    const contract = await tx.contract.create({
      data: {
        partnerId: partner.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + FIVE_YEARS_MS),
        services: input.services,
        governorates: input.governorateId ? [input.governorateId] : [],
        terms: "عقد قياسي — النسب قابلة للتعديل من محرك النسب",
        isActive: true,
      },
    });

    // One rule per service, all on the same share. Per-service percentages are
    // refined afterwards on the commission screen; asking for fourteen numbers
    // in an onboarding form would be answered with fourteen guesses.
    const waridShare = 100 - input.partnerShare;
    await tx.commissionRule.createMany({
      data: input.services.map((serviceType) => ({
        contractId: contract.id,
        serviceType,
        partnerShare: input.partnerShare,
        complexShare: 0,
        waridShare,
        nurseShare: 0,
        driverShare: 0,
        referralShare: 0,
        // Matches the contract, so an order placed today already resolves.
        effectiveFrom: contract.startDate,
      })),
    });

    // ── Service configuration ─────────────────────────────────────────────
    //
    // The storefront reads `ServiceConfig.status` to decide whether a provider
    // is bookable. With no row it reads as undefined, so a partner created here
    // appeared to patients as permanently "غير متاح".
    await tx.serviceConfig.createMany({
      data: input.services.map((serviceType) => ({
        partnerId: partner.id,
        serviceType,
        status: input.status === "ACTIVE" ? "ACTIVE" : "PAUSED",
      })),
    });

    await tx.activityLog.create({
      data: {
        userId: identity.userId,
        action: `إضافة شريك جديد: ${input.name}`,
        entityType: "partner",
        entityId: partner.id,
        details: {
          type: input.type,
          status: input.status,
          channels,
          partnerShare: input.partnerShare,
          services: input.services,
        },
      },
    });

    return partner.id;
  }, TX_OPTIONS);

  // Read the finished graph OUTSIDE the transaction.
  //
  // Onboarding writes eleven rows across as many round-trips to a remote
  // pooler, and this projection — six includes — was the most expensive call of
  // the lot. Held inside, it pushed the whole thing past Prisma's 5s default and
  // every onboarding failed with P2028 after ~10s. Nothing here needs to be
  // atomic: the writes already committed, and this only reads them back.
  const data = await prisma.partner.findUniqueOrThrow({
    where: { id: partnerId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      governorate: { select: { id: true, name: true } },
      complex: { select: { id: true, name: true } },
      ownedComplex: { select: { id: true, name: true } },
      channels: { select: { channel: true, status: true } },
      wallet: { select: { id: true, balance: true } },
      contract: {
        select: {
          id: true,
          endDate: true,
          commissionRules: { select: { serviceType: true, partnerShare: true } },
        },
      },
    },
  });

  return ok(data, { status: 201, requestId });
});
