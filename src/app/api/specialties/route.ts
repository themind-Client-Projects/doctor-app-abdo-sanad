import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";

/**
 * Medical specialties — the filter row on the patient home and the doctor
 * directory, and the FK behind `DoctorProfile.specialtyId`.
 *
 * `/api/v1/specialties` is the read-only patient view; this is the admin's
 * write surface. The frontend has been reading a hardcoded
 * `SPECIALIZATIONS` constant that no admin could edit, while the DB already
 * held the real rows the doctors are keyed to — so a specialty could be shown
 * in the filter that matched no doctor, and vice versa.
 */

export const specialtyFields = z.object({
  /** Stable machine key. Clients branch on this, never on `name`. */
  slug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, { message: "المعرّف يجب أن يكون حروفاً لاتينية صغيرة وأرقاماً وشرطات" }),
  name: z.string().trim().min(2, { message: "اسم التخصص مطلوب" }).max(80),
  /** Icon and colour keys the client maps itself — never raw CSS. */
  icon: z.string().trim().max(48).nullable().optional(),
  color: z.string().trim().max(48).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

const createSchema = specialtyFields.strict();

export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const data = await prisma.specialty.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    // How many doctors depend on each one — the number that decides whether
    // deactivating a specialty is safe.
    include: { _count: { select: { doctors: true } } },
  });

  return ok(data, { requestId });
});

export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createSchema);

  // `slug` is @unique — a duplicate raises P2002, mapped to 409 by withAuth.
  const data = await prisma.specialty.create({
    data: {
      slug: input.slug,
      name: input.name,
      icon: input.icon ?? null,
      color: input.color ?? null,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
  });

  return ok(data, { status: 201, requestId });
});
