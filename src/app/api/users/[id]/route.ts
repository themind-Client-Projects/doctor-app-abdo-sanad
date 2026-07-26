import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

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
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  if ("role" in body) {
    return NextResponse.json(
      { error: "لا يمكن تغيير الدور من هذا المسار" },
      { status: 400 }
    );
  }

  const { name, email, phone, isActive, governorateId } = body;

  const data = await prisma.user.update({
    where: { id },
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      name: typeof name === "string" ? name : undefined,
      email: typeof email === "string" ? email.trim().toLowerCase() : undefined,
      phone: typeof phone === "string" ? phone : undefined,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
      governorateId: typeof governorateId === "string" ? governorateId : undefined,
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
