import { prisma } from "@/lib/prisma";

/**
 * Who is `patientId`?
 *
 * `Appointment.patientId` and `Prescription.patientId` are plain String columns
 * pointing at `User.id` — there is no Prisma relation to `include`, so a list of
 * either comes back carrying an opaque id and nothing else. The doctor's
 * appointment book rendered a table of times with no names on it, and a
 * prescription written outside an order had no patient at all on screen.
 *
 * One grouped query for the page, not one per row, and only ever for the rows
 * actually being returned — the caller has already scoped those.
 *
 * `null` rather than a placeholder when the account is gone: the screen decides
 * how to say "حساب محذوف", and inventing a name here would put a made-up
 * patient on a clinical record.
 */

export type PatientSummary = { id: string; name: string | null; phone: string | null };

export async function patientSummaries(
  patientIds: readonly string[]
): Promise<Map<string, PatientSummary>> {
  const unique = [...new Set(patientIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, phone: true },
  });

  return new Map(users.map((u) => [u.id, u]));
}

/** Attaches `patient` to every row, keyed by its `patientId`. */
export async function withPatients<T extends { patientId: string }>(
  rows: T[]
): Promise<(T & { patient: PatientSummary | null })[]> {
  const byId = await patientSummaries(rows.map((r) => r.patientId));
  return rows.map((row) => ({ ...row, patient: byId.get(row.patientId) ?? null }));
}
