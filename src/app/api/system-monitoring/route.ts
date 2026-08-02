import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

/**
 * GET /api/system-monitoring — مراقبة النظام (req L247-254).
 *
 * What changed: every counter used to be a hardcoded zero and `lastBackup` was
 * `new Date()`, so the dashboard reported a healthy, just-completed backup on
 * every single call whether or not one had ever run. A fabricated green light
 * is worse than a missing one — nobody investigates a system that says it is
 * fine.
 *
 * So metrics we genuinely measure are returned, and metrics we do not are
 * returned as `null` with `measured: false` for the screen to label honestly.
 * Wire each one up as the infrastructure to observe it appears.
 */
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const startedAt = Date.now();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // These three ARE real: they come from tables we own.
  const [activeSessions, recentActivity, errorsLogged] = await Promise.all([
    // A live session is a non-expired one. Genuinely knowable.
    prisma.session.count({ where: { expires: { gt: new Date() } } }),
    prisma.activityLog.count({ where: { createdAt: { gte: since } } }),
    // No error table exists yet — failures go to the server log, not the DB.
    Promise.resolve(null as number | null),
  ]);

  // Measured last, so it covers the queries above rather than an empty block.
  const dbLatencyMs = Date.now() - startedAt;

  return ok(
    {
      // ── measured ──────────────────────────────────────────────────────
      dbLatencyMs: { value: dbLatencyMs, measured: true },
      activeSessions: { value: activeSessions, measured: true },
      activityLast24h: { value: recentActivity, measured: true },

      // ── not measured — reported as such rather than as zero ────────────
      // A zero here reads as "no errors", which is a claim we cannot make.
      errors: { value: errorsLogged, measured: false },
      // There is no backup job to report on. Saying "just now" invented one.
      lastBackup: { value: null, measured: false },
      // Needs request-level instrumentation (see the observability work).
      requestsPerMinute: { value: null, measured: false },
      securityLog: { value: [], measured: false },
    },
    { requestId }
  );
});
