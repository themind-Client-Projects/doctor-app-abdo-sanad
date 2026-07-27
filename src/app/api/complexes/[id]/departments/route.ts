import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { parseBody, parseQuery } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// `complexId` always comes from the route param and is deliberately absent.
const createDepartmentSchema = z
  .object({
    name: z.string().trim().min(1, { message: "الاسم مطلوب" }),
  })
  .strict();

const deleteDepartmentSchema = z
  .object({
    departmentId: z.string().trim().min(1, { message: "معرف القسم مطلوب" }),
  })
  .strict();

// Query variant: not strict, because unrelated query params must not 400.
const deleteQuerySchema = z.object({
  departmentId: z.string().trim().min(1, { message: "معرف القسم مطلوب" }),
});

export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (_req, { params }) => {
  const { id } = await params;
  const data = await prisma.department.findMany({ where: { complexId: id } });
  return NextResponse.json({ data });
});

export const POST = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const { name } = await parseBody(req, createDepartmentSchema);

  const data = await prisma.department.create({ data: { complexId: id, name } });
  return NextResponse.json({ data }, { status: 201 });
});

// DELETE — departmentId comes from the JSON body (kept for existing callers),
// with ?departmentId= as a fallback because many HTTP clients drop a body on
// DELETE. Whichever source the caller used is the one that gets validated: the
// JSON content-type is what tells the two apart. The delete is also scoped to
// this complex: it previously deleted by bare id, so any department of any
// complex could be removed through any complex's URL.
export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;

  const sentJsonBody = (req.headers.get("content-type") ?? "").includes("application/json");
  const { departmentId } = sentJsonBody
    ? await parseBody(req, deleteDepartmentSchema)
    : parseQuery(req.nextUrl.searchParams, deleteQuerySchema);

  const { count } = await prisma.department.deleteMany({
    where: { id: departmentId, complexId: id },
  });
  if (count === 0) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  return NextResponse.json({ message: "تم الحذف" });
});
