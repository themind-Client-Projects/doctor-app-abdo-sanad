import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";
import { auth } from "./auth";
import { ErrorCode, fail } from "./api-response";
import { ValidationError } from "./validation";
import { verifyAccessToken } from "./tokens";
import { isPlatformRole } from "./roles";

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
  /** DoctorProfile.id. Doctor-owned rows FK to this, not to partnerId. */
  doctorProfileId: string | null;
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
 * Accepts EITHER an `Authorization: Bearer <access token>` (mobile) or the
 * NextAuth cookie session (web). Bearer is checked first so a native client
 * never depends on cookies.
 *
 * @throws {AuthError} 401 when unauthenticated, 403 when the role is not allowed.
 */
export async function requireAuth(
  req: NextRequest,
  opts?: { roles?: readonly UserRole[] }
): Promise<Identity> {
  // If an Authorization header is present, its verdict is FINAL — never fall
  // through to the cookie.
  //
  // Falling through meant an expired or tampered bearer silently executed as
  // whoever the cookie was. In any context holding both (a WebView client, an
  // internal tool), a stale patient token would run with an admin's cookie
  // authority, and the audit trail and the client would disagree about who
  // acted. It also meant a mobile client got 200s instead of 401s and never
  // learned to refresh — which becomes acute right after a secret rotation,
  // when every outstanding token is invalid at once.
  const header = req.headers.get("authorization");
  if (header) {
    const bearer = await identityFromBearer(req);
    if (!bearer) {
      throw new AuthError(401, "انتهت صلاحية الجلسة، يرجى تحديث الدخول");
    }
    if (opts?.roles && !opts.roles.includes(bearer.role)) {
      throw new AuthError(403, "ليس لديك صلاحية للوصول إلى هذا المورد");
    }
    return bearer;
  }

  const identity = await identityFromSession();

  if (!identity) {
    throw new AuthError(401, "يجب تسجيل الدخول");
  }

  if (opts?.roles && !opts.roles.includes(identity.role)) {
    throw new AuthError(403, "ليس لديك صلاحية للوصول إلى هذا المورد");
  }

  return identity;
}

/**
 * Mobile clients: `Authorization: Bearer <access token>`.
 *
 * Checked before the cookie session so a native app never depends on cookies.
 * A malformed or expired token yields null rather than throwing, so the caller
 * falls through to the cookie path and ultimately gets a clean 401.
 */
async function identityFromBearer(req: NextRequest): Promise<Identity | null> {
  const header = req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;

  const claims = await verifyAccessToken(header.slice(7).trim());
  if (!claims) return null;

  return {
    userId: claims.sub,
    role: claims.role,
    partnerId: claims.partnerId,
    doctorProfileId: claims.doctorProfileId,
  };
}

/** Web clients: the NextAuth cookie session. */
async function identityFromSession(): Promise<Identity | null> {
  const session = await auth();
  const user = session?.user;

  // `id` is only set when the jwt callback resolved a real DB user. Guarding on
  // both fields keeps a malformed session from producing an identity whose
  // userId is undefined — which would make later `x === identity.userId`
  // ownership checks pass against null columns.
  if (!user?.id || !user.role) return null;

  return {
    userId: user.id,
    role: user.role,
    partnerId: user.partnerId ?? null,
    doctorProfileId: user.doctorProfileId ?? null,
  };
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

/**
 * Wrap a route handler that is deliberately readable by anyone.
 *
 * The patient app browses before it signs in — `src/proxy.ts` guards only
 * `/dashboard`, `/admin` and `/operations`, so the doctor directory, the
 * specialty list, the promo banners and the subscription plans are all rendered
 * to visitors with no session. Those pages had no endpoint they could call:
 * every `/api/v1` route goes through `withAuth({})`, which still 401s an
 * anonymous caller. So the frontend shipped its catalogue as hardcoded arrays.
 *
 * This is the honest fix, and it is deliberately NOT "just drop withAuth":
 *  - it keeps the request id, the error mapping and the logging identical, so a
 *    public route fails the same way an authenticated one does;
 *  - `mutating: false` is enforced here, not by convention — a public route
 *    that writes is a hole, and this makes it impossible to open by accident;
 *  - it is greppable, and `scripts/check-route-auth.ts` accepts it by name, so
 *    every public route is a deliberate, reviewable decision rather than a
 *    missing wrapper nobody noticed.
 *
 * Only ever use it for catalogue data a visitor is meant to browse. Anything
 * keyed to a person — orders, records, wallets — takes `withAuth`.
 */
export function withPublic<Ctx = unknown>(
  handler: (req: NextRequest, ctx: Ctx) => Promise<Response>
) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();

    // A public write is never intended. Blocking it here means a future PATCH
    // added to a public route file is a 405 rather than an unauthenticated
    // mutation.
    if (req.method !== "GET" && req.method !== "HEAD") {
      return withRequestId(
        fail(ErrorCode.FORBIDDEN, 405, "هذه الواجهة للقراءة فقط", { requestId }),
        requestId
      );
    }

    try {
      return withRequestId(await handler(req, ctx), requestId);
    } catch (error) {
      return withRequestId(toErrorResponse(req, error, requestId), requestId);
    }
  };
}

