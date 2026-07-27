import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

// GET /api/system-monitoring — System health (req L247-254, 6 metrics)
export const GET = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const startTime = Date.now();

  // TODO: these are placeholders, not real monitoring. Every counter below is a
  // hardcoded zero and `lastBackup` is fabricated — it reports "now" on every
  // call, so a dashboard reading it will always show a healthy, just-completed
  // backup regardless of whether one ever ran. Wire up to the session store,
  // request metrics and the real backup job before trusting any of this.
  return ok(
    {
      serverSpeed: Date.now() - startTime, // سرعة الخادم (ms)
      activeUsers: 0, // عدد المستخدمين — populated from session store
      liveRequests: 0, // الطلبات المباشرة
      errors: 0, // الأخطاء
      lastBackup: new Date().toISOString(), // النسخ الاحتياطية
      securityLog: [], // السجل الأمني
    },
    { requestId }
  );
});
