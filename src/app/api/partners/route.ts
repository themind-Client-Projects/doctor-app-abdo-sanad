import { NextResponse } from "next/server";
import type { PartnerStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

const PARTNER_TYPES: readonly UserRole[] = [
  "DOCTOR",
  "LAB",
  "PHARMACY",
  "NURSE",
  "DRIVER",
  "RADIOLOGY",
];

const PARTNER_STATUSES: readonly PartnerStatus[] = [
  "ACTIVE",
  "SUSPENDED",
  "PENDING",
  "PAUSED",
];

// GET /api/partners — List all partners (req L128-182).
// Dispatch (OPERATIONS) needs to read partners to assign orders.
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const status = searchParams.get("status");

  // Clamp: pageSize was unbounded and a non-numeric ?page produced skip: NaN.
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20") || 20)
  );

  const where: Record<string, unknown> = {};
  if (type && PARTNER_TYPES.includes(type as UserRole)) where.type = type;
  if (status && PARTNER_STATUSES.includes(status as PartnerStatus)) where.status = status;

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
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { userId, type, name, phone, email, governorateId, address, status, isSanadLinked, complexId } =
    body;

  if (typeof userId !== "string" || typeof name !== "string" || typeof phone !== "string") {
    return NextResponse.json(
      { error: "المستخدم والاسم ورقم الهاتف مطلوبة" },
      { status: 400 }
    );
  }
  if (typeof type !== "string" || !PARTNER_TYPES.includes(type as UserRole)) {
    return NextResponse.json({ error: "نوع الشريك غير صالح" }, { status: 400 });
  }
  if (status !== undefined && !PARTNER_STATUSES.includes(status as PartnerStatus)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }

  const partner = await prisma.partner.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      userId,
      type: type as UserRole,
      name,
      phone,
      email: typeof email === "string" ? email : null,
      governorateId: typeof governorateId === "string" ? governorateId : null,
      address: typeof address === "string" ? address : null,
      status: (status as PartnerStatus) ?? "PENDING",
      isSanadLinked: typeof isSanadLinked === "boolean" ? isSanadLinked : false,
      complexId: typeof complexId === "string" ? complexId : null,
      wallet: { create: {} }, // Auto-create wallet
    },
    include: { wallet: true },
  });

  return NextResponse.json({ data: partner }, { status: 201 });
});
