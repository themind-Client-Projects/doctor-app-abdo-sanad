import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { jsonValue, parseBody } from "@/lib/validation";

const discountType = z.enum(["PERCENTAGE", "FIXED"], { message: "نوع الخصم غير صالح" });

const discountValue = z
  .number({ message: "قيمة الخصم غير صالحة" })
  .finite({ message: "قيمة الخصم غير صالحة" })
  .nonnegative({ message: "قيمة الخصم غير صالحة" });

/** `dateish`, carrying the message this route already returned. */
const requiredDate = z.coerce.date({ message: "تاريخ البداية وتاريخ الانتهاء مطلوبان" });

/** A Prisma `Json` column: any JSON value, with `null` meaning "leave alone". */
const jsonInput = jsonValue
  .optional()
  .transform((v) => (v === undefined || v === null ? undefined : (v as Prisma.InputJsonValue)));

const createCampaignSchema = z
  .object({
    name: z.string().trim().min(1, { message: "اسم الحملة مطلوب" }),
    description: z.string().optional(),
    discountType,
    discountValue,
    startDate: requiredDate,
    endDate: requiredDate,
    targetServices: jsonInput,
    isActive: z.boolean().default(true),
  })
  .strict();

export const GET = withAuth({ roles: ROLES.ADMIN }, async () => {
  const data = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ data });
});

// POST /api/campaigns — the body used to be spread straight into create.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const input = await parseBody(req, createCampaignSchema);

  const data = await prisma.campaign.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: {
      name: input.name,
      description: input.description ?? null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      startDate: input.startDate,
      endDate: input.endDate,
      targetServices: input.targetServices,
      isActive: input.isActive,
    },
  });

  return NextResponse.json({ data }, { status: 201 });
});
