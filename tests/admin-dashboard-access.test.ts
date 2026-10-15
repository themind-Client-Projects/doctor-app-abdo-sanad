import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { canAccess, roleHomePath } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/lib/tokens";

/**
 * A SUPER_ADMIN may open the partner dashboard.
 *
 * The route table omitted SUPER_ADMIN from `/dashboard`, so an admin who went
 * there was bounced to «ليس لديك صلاحية» — while every other layer was already
 * built to serve them: `/api/dashboard/summary` has its own `case
 * "SUPER_ADMIN"` returning platform-wide KPIs, the shell names the role «إدارة
 * وريد», `ROLES.STAFF` admits it, and `partnerScope` returns `{}` for platform
 * roles on purpose.
 *
 * Both halves are pinned here, because the gate and the handler disagreeing is
 * exactly what produced the bug: a page the router refused and the API would
 * happily have answered.
 */

describe("SUPER_ADMIN and the partner dashboard", () => {
  it("is allowed through the route gate", () => {
    expect(canAccess("SUPER_ADMIN", "/dashboard")).toBe(true);
    expect(canAccess("SUPER_ADMIN", "/dashboard/finance")).toBe(true);
  });

  it("still keeps the partner roles out of the admin portal", () => {
    // The fix must not widen anything else.
    expect(canAccess("DOCTOR", "/admin")).toBe(false);
    expect(canAccess("PATIENT", "/dashboard")).toBe(false);
    expect(canAccess("OPERATIONS", "/dashboard")).toBe(false);
  });

  it("still sends an admin home to /admin, not /dashboard", () => {
    // Being ALLOWED into the dashboard must not change where they land.
    expect(roleHomePath.SUPER_ADMIN).toBe("/admin");
  });

  it("GET /api/dashboard/summary answers an admin with real KPIs", async () => {
    const admin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN", deletedAt: null, isActive: true },
      select: { id: true, role: true },
    });
    if (!admin) {
      console.warn("SKIP: no SUPER_ADMIN fixture");
      return;
    }

    const bearer = await signAccessToken({
      sub: admin.id,
      role: admin.role,
      // The point of the case: an admin has NO partner, and the endpoint must
      // still answer rather than scoping itself to an empty string.
      partnerId: null,
      doctorProfileId: null,
    });

    const { GET } = await import("@/app/api/dashboard/summary/route");
    const res = await GET(
      new NextRequest("http://localhost/api/dashboard/summary", {
        headers: { authorization: `Bearer ${bearer}` },
      }),
      { params: Promise.resolve({}) } as never
    );

    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(Array.isArray(body.data.kpis)).toBe(true);
    expect(body.data.kpis.length).toBeGreaterThan(0);
  });
});
