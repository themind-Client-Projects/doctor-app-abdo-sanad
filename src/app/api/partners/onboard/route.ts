import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

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

    // Relations the requirement calls out: "ربطه بمجمع أو سند"
    complexId: z.string().trim().min(1).optional(),
    isSanadLinked: z.boolean().default(false),

    // DOCTOR only
    specialtyId: z.string().trim().min(1).optional(),
    experience: z.number().int().min(0).max(70).optional(),
    gender: z.enum(["MALE", "FEMALE"]).optional(),

    /** Present when this partner also owns a medical complex. */
    complexName: z.string().trim().min(2).max(120).optional(),
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

  const data = await prisma.$transaction(async (tx) => {
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
        isSanadLinked: input.isSanadLinked,
        complexId: input.complexId,
      },
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
          isSanadLinked: input.isSanadLinked,
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

    await tx.activityLog.create({
      data: {
        userId: identity.userId,
        action: `إضافة شريك جديد: ${input.name}`,
        entityType: "partner",
        entityId: partner.id,
        details: { type: input.type, status: input.status },
      },
    });

    return tx.partner.findUniqueOrThrow({
      where: { id: partner.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        governorate: { select: { id: true, name: true } },
        complex: { select: { id: true, name: true } },
        ownedComplex: { select: { id: true, name: true } },
        wallet: { select: { id: true, balance: true } },
      },
    });
  });

  return ok(data, { status: 201, requestId });
});
