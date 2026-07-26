import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

const VALID_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "DOCTOR",
  "LAB",
  "PHARMACY",
  "NURSE",
  "DRIVER",
  "RADIOLOGY",
  "PATIENT",
];

// GET /api/users — List users (req L265)
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const { searchParams } = req.nextUrl;
  const role = searchParams.get("role");

  // Clamp: pageSize was unbounded, so ?pageSize=1000000 dumped the table, and
  // a non-numeric ?page produced skip: NaN and a 500.
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20") || 20)
  );

  const where: Record<string, unknown> = {};
  if (role && VALID_ROLES.includes(role as UserRole)) where.role = role;

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
// Previously spread the raw body straight into prisma.user.create, so an
// anonymous caller could POST {"role":"SUPER_ADMIN"} and mint an admin.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { name, email, phone, role, governorateId, isActive } = body;

  if (typeof email !== "string" && typeof phone !== "string") {
    return NextResponse.json(
      { error: "البريد الإلكتروني أو رقم الهاتف مطلوب" },
      { status: 400 }
    );
  }
  if (role !== undefined && !VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: "دور غير صالح" }, { status: 400 });
  }

  const data = await prisma.user.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      name: typeof name === "string" ? name : null,
      email: typeof email === "string" ? email.trim().toLowerCase() : null,
      phone: typeof phone === "string" ? phone : null,
      role: (role as UserRole) ?? "PATIENT",
      governorateId: typeof governorateId === "string" ? governorateId : null,
      isActive: typeof isActive === "boolean" ? isActive : true,
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
