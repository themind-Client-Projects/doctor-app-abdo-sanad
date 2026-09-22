import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { paginationSchema, parseBody, parseQuery } from "@/lib/validation";
import { normalizePhone } from "@/lib/phone";
import { canHavePassword, hashPassword, passwordSchema } from "@/server/services/user-admin";

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

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

/** Roles that exist only alongside a Partner record — created by onboarding. */
const PROVIDER_ROLES: readonly string[] = ["DOCTOR", "LAB", "PHARMACY", "NURSE", "DRIVER", "RADIOLOGY"];

// `cursor`/`limit` select keyset paging; `page`/`pageSize` stay for the existing
// dashboard screens. Not `.strict()` — an unknown query key is still ignored.
const listQuerySchema = paginationSchema.extend({
  role: z.preprocess(emptyToUndefined, userRole.optional()),
  /**
   * Name, email or phone. Server-side, because the screens load 100 rows and
   * searched those in the browser — so account 101 could not be found at all,
   * on a platform where every patient is an account.
   */
  q: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(80).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(["active", "inactive"]).optional()),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// `.strict()` so an unexpected key is a 400 rather than being silently ignored.
const createUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().email({ message: "البريد الإلكتروني غير صالح" }).optional(),
    phone: z.string().trim().min(6).optional(),
    role: userRole.default("PATIENT"),
    governorateId: z.string().trim().min(1).optional(),
    isActive: z.boolean().default(true),
    /**
     * The initial password, for staff.
     *
     * Without it an account created here could not sign in at all: the password
     * grant needs a hash, `PATCH` deliberately refuses to write one, and the
     * only other way to set one was a CLI script on the server.
     */
    password: passwordSchema.optional(),
  })
  .strict()
  .refine((v) => Boolean(v.email || v.phone), {
    message: "البريد الإلكتروني أو رقم الهاتف مطلوب",
    path: ["email"],
  });

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  image: true,
  governorateId: true,
  createdAt: true,
  // Whether the account CAN sign in with a password — never the hash itself.
  passwordHash: true,
  partner: { select: { id: true, name: true } },
} as const satisfies Prisma.UserSelect;

/** The hash leaves the server as a boolean, and never as itself. */
function present<T extends { passwordHash: string | null }>(row: T) {
  const { passwordHash, ...rest } = row;
  return { ...rest, hasPassword: passwordHash !== null };
}

// GET /api/users — List users (req L265)
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { page, pageSize, role, q, status, cursor, limit } = parseQuery(
    req.nextUrl.searchParams,
    listQuerySchema
  );

  const filters: Prisma.UserWhereInput[] = [
    // A deleted account is gone from the owner's point of view. It is kept in
    // the table only so its orders and records still resolve a name.
    { deletedAt: null },
  ];
  if (role) filters.push({ role });
  if (status) filters.push({ isActive: status === "active" });
  if (q) {
    // A phone is matched on its canonical digits too, so "0770 123 4567" finds
    // the row stored as 9647701234567.
    const canonical = normalizePhone(q);
    filters.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q.replace(/\D/g, "") || q } },
        ...(canonical ? [{ phone: canonical }] : []),
      ],
    });
  }
  const where: Prisma.UserWhereInput = { AND: filters };

  // Keyset paging — preferred. Offset paging over `createdAt desc` duplicates
  // and skips rows as new users are created between requests.
  if (cursor !== undefined || limit !== undefined) {
    const take = limit ?? 20;
    const keyset = keysetArgs(cursor, take);
    const cursorWhere = "where" in keyset ? keyset.where : undefined;

    const rows = await prisma.user.findMany({
      ...keyset,
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      select: USER_SELECT,
    });

    const { items, page: pageMeta } = toPage(rows, take);
    return okList(items.map(present), pageMeta, { requestId });
  }

  // Legacy offset mode — response shape unchanged for existing callers.
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: USER_SELECT,
    }),
    prisma.user.count({ where }),
  ]);

  return okList(
    users.map(present),
    { nextCursor: null, hasMore: page * pageSize < total, limit: pageSize },
    { requestId, legacy: { total, page, pageSize } }
  );
});

// POST /api/users — Create a user.
// Previously spread the raw body into prisma.user.create, so an anonymous
// caller could POST {"role":"SUPER_ADMIN"} and mint an admin.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createUserSchema);

  // Stored canonical, like every other write path. Raw, `07701234567` became a
  // row the OTP sign-in — which normalises — could never find, so the same
  // person's first login silently created a second account.
  let phone: string | null = null;
  if (input.phone) {
    phone = normalizePhone(input.phone);
    if (!phone) {
      return fail(ErrorCode.VALIDATION_FAILED, 400, "رقم الهاتف غير صالح", {
        requestId,
        details: [{ field: "phone", code: "invalid", message: "رقم الهاتف غير صالح" }],
      });
    }
  }

  // A provider account is half of a pair. `POST /api/partners/onboard` creates
  // the User, the Partner, its channels and its Wallet in one transaction; made
  // here, a DOCTOR would sign in to a dashboard that finds no partner behind
  // it, and its first settled order would fail for want of a wallet.
  if (PROVIDER_ROLES.includes(input.role)) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "حسابات الأطباء والمختبرات والصيدليات تُنشأ من صفحة الشركاء — تُنشئ الحساب وسجل الشريك معاً",
      { requestId }
    );
  }

  if (input.password && !canHavePassword(input.role)) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "المرضى يدخلون برمز الهاتف أو Google — لا تُعيَّن لهم كلمة مرور",
      { requestId }
    );
  }

  const passwordHash = input.password ? await hashPassword(input.password) : null;

  const [created] = await prisma.$transaction([
    prisma.user.create({
      data: {
        name: input.name ?? null,
        email: input.email ?? null,
        phone,
        role: input.role,
        governorateId: input.governorateId ?? null,
        isActive: input.isActive,
        passwordHash,
      },
      select: USER_SELECT,
    }),
    prisma.activityLog.create({
      data: {
        userId: identity.userId,
        action: `إنشاء حساب ${input.role}`,
        entityType: "user",
        // The new id is not known until the insert above commits; the details
        // carry enough to find the account from the log.
        details: {
          role: input.role,
          email: input.email ?? null,
          phone,
          withPassword: passwordHash !== null,
        },
      },
    }),
  ]);

  return ok(present(created), { status: 201, requestId });
});
