import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { nonEmpty, paginationSchema, parseBody, parseQuery } from "@/lib/validation";

const partnerType = z.enum(
  ["DOCTOR", "LAB", "PHARMACY", "NURSE", "DRIVER", "RADIOLOGY"],
  { message: "نوع الشريك غير صالح" }
);

const partnerStatus = z.enum(["ACTIVE", "SUSPENDED", "PENDING", "PAUSED"], {
  message: "حالة غير صالحة",
});

const listQuerySchema = paginationSchema.extend({
  type: partnerType.optional(),
  status: partnerStatus.optional(),
});

// `rating` and `totalTasks` are derived server-side and are deliberately absent,
// so `.strict()` turns an attempt to set them into a 400.
const createPartnerSchema = z
  .object({
    userId: z.string().trim().min(1, { message: "المستخدم والاسم ورقم الهاتف مطلوبة" }),
    type: partnerType,
    name: z.string().trim().min(1, { message: "المستخدم والاسم ورقم الهاتف مطلوبة" }),
    phone: z.string().trim().min(1, { message: "المستخدم والاسم ورقم الهاتف مطلوبة" }),
    email: z.string().trim().min(1).optional(),
    governorateId: nonEmpty.optional(),
    address: z.string().trim().min(1).optional(),
    status: partnerStatus.default("PENDING"),
    isSanadLinked: z.boolean().default(false),
    complexId: nonEmpty.optional(),
  })
  .strict();

// GET /api/partners — List all partners (req L128-182).
// Dispatch (OPERATIONS) needs to read partners to assign orders.
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  // Clamped by `paginationSchema`: pageSize was unbounded and a non-numeric
  // ?page produced skip: NaN.
  const { page, pageSize, type, status } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  };

  const [partners, total] = await Promise.all([
    prisma.partner.findMany({
      where,
      include: {
        governorate: { select: { name: true } },
        complex: { select: { name: true } },
        contract: { select: { id: true, isActive: true, endDate: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.partner.count({ where }),
  ]);

  return NextResponse.json({
    data: partners,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

// POST /api/partners — Create partner.
// The body used to be spread into prisma.partner.create, so a caller could set
// `rating`, `totalTasks` or `status: "ACTIVE"` on a partner that had not been
// vetted. Only the fields below are writable.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const input = await parseBody(req, createPartnerSchema);

  const partner = await prisma.partner.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      userId: input.userId,
      type: input.type,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      governorateId: input.governorateId ?? null,
      address: input.address ?? null,
      status: input.status,
      isSanadLinked: input.isSanadLinked,
      complexId: input.complexId ?? null,
      wallet: { create: {} }, // Auto-create wallet
    },
    include: { wallet: true },
  });

  return NextResponse.json({ data: partner }, { status: 201 });
});
