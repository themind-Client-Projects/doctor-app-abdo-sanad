import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

/**
 * GET /api/v1/specialties — the specialty catalogue.
 *
 * Part of the versioned surface the mobile client codes against. The list
 * previously existed only in `src/lib/constants/specializations.ts`, which a
 * native app cannot read.
 *
 * `slug` is the stable machine key — clients branch on that, never on `name`,
 * which is Arabic display text and will change when a second locale lands.
 */
export const GET = withAuth({}, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  const data = await prisma.specialty.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      icon: true,
      color: true,
      _count: { select: { doctors: true } },
    },
  });

  return ok(
    data.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      icon: s.icon,
      color: s.color,
      // The directory shows a per-specialty count; deriving it here keeps the
      // client from fetching every doctor just to count them.
      doctorCount: s._count.doctors,
    })),
    { requestId }
  );
});
