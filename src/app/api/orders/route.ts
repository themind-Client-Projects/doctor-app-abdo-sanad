import { z } from "zod";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { orderScopeFor } from "@/lib/order-slots";
import { ErrorCode, fail, keysetArgs, ok, okList, toPage } from "@/lib/api-response";
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

// `cursor`/`limit` select keyset paging; `page`/`pageSize` stay for the existing
// dashboard screens. Not `.strict()` — an unknown query key is still ignored.
const listQuerySchema = paginationSchema.extend({
  status: z.preprocess(emptyToUndefined, statusFilter.optional()),
  priority: z.preprocess(emptyToUndefined, orderPriority.optional()),
  serviceType: z.preprocess(emptyToUndefined, serviceTypeSchema.optional()),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
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
export const GET = withAuth({ roles: ROLES.STAFF }, async (req, _ctx, identity) => {
  // Clamped by `paginationSchema`: an unbounded pageSize dumped the whole table,
  // and a non-numeric ?page produced skip: NaN and a 500.
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { page, pageSize, status, priority, serviceType, cursor, limit } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  // Scoped to the caller, ALWAYS.
  //
  // This was OPERATIONS-only, which is why the partner dashboard had no way to
  // read a nurse's visits or a driver's trips and its pages pointed at
  // `/api/dashboard/*` routes that were never built. Opening it to staff is only
  // safe because the scope is applied here rather than trusted from a query
  // parameter: a partner sees the orders in THEIR assignment column and no
  // others, and a partner row that is missing matches nothing.
  const where: Prisma.OrderWhereInput = { ...orderScopeFor(identity) };
  if (status) where.status = status.length === 1 ? status[0] : { in: status };
  if (priority) where.priority = priority;
  if (serviceType) where.serviceType = serviceType;

  const include = {
    governorate: { select: { name: true } },
    timeline: { orderBy: { step: "asc" } },
  } as const;

  // Keyset paging — preferred. Offset paging over `createdAt desc` duplicates
  // and skips rows as new orders arrive between requests.
  if (cursor !== undefined || limit !== undefined) {
    const take = limit ?? 20;
    const keyset = keysetArgs(cursor, take);
    const cursorWhere = "where" in keyset ? keyset.where : undefined;

    const rows = await prisma.order.findMany({
      ...keyset,
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      include,
    });

    const { items, page: pageMeta } = toPage(rows, take);
    return okList(items, pageMeta, { requestId });
  }

  // Legacy offset mode — response shape unchanged for existing callers.
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return okList(
    orders,
    { nextCursor: null, hasMore: page * pageSize < total, limit: pageSize },
    { requestId, legacy: { total, page, pageSize } }
  );
});

// POST /api/orders — Create a new order.
export const POST = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createOrderSchema);

  // `Order.patientId` is a plain column — Prisma declares no relation to User,
  // so the database will accept any string here. An order pinned to an id that
  // is not a real patient is invisible to the person it belongs to: their
  // bookings list, their medical file and the call-contacts lookup all resolve
  // by this id and find nothing. Nothing else in the system reports it either;
  // the row simply sits there looking valid.
  const patient = await prisma.user.findUnique({
    where: { id: input.patientId },
    select: { id: true, isActive: true },
  });
  if (!patient) {
    return fail(ErrorCode.NOT_FOUND, 404, "المريض غير موجود", { requestId });
  }
  if (!patient.isActive) {
    return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, "حساب المريض معطّل", { requestId });
  }

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

  return ok(order, { status: 201, requestId });
});
