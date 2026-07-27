import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { paginationSchema, parseBody, parseQuery } from "@/lib/validation";

const userRole = z.enum([
  "SUPER_ADMIN",
  "OPERATIONS",
  "DOCTOR",
  "LAB",
  "PHARMACY",
  "NURSE",
  "DRIVER",
  "RADIOLOGY",
  "PATIENT",
]);

const listQuerySchema = paginationSchema.extend({
  role: userRole.optional(),
});

// `.strict()` so an unexpected key is a 400 rather than being silently ignored.
const createUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().min(6).optional(),
    role: userRole.default("PATIENT"),
    governorateId: z.string().trim().min(1).optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine((v) => Boolean(v.email || v.phone), {
    message: "البريد الإلكتروني أو رقم الهاتف مطلوب",
    path: ["email"],
  });

// GET /api/users — List users (req L265)
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const { page, pageSize, role } = parseQuery(req.nextUrl.searchParams, listQuerySchema);

  const where = role ? { role } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        image: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    data: users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

// POST /api/users — Create a user.
// Previously spread the raw body into prisma.user.create, so an anonymous
// caller could POST {"role":"SUPER_ADMIN"} and mint an admin.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const input = await parseBody(req, createUserSchema);

  const data = await prisma.user.create({
    data: {
      name: input.name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      role: input.role,
      governorateId: input.governorateId ?? null,
      isActive: input.isActive,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
