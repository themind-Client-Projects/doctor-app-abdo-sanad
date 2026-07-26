import { NextResponse } from "next/server";
import type { Prisma, ServiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

const SERVICE_STATUSES: readonly ServiceStatus[] = [
  "ACTIVE",
  "SUSPENDED",
  "PAUSED",
  "REACTIVATED",
];

const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const json = (v: unknown) =>
  v === undefined || v === null ? undefined : (v as Prisma.InputJsonValue);
const int = (v: unknown) =>
  typeof v === "number" && Number.isInteger(v) ? v : undefined;

// GET — List partner service configs (req L183-198)
export const GET = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  const data = await prisma.serviceConfig.findMany({ where: { partnerId: id } });
  return NextResponse.json({ data });
});

// PUT — Update/create service configs.
// Each entry used to be spread into upsert, so `partnerId` could be supplied in
// the body and write a config onto a different partner. `configs` was also
// assumed to be an array — a malformed body threw inside .map and 500'd.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const configs = body?.configs;

  if (!Array.isArray(configs)) {
    return NextResponse.json({ error: "قائمة الخدمات غير صالحة" }, { status: 400 });
  }

  const parsed: {
    serviceType: string;
    fields: {
      status: ServiceStatus | undefined;
      workHours: Prisma.InputJsonValue | undefined;
      governorates: Prisma.InputJsonValue | undefined;
      dailyCapacity: number | undefined;
      isHomeService: boolean | undefined;
      isBloodDraw: boolean | undefined;
    };
  }[] = [];

  for (const raw of configs) {
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }
    const c = raw as Record<string, unknown>;
    if (typeof c.serviceType !== "string" || c.serviceType.length === 0) {
      return NextResponse.json({ error: "نوع الخدمة مطلوب" }, { status: 400 });
    }
    if (c.status !== undefined && !SERVICE_STATUSES.includes(c.status as ServiceStatus)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }
    parsed.push({
      serviceType: c.serviceType,
      // Explicit allow-list — partnerId always comes from the route param.
      fields: {
        status: c.status === undefined ? undefined : (c.status as ServiceStatus),
        workHours: json(c.workHours),
        governorates: json(c.governorates),
        dailyCapacity: int(c.dailyCapacity),
        isHomeService: bool(c.isHomeService),
        isBloodDraw: bool(c.isBloodDraw),
      },
    });
  }

  const results = await prisma.$transaction(
    parsed.map(({ serviceType, fields }) =>
      prisma.serviceConfig.upsert({
        where: { partnerId_serviceType: { partnerId: id, serviceType } },
        update: fields,
        create: { partnerId: id, serviceType, ...fields },
      })
    )
  );

  return NextResponse.json({ data: results });
});
