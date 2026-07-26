import { NextResponse } from "next/server";
import type { OrderSource, OrderStatus, PaymentMethod, Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

const ORDER_STATUSES: readonly OrderStatus[] = [
  "NEW",
  "ACCEPTED",
  "ASSIGNED",
  "IN_TRANSIT",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "DELAYED",
];
const PRIORITIES: readonly Priority[] = ["NORMAL", "URGENT", "CRITICAL"];
const SOURCES: readonly OrderSource[] = ["COMPLEX", "SANAD", "DIRECT"];
const PAYMENT_METHODS: readonly PaymentMethod[] = ["CASH", "CARD", "WALLET"];

// GET /api/orders — List orders with filters
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const { searchParams } = req.nextUrl;

  // Clamp: an unbounded pageSize dumped the whole table, and a non-numeric
  // ?page produced skip: NaN and a 500.
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20") || 20)
  );

  const where: Record<string, unknown> = {};

  // `?status=` used to go straight into a Prisma enum filter, so ?status=foo
  // threw a 500. The operations tracking page also sends several statuses as
  // ONE comma-separated string, which is why that page was permanently empty.
  const statusParam = searchParams.get("status");
  if (statusParam) {
    const values = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      values.length === 0 ||
      values.some((v) => !ORDER_STATUSES.includes(v as OrderStatus))
    ) {
      return NextResponse.json({ error: "حالة طلب غير صالحة" }, { status: 400 });
    }
    where.status = values.length === 1 ? values[0] : { in: values };
  }

  const priority = searchParams.get("priority");
  if (priority) {
    if (!PRIORITIES.includes(priority as Priority)) {
      return NextResponse.json({ error: "أولوية غير صالحة" }, { status: 400 });
    }
    where.priority = priority;
  }

  // serviceType is a free-text column, so it needs no enum validation.
  const serviceType = searchParams.get("serviceType");
  if (serviceType) where.serviceType = serviceType;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        governorate: { select: { name: true } },
        timeline: { orderBy: { step: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({
    data: orders,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

// POST /api/orders — Create a new order.
// Explicit allow-list: the body used to be read field by field but with no
// validation, so a missing patientId produced a Prisma crash rather than a 400,
// and an arbitrary string could be written into an enum column.
export const POST = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { patientId, patientName, patientPhone, serviceType } = body;
  if (
    typeof patientId !== "string" ||
    !patientId ||
    typeof patientName !== "string" ||
    !patientName ||
    typeof patientPhone !== "string" ||
    !patientPhone ||
    typeof serviceType !== "string" ||
    !serviceType
  ) {
    return NextResponse.json(
      { error: "بيانات المريض ونوع الخدمة مطلوبة" },
      { status: 400 }
    );
  }

  const { priority, source, paymentMethod } = body;
  if (priority !== undefined && !PRIORITIES.includes(priority as Priority)) {
    return NextResponse.json({ error: "أولوية غير صالحة" }, { status: 400 });
  }
  if (source !== undefined && !SOURCES.includes(source as OrderSource)) {
    return NextResponse.json({ error: "مصدر الطلب غير صالح" }, { status: 400 });
  }
  if (
    paymentMethod !== undefined &&
    !PAYMENT_METHODS.includes(paymentMethod as PaymentMethod)
  ) {
    return NextResponse.json({ error: "طريقة الدفع غير صالحة" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" && v ? v : null);

  const order = await prisma.order.create({
    data: {
      patientId,
      patientName,
      patientPhone,
      serviceType,
      priority: (priority as Priority) ?? "NORMAL",
      source: (source as OrderSource) ?? "DIRECT",
      governorateId: str(body.governorateId),
      area: str(body.area),
      address: str(body.address),
      paymentMethod: (paymentMethod as PaymentMethod) ?? "CASH",
      notes: str(body.notes),
      timeline: {
        create: {
          step: 1,
          title: "تم إنشاء الطلب",
          completedAt: new Date(),
        },
      },
    },
    include: { timeline: true },
  });

  return NextResponse.json({ data: order }, { status: 201 });
});
