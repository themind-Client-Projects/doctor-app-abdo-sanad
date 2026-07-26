import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (_req, { params }) => {
  const { id } = await params;
  const data = await prisma.department.findMany({ where: { complexId: id } });
  return NextResponse.json({ data });
});

export const POST = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = body && typeof body === "object" ? body.name : undefined;

  if (typeof name !== "string" || name.length === 0) {
    return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
  }

  const data = await prisma.department.create({ data: { complexId: id, name } });
  return NextResponse.json({ data }, { status: 201 });
});

// DELETE — departmentId comes from the JSON body (kept for existing callers),
// with ?departmentId= as a fallback because many HTTP clients drop a body on
// DELETE. The delete is also scoped to this complex: it previously deleted by
// bare id, so any department of any complex could be removed through any
// complex's URL.
export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const fromBody = body && typeof body === "object" ? body.departmentId : undefined;
  const departmentId =
    typeof fromBody === "string" ? fromBody : req.nextUrl.searchParams.get("departmentId");

  if (!departmentId) {
    return NextResponse.json({ error: "معرف القسم مطلوب" }, { status: 400 });
  }

  const { count } = await prisma.department.deleteMany({
    where: { id: departmentId, complexId: id },
  });
  if (count === 0) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  return NextResponse.json({ message: "تم الحذف" });
});
