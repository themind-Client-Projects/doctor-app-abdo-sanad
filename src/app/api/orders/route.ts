import { NextResponse } from "next/server";
import { z } from "zod";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { nonEmpty, paginationSchema, parseBody, parseQuery, serviceTypeSchema } from "@/lib/validation";

const orderStatus = z.enum(
  [
    "NEW",
    "ACCEPTED",
    "ASSIGNED",
    "IN_TRANSIT",
    "ARRIVED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "DELAYED",
  ],
  { message: "حالة طلب غير صالحة" }
);
const orderPriority = z.enum(["NORMAL", "URGENT", "CRITICAL"], {
  message: "أولوية غير صالحة",
});
const orderSource = z.enum(["COMPLEX", "SANAD", "DIRECT"], {
  message: "مصدر الطلب غير صالح",
});
const orderPaymentMethod = z.enum(["CASH", "CARD", "WALLET"], {
  message: "طريقة الدفع غير صالحة",
});

/** `?status=` with no value means "no filter", as it did before. */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

/**
 * `?status=` used to go straight into a Prisma enum filter, so ?status=foo threw
 * a 500. The operations tracking page also sends several statuses as ONE
 * comma-separated string, which is why that page was permanently empty.
 */
const statusFilter = z
  .string()
  .transform((raw) =>
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  )
  .refine(
    (values) =>
      values.length > 0 && values.every((value) => orderStatus.safeParse(value).success),
    { message: "حالة طلب غير صالحة" }
  )
  .transform((values) => values as OrderStatus[]);

const listQuerySchema = paginationSchema.extend({
  status: z.preprocess(emptyToUndefined, statusFilter.optional()),
  priority: z.preprocess(emptyToUndefined, orderPriority.optional()),
  serviceType: z.preprocess(emptyToUndefined, serviceTypeSchema.optional()),
});

const patientDetail = z
  .string({ message: "بيانات المريض ونوع الخدمة مطلوبة" })
  .trim()
  .min(1, { message: "بيانات المريض ونوع الخدمة مطلوبة" });

// `.strict()` so an unexpected key is a 400 rather than being silently ignored —
// the body used to be read field by field but with no validation, so a missing
// patientId produced a Prisma crash rather than a 400, and an arbitrary string
// could be written into an enum column.
const createOrderSchema = z
  .object({
    patientId: patientDetail,
    patientName: patientDetail,
    patientPhone: patientDetail,
    serviceType: serviceTypeSchema,
    priority: orderPriority.default("NORMAL"),
    source: orderSource.default("DIRECT"),
    governorateId: nonEmpty.optional(),
    area: nonEmpty.optional(),
    address: nonEmpty.optional(),
    paymentMethod: orderPaymentMethod.default("CASH"),
    notes: nonEmpty.optional(),
  })
  .strict();

// GET /api/orders — List orders with filters
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  // Clamped by `paginationSchema`: an unbounded pageSize dumped the whole table,
  // and a non-numeric ?page produced skip: NaN and a 500.
  const { page, pageSize, status, priority, serviceType } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status.length === 1 ? status[0] : { in: status };
  if (priority) where.priority = priority;
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
export const POST = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const input = await parseBody(req, createOrderSchema);

  const order = await prisma.order.create({
    data: {
      patientId: input.patientId,
      patientName: input.patientName,
      patientPhone: input.patientPhone,
      serviceType: input.serviceType,
      priority: input.priority,
      source: input.source,
      governorateId: input.governorateId ?? null,
      area: input.area ?? null,
      address: input.address ?? null,
      paymentMethod: input.paymentMethod,
      notes: input.notes ?? null,
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
