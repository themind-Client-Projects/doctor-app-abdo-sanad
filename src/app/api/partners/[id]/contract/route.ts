import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { jsonValue, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** A Prisma `Json` column: any JSON value, with `null` meaning "leave alone". */
const jsonInput = jsonValue
  .optional()
  .transform((v) => (v === undefined || v === null ? undefined : (v as Prisma.InputJsonValue)));

/** `dateish`, carrying the message this route already returned. */
const requiredDate = z.coerce.date({ message: "تاريخ البداية وتاريخ الانتهاء مطلوبان" });

// `partnerId` always comes from the route param and is deliberately absent.
const updateContractSchema = z
  .object({
    startDate: requiredDate,
    endDate: requiredDate,
    services: jsonInput,
    governorates: jsonInput,
    workHours: jsonInput,
    minPrices: jsonInput,
    terms: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

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
  const input = await parseBody(req, updateContractSchema);

  // Explicit allow-list — never spread the request body into Prisma.
  const fields = {
    startDate: input.startDate,
    endDate: input.endDate,
    services: input.services,
    governorates: input.governorates,
    workHours: input.workHours,
    minPrices: input.minPrices,
    terms: input.terms,
    isActive: input.isActive,
  };

  const data = await prisma.contract.upsert({
    where: { partnerId: id },
    update: fields,
    create: { partnerId: id, ...fields },
  });

  return NextResponse.json({ data });
});
