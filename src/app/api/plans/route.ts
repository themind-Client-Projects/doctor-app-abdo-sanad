import { z } from "zod";
import { Prisma, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { BENEFIT_STATES, PLAN_INCLUDE } from "@/server/services/membership";

/**
 * عضويات وريد وسند — the packages themselves, as the admin edits them.
 *
 * Not paginated: this is a short, curated list (four today). A storefront with
 * hundreds of plans is a product problem, not a paging one.
 *
 * The rows of a card are children, not a JSON list of strings, because each one
 * carries three things a string cannot: which service it maps to, how many uses
 * it includes, and whether it is live, on hold, or locked. They are replaced
 * wholesale on update — see PATCH.
 */

const benefitSchema = z
  .object({
    /** Null for a line that grants access rather than a counted allowance. */
    serviceType: z.nativeEnum(ServiceType).nullable().default(null),
    label: z.string().trim().min(1, { message: "اسم الميزة مطلوب" }).max(80),
    /** Null is unlimited. Zero is a real, different answer: shown, grants none. */
    quota: z.number().int().min(0).max(9999).nullable().default(null),
    state: z.enum(BENEFIT_STATES).default("AVAILABLE"),
    sortOrder: z.number().int().min(0).max(999).default(0),
  })
  .strict();

export const planFields = z.object({
  /** Stable machine key. Lower-cased so `Daily` and `DAILY` cannot both exist. */
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_]+$/, { message: "الرمز بأحرف إنجليزية كبيرة وأرقام فقط" }),
  name: z.string().trim().min(2, { message: "اسم الباقة مطلوب" }).max(80),
  description: z.string().trim().max(240).nullable().optional(),
  price: z.number().finite().nonnegative({ message: "السعر غير صالح" }),
  /** 1 = يومي, 7 = أسبوعي, 30 = شهري, 365 = سنوي. */
  durationDays: z.number().int().min(1, { message: "المدة يوم واحد على الأقل" }).max(3650),
  /** "نسبة الخصم الأساسية" — a percentage, so it cannot exceed 100. */
  discountPercent: z.number().min(0).max(100, { message: "النسبة بين 0 و 100" }).default(0),
  /** Palette and icon keys the client maps itself — never raw CSS classes. */
  accent: z.enum(["blue", "emerald", "purple", "amber", "rose", "slate"]).default("blue"),
  icon: z.enum(["activity", "star", "home", "shield", "heart", "calendar"]).default("activity"),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
  /** "متوفر قريباً" — listed, and refused at purchase. */
  isComingSoon: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
  benefits: z.array(benefitSchema).max(20).default([]),
});

const createSchema = planFields.strict();

/**
 * A service may appear at most once per plan.
 *
 * `MembershipEntitlement` is unique on `(membershipId, serviceType)`, so two
 * rows naming the same service would fail at purchase — long after the admin
 * saved, and with a Prisma constraint error rather than a message about the
 * form they filled in.
 */
function duplicateServiceType(benefits: { serviceType: ServiceType | null }[]) {
  const seen = new Set<ServiceType>();
  for (const benefit of benefits) {
    if (!benefit.serviceType) continue;
    if (seen.has(benefit.serviceType)) return benefit.serviceType;
    seen.add(benefit.serviceType);
  }
  return null;
}

export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const data = await prisma.healthPlan.findMany({
    include: PLAN_INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
  });

  return ok(data, { requestId });
});

export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createSchema);

  const duplicate = duplicateServiceType(input.benefits);
  if (duplicate) {
    return fail(ErrorCode.VALIDATION_FAILED, 400, `الخدمة «${duplicate}» مكرّرة في الباقة`, {
      requestId,
    });
  }

  const data = await prisma.healthPlan.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      price: new Prisma.Decimal(input.price),
      durationDays: input.durationDays,
      discountPercent: new Prisma.Decimal(input.discountPercent),
      accent: input.accent,
      icon: input.icon,
      isPopular: input.isPopular,
      isActive: input.isActive,
      isComingSoon: input.isComingSoon,
      sortOrder: input.sortOrder,
      benefits: { create: input.benefits },
    },
    include: PLAN_INCLUDE,
  });

  return ok(data, { status: 201, requestId });
});

export { benefitSchema, duplicateServiceType };
