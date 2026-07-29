import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

/**
 * Convert Prisma `Decimal` values to plain numbers, recursively.
 *
 * Money columns are `Decimal(18,3)` for exactness in the database, but a
 * Decimal serializes to JSON as a STRING. That silently broke arithmetic in
 * the client — `total + wallet.balance` concatenated instead of adding, and
 * `.toLocaleString("ar-IQ")` on a string returned it verbatim with Latin
 * digits. Normalising here fixes every endpoint at once rather than asking
 * each caller to remember `Number(...)`.
 */
function serializeDecimals<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Prisma.Decimal.isDecimal(value)) return Number(value) as unknown as T;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serializeDecimals) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeDecimals(v);
    }
    return out as T;
  }
  return value;
}

/**
 * The API's response contract.
 *
 * Before this, 77 endpoints returned the bare string `{"error":"فشل"}`, so a
 * client could not distinguish "not found" from "database down" — and could
 * not localise anything, because the Arabic message WAS the contract.
 *
 * Errors are a superset of the old shape: `error` stays a human-readable
 * string so the existing web app keeps working, and `code` is added as the
 * stable, machine-readable identifier that clients should branch on.
 * The fully nested `{error:{code,message}}` shape lands in /api/v1, where no
 * client is frozen against it yet.
 */

/** Stable, machine-readable error identifiers. Clients branch on these only. */
export const ErrorCode = {
  // 400
  MALFORMED_JSON: "MALFORMED_JSON",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_QUERY_PARAM: "INVALID_QUERY_PARAM",
  // 401 / 403
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  // 404
  NOT_FOUND: "NOT_FOUND",
  // 409
  DUPLICATE_RESOURCE: "DUPLICATE_RESOURCE",
  INVALID_REFERENCE: "INVALID_REFERENCE",
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
  // 422
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  // 429
  RATE_LIMITED: "RATE_LIMITED",
  // 5xx
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export type ValidationIssue = { field: string; code: string; message: string };

/** Cursor pagination metadata. */
export type PageMeta = {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  /** Only present when explicitly requested — COUNT(*) is a sequential scan. */
  total?: number;
};

/** Success — a single resource. */
export function ok<T>(
  data: T,
  init?: { status?: number; requestId?: string; meta?: Record<string, unknown> }
): NextResponse {
  return NextResponse.json(
    {
      data: serializeDecimals(data),
      meta: { requestId: init?.requestId, ...init?.meta },
    },
    { status: init?.status ?? 200 }
  );
}

/**
 * Success — a collection.
 *
 * Keeps the legacy flat `total`/`page`/`pageSize` keys alongside `meta.page`
 * so existing dashboard screens keep rendering while clients migrate.
 */
export function okList<T>(
  data: T[],
  page: PageMeta,
  init?: {
    requestId?: string;
    legacy?: { total: number; page: number; pageSize: number };
    /** Domain aggregate over the *filtered* set, not just the page — e.g. the
     *  rating distribution behind a list of feedback. Lives in `meta` so the
     *  `{data, meta}` envelope stays uniform across every endpoint. */
    summary?: Record<string, unknown>;
  }
): NextResponse {
  return NextResponse.json({
    data: serializeDecimals(data),
    meta: {
      requestId: init?.requestId,
      page,
      ...(init?.summary ? { summary: serializeDecimals(init.summary) } : {}),
    },
    ...(init?.legacy
      ? {
          total: init.legacy.total,
          page: init.legacy.page,
          pageSize: init.legacy.pageSize,
          totalPages: Math.ceil(init.legacy.total / init.legacy.pageSize),
        }
      : {}),
  });
}

/** Failure. `message` is for humans and logs; `code` is what clients branch on. */
export function fail(
  code: ErrorCodeValue,
  status: number,
  message: string,
  init?: { details?: ValidationIssue[]; requestId?: string }
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      ...(init?.details?.length ? { details: init.details } : {}),
      requestId: init?.requestId,
    },
    { status }
  );
}

/* ----------------------------- cursor paging ----------------------------- */

/**
 * Opaque cursor over `(createdAt, id)`.
 *
 * Offset paging is unstable here: every list is ordered by `createdAt desc`, so
 * a row inserted between page 1 and page 2 shifts everything down — the client
 * sees a duplicate and silently misses a record.
 */
export function encodeCursor(value: { createdAt: Date; id: string }): string {
  return Buffer.from(`${value.createdAt.toISOString()}|${value.id}`).toString("base64url");
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/**
 * Build the Prisma args for a keyset page, plus the resulting page metadata.
 *
 * Fetches `limit + 1` rows to determine `hasMore` without a second query.
 */
export function keysetArgs(cursor: string | undefined, limit: number) {
  const decoded = cursor ? decodeCursor(cursor) : null;
  return {
    take: limit + 1,
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    ...(decoded
      ? {
          where: {
            OR: [
              { createdAt: { lt: decoded.createdAt } },
              { createdAt: decoded.createdAt, id: { lt: decoded.id } },
            ],
          },
        }
      : {}),
  };
}

/** Trim the extra row fetched by `keysetArgs` and derive the page metadata. */
export function toPage<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number
): { items: T[]; page: PageMeta } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    page: {
      nextCursor: hasMore && last ? encodeCursor(last) : null,
      hasMore,
      limit,
    },
  };
}
