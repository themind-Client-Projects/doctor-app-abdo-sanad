import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

/**
 * Home-screen promo banners — "الإعلانات".
 *
 * The patient home rendered the same `/ads/real_clinic_banner.png` three times
 * from a `[1,2,3].map`, so running an actual campaign meant a code deploy.
 */

export const bannerFields = z.object({
  title: z.string().trim().min(2, { message: "عنوان الإعلان مطلوب" }).max(80),
  subtitle: z.string().trim().max(160).nullable().optional(),
  /** A path under /public or an absolute URL. */
  imageUrl: z.string().trim().min(1, { message: "الصورة مطلوبة" }).max(500),
  href: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

/** A window that ends before it starts would render as permanently invisible
 *  with no indication why. Reject it at the boundary instead. */
const withOrderedWindow = <S extends z.ZodType<{ startsAt?: Date | null; endsAt?: Date | null }>>(
  schema: S
) =>
  schema.refine((v) => !v.startsAt || !v.endsAt || v.startsAt <= v.endsAt, {
    message: "تاريخ البداية يجب أن يسبق تاريخ الانتهاء",
    path: ["endsAt"],
  });

const createSchema = withOrderedWindow(bannerFields.strict());

export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const data = await prisma.banner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return ok(data, { requestId });
});

export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createSchema);

  const data = await prisma.banner.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      title: input.title,
      subtitle: input.subtitle ?? null,
      imageUrl: input.imageUrl,
      href: input.href ?? null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    },
  });

  return ok(data, { status: 201, requestId });
});
