import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { dateish, jsonValue, nonEmpty, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const discountType = z.enum(["PERCENTAGE", "FIXED"], { message: "نوع الخصم غير صالح" });

const discountValue = z
  .number({ message: "قيمة الخصم غير صالحة" })
  .finite({ message: "قيمة الخصم غير صالحة" })
  .nonnegative({ message: "قيمة الخصم غير صالحة" });

/** A Prisma `Json` column: any JSON value, with `null` meaning "leave alone". */
const jsonInput = jsonValue
  .optional()
  .transform((v) => (v === undefined || v === null ? undefined : (v as Prisma.InputJsonValue)));

const updateCampaignSchema = z
  .object({
    name: nonEmpty.optional(),
    description: z.string().optional(),
    discountType: discountType.optional(),
    discountValue: discountValue.optional(),
    startDate: dateish.optional(),
    endDate: dateish.optional(),
    targetServices: jsonInput,
    isActive: z.boolean().optional(),
  })
  .strict();

// PUT /api/campaigns/[id] — the body used to be spread straight into update.
export const PUT = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const input = await parseBody(req, updateCampaignSchema);

  const data = await prisma.campaign.update({
    where: { id },
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      name: input.name,
      description: input.description,
      discountType: input.discountType,
      discountValue: input.discountValue,
      startDate: input.startDate,
      endDate: input.endDate,
      targetServices: input.targetServices,
      isActive: input.isActive,
    },
  });

  return NextResponse.json({ data });
});

export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (_req, { params }) => {
  const { id } = await params;
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ message: "تم الحذف" });
});
