import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { parseBody } from "@/lib/validation";

const createComplexSchema = z
  .object({
    partnerId: z.string().trim().min(1, { message: "الشريك والاسم مطلوبان" }),
    name: z.string().trim().min(1, { message: "الشريك والاسم مطلوبان" }),
  })
  .strict();

export const GET = withAuth({ roles: ROLES.OPERATIONS }, async () => {
  const data = await prisma.medicalComplex.findMany({
    include: {
      departments: true,
      partners: { select: { id: true, name: true, type: true } },
    },
  });
  return NextResponse.json({ data });
});

// POST /api/complexes — the body used to be spread straight into create.
export const POST = withAuth({ roles: ROLES.ADMIN }, async (req) => {
  const input = await parseBody(req, createComplexSchema);

  const data = await prisma.medicalComplex.create({
    // Explicit allow-list — never spread the request body into Prisma.
    data: { partnerId: input.partnerId, name: input.name },
  });
  return NextResponse.json({ data }, { status: 201 });
});
