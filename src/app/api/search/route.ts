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

  // `href` has to name a route that EXISTS. Two of these three pointed at
  // detail pages that were never built — `/operations/orders/[id]` and
  // `/admin/users/[id]` — so following a search result 404'd. Both resources
  // live on a list screen that takes `?q=`, which is where they now go.
  const results = [
    ...orders.map((o) => ({
      type: "order" as const,
      id: o.id,
      title: `طلب #${o.orderNumber}`,
      subtitle: `${o.patientName} — ${o.serviceType}`,
      href: `/operations/orders?q=${encodeURIComponent(o.orderNumber)}`,
    })),
    ...partners.map((p) => ({
      type: "partner" as const,
      id: p.id,
      title: p.name,
      subtitle: p.type,
      // The one detail page that does exist.
      href: `/admin/partners/${p.id}`,
    })),
    ...users.map((u) => ({
      type: "patient" as const,
      id: u.id,
      title: u.name || u.phone || "مستخدم",
      subtitle: u.role,
      href: `/admin/users?q=${encodeURIComponent(u.name || u.phone || "")}`,
    })),
  ];

  return ok(results, { requestId });
});
