import { prisma } from "@/lib/prisma";
import { withPublic } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

/**
 * GET /api/public/governorates — the city picker on sign-up.
 *
 * Public because it is read DURING sign-up, before a session exists.
 * `/api/governorates` is the staff surface and requires one, so a patient
 * choosing their city would have been 401'd by it.
 *
 * `areas` comes back with each row so the form can ask for a second choice
 * where one exists — بغداد carries الكرخ / الرصافة. Driving that off the data
 * rather than an `if (city === "بغداد")` means the admin can define areas for
 * any governorate from إعدادات النظام and the form follows.
 */
export const GET = withPublic(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const data = await prisma.governorate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    // Counts and relations are deliberately absent — this is a picker.
    select: { id: true, name: true, areas: true },
  });

  return ok(data, { requestId });
});
