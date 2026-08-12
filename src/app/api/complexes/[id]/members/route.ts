import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { nonEmpty, parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Who belongs to a medical complex.
 *
 * Membership could only be set from the OTHER end — editing a partner and
 * picking a complex — so populating a complex meant opening every provider in
 * turn. Nobody did: 3 of 35 partners were linked to any complex, and 4 of 5
 * complexes had no members at all.
 *
 * That is not cosmetic. A complex with no members cannot do the thing a complex
 * exists for: a doctor referring a patient to ITS lab or ITS pharmacy. The
 * referral feature is built on this table being populated.
 */

const addMemberSchema = z.object({ partnerId: nonEmpty }).strict();

// GET /api/complexes/[id]/members
export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const members = await prisma.partner.findMany({
    where: { complexId: id, deletedAt: null },
    select: { id: true, name: true, type: true, status: true, phone: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return ok(members, { requestId });
});

// POST /api/complexes/[id]/members — attach a partner to this complex.
export const POST = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const { partnerId } = await parseBody(req, addMemberSchema);

  const complex = await prisma.medicalComplex.findUnique({
    where: { id },
    select: { id: true, partnerId: true },
  });
  if (!complex) {
    return fail(ErrorCode.NOT_FOUND, 404, "المجمع غير موجود", { requestId });
  }

  const partner = await prisma.partner.findFirst({
    where: { id: partnerId, deletedAt: null },
    select: {
      id: true,
      type: true,
      complexId: true,
      userId: true,
      ownedComplex: { select: { id: true, name: true } },
    },
  });
  if (!partner) {
    return fail(ErrorCode.NOT_FOUND, 404, "الشريك غير موجود", { requestId });
  }

  // A complex is itself a Partner (`MedicalComplex.partnerId`). Letting it join
  // itself would make it its own member and its own parent.
  if (partner.id === complex.partnerId) {
    return fail(ErrorCode.BUSINESS_RULE_VIOLATION, 422, "لا يمكن ضمّ المجمع إلى نفسه", {
      requestId,
    });
  }

  if (partner.complexId === id) {
    return fail(ErrorCode.DUPLICATE_RESOURCE, 409, "الشريك منتسب لهذا المجمع بالفعل", {
      requestId,
    });
  }

  // A complex must not sit inside another complex.
  //
  // Nothing stopped it, and the data already held a cycle: one complex was a
  // member of a second while the second's owner was a member of the first.
  // "The pharmacy in my complex" stops having one answer the moment complexes
  // nest, and referral is built entirely on that phrase.
  if (partner.ownedComplex) {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      `«${partner.ownedComplex.name}» مجمع قائم بذاته — لا يمكن ضمّه إلى مجمع آخر`,
      { requestId }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.partner.update({ where: { id: partnerId }, data: { complexId: id } });

    // A doctor's complex is stored twice — on `Partner` and on `DoctorProfile`
    // — and the two must never disagree about which complex they belong to.
    if (partner.type === "DOCTOR") {
      await tx.doctorProfile.updateMany({
        where: { userId: partner.userId },
        data: { complexId: id },
      });
    }

    // Membership is also a sales channel: a partner inside a complex sells at
    // the complex price. Without the row they are members on paper and invisible
    // in the complex storefront.
    await tx.partnerChannel.upsert({
      where: { partnerId_channel: { partnerId, channel: "COMPLEX" } },
      update: {},
      create: { partnerId, channel: "COMPLEX" },
    });
  });

  return ok({ message: "تمت إضافة الشريك إلى المجمع" }, { status: 201, requestId });
});

// DELETE /api/complexes/[id]/members?partnerId= — detach a partner.
export const DELETE = withAuth<Ctx>({ roles: ROLES.ADMIN }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;
  const partnerId = req.nextUrl.searchParams.get("partnerId");
  if (!partnerId) {
    return fail(ErrorCode.VALIDATION_FAILED, 400, "معرف الشريك مطلوب", { requestId });
  }

  const partner = await prisma.partner.findFirst({
    where: { id: partnerId, complexId: id, deletedAt: null },
    select: { id: true, type: true, userId: true },
  });
  if (!partner) {
    return fail(ErrorCode.NOT_FOUND, 404, "الشريك غير منتسب لهذا المجمع", { requestId });
  }

  await prisma.$transaction(async (tx) => {
    await tx.partner.update({ where: { id: partnerId }, data: { complexId: null } });
    if (partner.type === "DOCTOR") {
      await tx.doctorProfile.updateMany({
        where: { userId: partner.userId },
        data: { complexId: null },
      });
    }
    // Leaving the complex means leaving its storefront. Past orders keep their
    // own `source`, so history is unaffected.
    await tx.partnerChannel.deleteMany({ where: { partnerId, channel: "COMPLEX" } });
  });

  return ok({ message: "تمت إزالة الشريك من المجمع" }, { requestId });
});
