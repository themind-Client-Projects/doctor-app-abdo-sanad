import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPublic } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/public/partners/[id] — one lab, pharmacy or radiology centre.
 *
 * The list endpoint has no id filter, so the pharmacy detail page had no way
 * to ask for the pharmacy it was opened for. It resolved the route param
 * against `DEMO_PHARMACIES` instead — see that page's own note.
 *
 * Visibility matches the list exactly. A partner that is not listed must not
 * have a reachable page: showing the catalogue of a suspended pharmacy invites
 * an order nobody will fill.
 */

const querySchema = z.object({
  channel: z.enum(["DIRECT", "SANAD", "COMPLEX"]).default("DIRECT"),
  /**
   * Narrow to one partner type. `/pharmacies/[id]` passes PHARMACY, because
   * without it ANY active partner id rendered as a pharmacy — complete with a
   * «صيدلية» badge and a product grid — if someone pasted a lab's id into the
   * URL.
   */
  type: z.enum(["LAB", "PHARMACY", "RADIOLOGY", "DOCTOR", "NURSE", "DRIVER"]).optional(),
});

export const GET = withPublic<Ctx>(async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const { channel, type } = parseQuery(req.nextUrl.searchParams, querySchema);

  const p = await prisma.partner.findFirst({
    where: {
      id,
      ...(type ? { type } : {}),
      status: "ACTIVE",
      deletedAt: null,
      channels: { some: { channel, status: { not: "SUSPENDED" } } },
    },
    select: {
      id: true,
      name: true,
      type: true,
      phone: true,
      address: true,
      latitude: true,
      longitude: true,
      rating: true,
      totalTasks: true,
      governorate: { select: { name: true } },
      ownedComplex: { select: { id: true, name: true } },
      complex: { select: { id: true, name: true } },
      serviceConfigs: {
        where: { status: { in: ["ACTIVE", "REACTIVATED"] } },
        select: { serviceType: true, isHomeService: true, isBloodDraw: true },
      },
    },
  });

  if (!p) {
    return fail(ErrorCode.NOT_FOUND, 404, "لم يتم العثور على الجهة", { requestId });
  }

  return ok(
    {
      id: p.id,
      name: p.name,
      type: p.type,
      phone: p.phone,
      location: p.governorate?.name ?? "",
      address: p.address ?? "",
      latitude: p.latitude,
      longitude: p.longitude,
      rating: p.rating,
      /** The complex this partner OWNS, if any. */
      ownedComplex: p.ownedComplex,
      /** The complex this partner is a MEMBER of, if any. */
      complex: p.complex,
      services: p.serviceConfigs.map((s) => s.serviceType),
      hasHomeService: p.serviceConfigs.some((s) => s.isHomeService),
      hasBloodDraw: p.serviceConfigs.some((s) => s.isBloodDraw),
      /** `Partner.totalTasks` — completed tasks, never reviews. See the list
       *  sibling: this was served as `reviewCount`. */
      completedTasks: p.totalTasks,
    },
    { requestId }
  );
});
