import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const json = (v: unknown) =>
  v === undefined || v === null ? undefined : (v as Prisma.InputJsonValue);
const date = (v: unknown) => {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

// GET /api/partners/[id]/contract
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  const data = await prisma.contract.findUnique({
    where: { partnerId: id },
    include: { commissionRules: true },
  });
  if (!data) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json({ data });
});

// PUT /api/partners/[id]/contract — create or replace the partner contract.
// The body used to be spread into upsert (both update and create), so any column
// on the model — including `partnerId` — was writable.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const startDate = date(body.startDate);
  const endDate = date(body.endDate);
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "تاريخ البداية وتاريخ الانتهاء مطلوبان" },
      { status: 400 }
    );
  }

  // Explicit allow-list — never spread the request body into Prisma.
  const fields = {
    startDate,
    endDate,
    services: json(body.services),
    governorates: json(body.governorates),
    workHours: json(body.workHours),
    minPrices: json(body.minPrices),
    terms: str(body.terms),
    isActive: bool(body.isActive),
  };

  const data = await prisma.contract.upsert({
    where: { partnerId: id },
    update: fields,
    create: { partnerId: id, ...fields },
  });

  return NextResponse.json({ data });
});
