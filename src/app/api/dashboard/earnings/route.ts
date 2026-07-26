import { NextResponse } from "next/server";
import { ROLES, withAuth } from "@/lib/api-auth";

// GET /api/dashboard/earnings — Earnings summary (req L84-89)
export const GET = withAuth({ roles: ROLES.STAFF }, async () => {
  // TODO: Connect to actual wallet/transaction data — scope it to
  // `identity.partnerId` when it is wired up, never to a client-supplied id.
  // Placeholder structure matching req L87-89
  return NextResponse.json({
    data: {
      today: 0,       // أرباح اليوم
      month: 0,       // أرباح الشهر
      upcoming: 0,    // مستحقات قادمة
      currency: "د.ع", // Iraqi Dinar
    },
  });
});
