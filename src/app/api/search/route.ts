import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

// GET /api/search?q=... — Global search (req L11 "البحث الشامل")
//
// A two-character query sweeps orders (patient names + phone numbers), users
// (name / email / phone / role) and partners, so this is staff-only — a patient
// must never be able to enumerate the platform's directory.
// Platform roles only. This is a directory of every patient's name and phone
// number, every order and every partner — under ROLES.STAFF a delivery driver
// could look up any patient on the platform by name. Nothing narrower would do:
// the whole point of the operations header search is that it crosses tenants.
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const q = req.nextUrl.searchParams.get("q");
  // Too short to search — an empty result set, not an error. Status unchanged.
  if (!q || q.length < 2) {
    return ok([], { requestId });
  }

  const [orders, partners, users] = await Promise.all([
    // Search orders by number or patient name
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { patientName: { contains: q, mode: "insensitive" } },
          { patientPhone: { contains: q } },
        ],
      },
      select: { id: true, orderNumber: true, patientName: true, serviceType: true },
      take: 5,
    }),
    // Search partners by name or phone
    prisma.partner.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      select: { id: true, name: true, type: true, phone: true },
      take: 5,
    }),
    // Search users by name, email, or phone
    prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      select: { id: true, name: true, role: true, phone: true },
      take: 5,
    }),
  ]);

  const results = [
    ...orders.map((o) => ({
      type: "order" as const,
      id: o.id,
      title: `طلب #${o.orderNumber}`,
      subtitle: `${o.patientName} — ${o.serviceType}`,
      href: `/operations/orders/${o.id}`,
    })),
    ...partners.map((p) => ({
      type: "partner" as const,
      id: p.id,
      title: p.name,
      subtitle: p.type,
      href: `/admin/partners/${p.id}`,
    })),
    ...users.map((u) => ({
      type: "patient" as const,
      id: u.id,
      title: u.name || u.phone || "مستخدم",
      subtitle: u.role,
      href: `/admin/users/${u.id}`,
    })),
  ];

  return ok(results, { requestId });
});