/**
 * Wrap a read-only route that behaves differently for a signed-in caller but
 * must still answer a visitor.
 *
 * The patient app is browsable before sign-in, so "who am I?" cannot 401: an
 * anonymous visitor is a NORMAL outcome there, not an error. `withAuth` would
 * reject them, and `withPublic` cannot see an identity at all — hence a fourth
 * wrapper rather than bending either.
 *
 * Read-only for the same reason `withPublic` is: a mutation whose authorisation
 * depends on an identity that may be null has no business being reachable.
 * Anything that writes takes `withAuth`.
 */
export function withMaybeAuth<Ctx = unknown>(
  handler: (req: NextRequest, ctx: Ctx, identity: Identity | null) => Promise<Response>
) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();

    if (req.method !== "GET" && req.method !== "HEAD") {
      return withRequestId(
        fail(ErrorCode.FORBIDDEN, 405, "هذه الواجهة للقراءة فقط", { requestId }),
        requestId
      );
    }

    // ANY failure to resolve a session degrades to anonymous, not just an
    // AuthError.
    //
    // This wrapper's contract is "tell me who this is, if you can" on a
    // read-only route, so a caller that cannot be identified is answered as a
    // visitor. Re-throwing instead would turn a hiccup in session resolution
    // into a 500 on a page a visitor is entitled to see — the header would fail
    // the whole screen rather than quietly hiding a wallet chip.
    //
    // Safe because identity here only ever ADDS to a response: null grants
    // nothing, so degrading can never widen access. The unexpected case is
    // still logged rather than swallowed silently.
    let identity: Identity | null = null;
    try {
      identity = await requireAuth(req);
    } catch (error) {
      if (!(error instanceof AuthError)) {
        console.warn(
          `[maybe-auth] ${req.nextUrl.pathname} could not resolve a session requestId=${requestId}`,
          error
        );
      }
    }

    try {
      return withRequestId(await handler(req, ctx, identity), requestId);
    } catch (error) {
      return withRequestId(toErrorResponse(req, error, requestId), requestId);
    }
  };
}

/**
 * Wrap an inbound webhook from a third party.
 *
 * Distinct from `withPublic`, which is read-only by construction: a webhook is
 * an unauthenticated WRITE, and pretending otherwise would either block it
 * (405) or quietly weaken `withPublic` for everything else.
 *
 * There is no session to check, so the handler carries the burden instead, and
 * both halves are mandatory:
 *   1. verify the signature over the RAW body, and
 *   2. confirm the claim against the sender's own API before acting on it.
 *
 * A webhook body is input from anyone who can reach the URL. Treating it as
 * fact is how a forged POST becomes a credited wallet.
 */
export function withWebhook<Ctx = unknown>(
  handler: (req: NextRequest, ctx: Ctx) => Promise<Response>
) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    try {
      return withRequestId(await handler(req, ctx), requestId);
    } catch (error) {
      // Logged with the path, because a webhook failure is invisible otherwise
      // — the sender sees a 500 and retries, and nobody here is watching.
      console.error(`[webhook] ${req.method} ${req.nextUrl.pathname} requestId=${requestId}`, error);
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

// `isPlatformRole` moved to `./roles`, which carries no NextAuth import, so a
// scoping rule can be tested without booting an auth runtime. Re-exported here
// because eighteen files already import it from this module.
export { isPlatformRole };

/**
 * A `where` fragment that limits a query to the caller's own partner.
 *
 * Authenticating the routes stopped anonymous access, but left every clinical
 * list readable across tenants — one lab could read, and PATCH, another lab's
 * samples. The tenant column was only ever an optional *filter*.
 *
 * Fails closed: a partner-scoped role with no Partner row matches nothing
 * rather than everything.
 *
 * @example  where: { ...partnerScope(identity, "labId"), status: "testing" }
 */
export function partnerScope(
  identity: Identity,
  field: "labId" | "pharmacyId" | "centerId" | "doctorId" | "partnerId"
): Record<string, string> {
  if (isPlatformRole(identity.role)) return {};
  return { [field]: identity.partnerId ?? "" };
}

/**
 * Limit an appointment query to what this caller is party to.
 *
 * An appointment is a consultation between a patient and a DOCTOR. The parties
 * are those two, plus the platform roles who dispatch. It is not
 * `partnerScope`: `Appointment.doctorId` references `DoctorProfile.id`, not
 * `Partner.id`, so scoping on `partnerId` would match nothing and read to the
 * doctor as "you have no appointments".
 *
 * `/api/appointments/today` already did this. The list and detail routes did
 * not, so any clinical role could page the whole platform's appointment book —
 * every patient's name, notes and doctor — and a doctor could read another
 * doctor's by passing their id. Sharing the fragment is what stops the three
 * from disagreeing again.
 *
 * Fails closed: anyone who is neither a patient, a doctor with a profile, nor a
 * platform role matches nothing.
 */
export function appointmentScope(identity: Identity): Record<string, string> {
  if (isPlatformRole(identity.role)) return {};
  if (identity.role === "PATIENT") return { patientId: identity.userId };
  return { doctorId: identity.doctorProfileId ?? "" };
}

/**
 * Who may touch an appointment at all.
 *
 * `ROLES.CLINICAL` was used, which includes LAB, PHARMACY and RADIOLOGY —
 * none of whom are a party to a consultation. Same correction already made on
 * `/api/prescriptions`, which concerns only its doctor and its pharmacy.
 */
export const APPOINTMENT_ROLES = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "DOCTOR",
  "PATIENT",
] as const satisfies readonly UserRole[];
