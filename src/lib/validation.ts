import { z } from "zod";

/**
 * Thrown when a request body or query fails validation.
 * `withAuth` converts this into a 400 with field-level detail.
 */
export class ValidationError extends Error {
  constructor(readonly issues: { field: string; code: string; message: string }[]) {
    super("Validation failed");
    this.name = "ValidationError";
  }
}

function toIssues(error: z.ZodError): { field: string; code: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    code: issue.code,
    message: issue.message,
  }));
}

/**
 * Parse and validate a JSON request body.
 *
 * Also turns malformed JSON into a 400 instead of a 500 — 42 of 44 `req.json()`
 * calls were previously unguarded, so a truncated body on a flaky mobile
 * connection was reported as a server crash.
 *
 * @throws {ValidationError}
 */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S
): Promise<z.infer<S>> {
  const raw = await req.json().catch(() => MALFORMED);
  if (raw === MALFORMED) {
    throw new ValidationError([
      { field: "(root)", code: "malformed_json", message: "صيغة الطلب غير صالحة" },
    ]);
  }

  const result = schema.safeParse(raw);
  if (!result.success) throw new ValidationError(toIssues(result.error));
  return result.data;
}

/** Parse and validate query-string params. @throws {ValidationError} */
export function parseQuery<S extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: S
): z.infer<S> {
  const result = schema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!result.success) throw new ValidationError(toIssues(result.error));
  return result.data;
}

const MALFORMED = Symbol("malformed-json");

/* ------------------------------- primitives ------------------------------- */

/** Cursor-free page/pageSize, clamped so ?pageSize=1000000 can't dump a table. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
});

/** A non-empty trimmed string. */
export const nonEmpty = z.string().trim().min(1);

/** An optional cuid-ish id. */
export const optionalId = z.string().trim().min(1).optional();

/** Money: a finite, non-negative number. */
export const amount = z.number().finite().nonnegative();

/** A percentage share, 0–100. */
export const percentage = z.number().finite().min(0).max(100);

/** An ISO date string or timestamp, coerced to Date. */
export const dateish = z.coerce.date();

/** Arbitrary JSON payload for Prisma `Json` columns. */
export const jsonValue: z.ZodType<unknown> = z.unknown();

/**
 * The single service vocabulary, mirroring the `ServiceType` enum in
 * prisma/schema.prisma.
 *
 * Order, CommissionRule, ServiceConfig and PriceConfig previously each used
 * their own incompatible strings, so pricing and commission lookups matched
 * zero rows. Import this everywhere rather than re-declaring the list.
 */
export const serviceTypeSchema = z.enum([
  "IN_PERSON_CONSULT",
  "ONLINE_CONSULT",
  "HOME_VISIT",
  "HOME_BLOOD_DRAW",
  "HOME_LAB_TEST",
  "LAB_TEST",
  "RADIOLOGY",
  "PHARMACY_DISPENSE",
  "MEDICINE_DELIVERY",
  "NURSING",
  "PHYSIOTHERAPY",
  "SURGERY",
  "BLOOD_BANK",
  "TAXI",
]);

/** Serialise a Prisma Decimal (or number/null) to a JSON number. */
export function decimalToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}
