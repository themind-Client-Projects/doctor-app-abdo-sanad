import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// `role` is deliberately absent: with `.strict()` a `role` key is an
// unrecognised key and therefore a 400, rather than being silently dropped.
const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().min(6).optional(),
    isActive: z.boolean().optional(),
    governorateId: z.string().trim().min(1).optional(),
  })
  .strict();

// GET /api/users/[id] — Read a single user.
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  const data = await prisma.user.findUnique({
    where: { id },
    include: { partner: true, governorate: true },
  });
  if (!data) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json({ data });
});

// PATCH /api/users/[id] — Update a user's profile fields.
//
// The body used to be spread straight into prisma.user.update, so a caller could
// PATCH {"role":"SUPER_ADMIN"} (or overwrite passwordHash) on any account.
// Only the profile fields below are writable here; role changes are out of scope
// for this endpoint and are rejected outright rather than silently dropped.
export const PATCH = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const input = await parseBody(req, updateUserSchema);

  const data = await prisma.user.update({
    where: { id },
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      isActive: input.isActive,
      governorateId: input.governorateId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      governorateId: true,
    },
  });

  return NextResponse.json({ data });
});

// DELETE /api/users/[id]
export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ message: "تم الحذف" });
});
