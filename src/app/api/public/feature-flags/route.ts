import { prisma } from "@/lib/prisma";
import { withPublic } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

/**
 * GET /api/public/feature-flags — which optional features the patient app may
 * show right now.
 *
 * Public because the patient app is public and has to know before it renders:
 * a button for a suspended feature is worse than no button, since tapping it
 * produces a failure the user cannot explain.
 *
 * Returned as a keyed object rather than a list, so a client reads
 * `flags["taxi.nursing_addon"]?.enabled` without scanning an array. Only the
 * state is exposed — the admin's label, description and grouping are internal.
 */
export const GET = withPublic(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const rows = await prisma.featureFlag.findMany({
    select: { key: true, isEnabled: true, numericValue: true },
  });

  const flags = Object.fromEntries(
    rows.map((f) => [f.key, { enabled: f.isEnabled, value: f.numericValue }])
  );

  return ok(flags, { requestId });
});
