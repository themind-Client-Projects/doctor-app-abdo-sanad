import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

/**
 * Subscription packages — "الاشتراكات والباقات" on the patient home screen.
 *
 * Not paginated: this is a short, curated list (three today). `serviceType`-style
 * bounds do not apply, but a storefront with hundreds of plans is a product
 * problem, not a paging one.
 */

export const planFields = z.object({
  name: z.string().trim().min(2, { message: "اسم الباقة مطلوب" }).max(80),
  description: z.string().trim().max(240).nullable().optional(),
  monthlyPrice: z.number().finite().nonnegative({ message: "السعر غير صالح" }),
  features: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  /** Palette and icon keys the client maps itself — never raw CSS classes. */
  accent: z.enum(["blue", "emerald", "purple", "amber", "rose"]).default("blue"),
  icon: z.enum(["activity", "star", "home", "shield", "heart"]).default("activity"),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

const createSchema = planFields.strict();

export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const data = await prisma.healthPlan.findMany({
    orderBy: [{ sortOrder: "asc" }, { monthlyPrice: "asc" }],
  });

  return ok(data, { requestId });
});

export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createSchema);

  const data = await prisma.healthPlan.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      name: input.name,
      description: input.description ?? null,
      monthlyPrice: input.monthlyPrice,
      features: input.features,
      accent: input.accent,
      icon: input.icon,
      isPopular: input.isPopular,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });

  return ok(data, { status: 201, requestId });
});
