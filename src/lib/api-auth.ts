import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";
import { auth } from "./auth";
import { ErrorCode, fail } from "./api-response";
import { ValidationError } from "./validation";

/**
 * The authenticated caller, resolved once per request.
 *
 * Route handlers must never trust a role, userId or partnerId supplied by the
 * client (query string or body) — only this value, which is derived from a
 * verified session.
 */
export type Identity = {
  userId: string;
  role: UserRole;
  partnerId: string | null;
};

/** Thrown to reject a request. Caught by `withAuth` and turned into a response. */
export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Common role groups, so route files don't hand-roll (and mistype) arrays. */
export const ROLES = {
  ADMIN: ["SUPER_ADMIN"],
  OPERATIONS: ["SUPER_ADMIN", "OPERATIONS"],
  /** Any signed-in member of staff (i.e. everyone except patients). */
  STAFF: [
    "SUPER_ADMIN",
    "OPERATIONS",
    "DOCTOR",
    "LAB",
    "PHARMACY",
    "NURSE",
    "DRIVER",
    "RADIOLOGY",
  ],
  /** Staff who may read clinical records. */
  CLINICAL: [
    "SUPER_ADMIN",
    "OPERATIONS",
    "DOCTOR",
    "LAB",
    "PHARMACY",
    "NURSE",
    "RADIOLOGY",
  ],
} as const satisfies Record<string, readonly UserRole[]>;

/**
 * Resolve and authorise the caller.
 *
 * Currently reads the NextAuth cookie session. Bearer-token support for the
 * mobile client plugs in here (Step 5 of IMPLEMENTATION_PLAN.md) — deliberately
 * not stubbed, so there is no code path that accepts an unverified token.
 *
 * @throws {AuthError} 401 when unauthenticated, 403 when the role is not allowed.
 */
export async function requireAuth(
  _req: NextRequest,
  opts?: { roles?: readonly UserRole[] }
): Promise<Identity> {
  const session = await auth();
  const user = session?.user;

  // `id` is only set when the jwt callback resolved a real DB user. Guarding on
  // both fields keeps a malformed session from producing an identity whose
  // userId is undefined — which would make later `x === identity.userId`
  // ownership checks pass against null columns.
  if (!user?.id || !user.role) {
    throw new AuthError(401, "يجب تسجيل الدخول");
  }

  const identity: Identity = {
    userId: user.id,
    role: user.role,
    partnerId: user.partnerId ?? null,
  };

  if (opts?.roles && !opts.roles.includes(identity.role)) {
    throw new AuthError(403, "ليس لديك صلاحية للوصول إلى هذا المورد");
  }

  return identity;
}

/**
 * Wrap a route handler so it cannot run for an unauthenticated caller.
 *
 * Fails closed by construction: authorisation runs before the handler, and any
 * error escaping the handler becomes a 500 rather than leaking data. Errors are
 * logged with method + path, so failures stop being silently swallowed.
 *
 * @example
 * export const GET = withAuth({ roles: ROLES.ADMIN }, async (req, ctx, identity) => {
 *   const data = await prisma.user.findMany();
 *   return NextResponse.json({ data });
 * });
 */
export function withAuth<Ctx = unknown>(
  opts: { roles?: readonly UserRole[] },
  handler: (req: NextRequest, ctx: Ctx, identity: Identity) => Promise<Response>
) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    // One id per request, echoed on the response and included in every log
    // line, so "a user says it broke" becomes a single greppable key.
    const requestId = req.headers.get("x-request-id") ?? randomUUID();

    let identity: Identity;
    try {
      identity = await requireAuth(req, opts);
    } catch (error) {
      return withRequestId(toErrorResponse(req, error, requestId), requestId);
    }

    try {
      const res = await handler(req, ctx, identity);
      return withRequestId(res, requestId);
    } catch (error) {
      return withRequestId(toErrorResponse(req, error, requestId), requestId);
    }
  };
}

function withRequestId(res: Response, requestId: string): Response {
  res.headers.set("x-request-id", requestId);
  return res;
}

function toErrorResponse(req: NextRequest, error: unknown, requestId: string): NextResponse {
  if (error instanceof AuthError) {
    return fail(
      error.status === 401 ? ErrorCode.UNAUTHENTICATED : ErrorCode.FORBIDDEN,
      error.status,
      error.message,
      { requestId }
    );
  }

  // Validation failures are the caller's fault, not the server's. These used to
  // surface as 500s, so a client could not tell a bad request from an outage.
  if (error instanceof ValidationError) {
    const malformed = error.issues.some((i) => i.code === "malformed_json");
    return fail(
      malformed ? ErrorCode.MALFORMED_JSON : ErrorCode.VALIDATION_FAILED,
      400,
      "بيانات غير صالحة",
      { details: error.issues, requestId }
    );
  }

  // Prisma errors that are really client errors. Without this, GET /orders/{bad}
  // returned 404 while PATCH on the same id returned 500, so a mobile client
  // retrying on 5xx would retry a request that can never succeed.
  const code = (error as { code?: string } | null)?.code;
  if (code === "P2025") {
    return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
  }
  if (code === "P2002") {
    return fail(ErrorCode.DUPLICATE_RESOURCE, 409, "السجل موجود مسبقاً", { requestId });
  }
  if (code === "P2003") {
    return fail(ErrorCode.INVALID_REFERENCE, 409, "مرجع غير صالح", { requestId });
  }

  console.error(`[api] ${req.method} ${req.nextUrl.pathname} requestId=${requestId}`, error);
  return fail(ErrorCode.INTERNAL_ERROR, 500, "فشل", { requestId });
}

/**
 * Assert the caller owns a resource, or is staff acting on it.
 *
 * Use on every `[id]` route that returns per-user data — authentication alone
 * turns those routes from "public" into "any signed-in user", which for a
 * platform with self-service patient signup is barely an improvement.
 */
export function assertOwnerOrStaff(identity: Identity, ownerId: string | null): void {
  if (identity.role !== "PATIENT") return; // staff scoping is handled per-route
  if (!ownerId || ownerId !== identity.userId) {
    throw new AuthError(403, "ليس لديك صلاحية للوصول إلى هذا المورد");
  }
}

/** Assert the caller belongs to the partner that owns a resource. */
export function assertPartnerScope(identity: Identity, partnerId: string | null): void {
  if (identity.role === "SUPER_ADMIN" || identity.role === "OPERATIONS") return;
  if (!partnerId || partnerId !== identity.partnerId) {
    throw new AuthError(403, "ليس لديك صلاحية للوصول إلى هذا المورد");
  }
}
