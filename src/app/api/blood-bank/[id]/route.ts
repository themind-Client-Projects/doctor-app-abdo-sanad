import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/validation";
import { REQUESTER_FIELDS_MESSAGE, updateBloodBankRequestSchema } from "@/server/services/blood-bank";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/blood-bank/[id] — one request.
//
// The list is the only way this record could be read, and the list is capped.
// A staff member following up on a case from a phone call had no way to open it
// by id, and neither did the mobile client.
export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const data = await prisma.bloodBankRequest.findUnique({
    where: { id },
    include: { governorate: { select: { id: true, name: true } } },
  });
  if (!data) {
    return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
  }

  return ok(data, { requestId });
});

// PATCH /api/blood-bank/[id] — Update a request (req L433-443).
export const PATCH = withAuth<Ctx>(
  { roles: ROLES.OPERATIONS },
  async (req, { params }) => {
    const requestId = req.headers.get("x-request-id") ?? undefined;
    const { id } = await params;
    const input = await parseBody(req, updateBloodBankRequestSchema);

    const existing = await prisma.bloodBankRequest.findUnique({
      where: { id },
      select: {
        id: true,
        requestType: true,
        operationType: true,
        bagsNeeded: true,
        operationPlace: true,
      },
    });
    if (!existing) {
      return fail(ErrorCode.NOT_FOUND, 404, "غير موجود", { requestId });
    }

    // The same rule POST enforces, applied to the row as it WILL be.
    //
    // A create is validated in one shot, so Zod can check it alone. A patch
    // cannot: sending only `{ requestType: "REQUESTER" }` for a row that was a
    // donor registration would turn it into a blood request with no operation,
    // no bag count and no place — unmatchable, and invisible to the very screen
    // meant to act on it. The merged row is what has to be valid.
    const merged = {
      requestType: input.requestType ?? existing.requestType,
      operationType: input.operationType ?? existing.operationType,
      bagsNeeded: input.bagsNeeded ?? existing.bagsNeeded,
      operationPlace: input.operationPlace ?? existing.operationPlace,
    };
    if (
      merged.requestType === "REQUESTER" &&
      !(merged.operationType && merged.bagsNeeded && merged.operationPlace)
    ) {
      return fail(ErrorCode.VALIDATION_FAILED, 400, REQUESTER_FIELDS_MESSAGE, { requestId });
    }

    // `broadcastAt` is DERIVED, never sent: it records when the case actually
    // went out to donors, so letting a client supply it would allow a timestamp
    // that disagrees with the status it is supposed to evidence.
    const broadcastAt = input.status === "broadcast" ? new Date() : undefined;

    // `undefined` leaves a column untouched in Prisma.
    const data = await prisma.bloodBankRequest.update({
      where: { id },
      data: {
        broadcastAt,
        requestType: input.requestType,
        fullName: input.fullName,
        phone: input.phone,
        photoUrl: input.photoUrl,
        age: input.age,
        gender: input.gender,
        residence: input.residence,
        landmark: input.landmark,
        bloodType: input.bloodType,
        governorateId: input.governorateId,
        lastDonation: input.lastDonation,
        operationType: input.operationType,
        bagsNeeded: input.bagsNeeded,
        operationPlace: input.operationPlace,
        notes: input.notes,
        status: input.status,
        donorId: input.donorId,
        donorName: input.donorName,
        drawAppointment: input.drawAppointment,
        testStatus: input.testStatus,
        deliveryStatus: input.deliveryStatus,
      },
      include: { governorate: { select: { id: true, name: true } } },
    });

    return ok(data, { requestId });
  }
);

// DELETE /api/blood-bank/[id] — remove a record entirely.
//
// This is for a row that should not exist: a duplicate, a test entry, a
// mistyped submission. It is NOT how a case is closed — `cancelled` and
// `fulfilled` are, and they keep the record. Deleting a real case would erase
// the evidence of what the blood bank was asked for and what it did.
//
// A hard delete, matching every other admin resource here (banner, plan,
// specialty, appointment): `BloodBankRequest` carries no `deletedAt`, and
// adding a soft-delete column for one model would leave every other reader of
// this table — none of which filter on it — silently showing deleted rows.
export const DELETE = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const existing = await prisma.bloodBankRequest.findUnique({
    where: { id },
    select: { id: true, status: true, donorName: true },
  });
  if (!existing) {
    return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
  }

  // A matched or fulfilled case has a donor attached to it — a real person who
  // gave blood, or agreed to. Cancel it instead; that says what happened.
  if (existing.status === "matched" || existing.status === "fulfilled") {
    return fail(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      422,
      "لا يمكن حذف طلب مرتبط بمتبرع — غيّر حالته إلى «ملغي» بدلاً من ذلك",
      { requestId }
    );
  }

  await prisma.bloodBankRequest.delete({ where: { id } });

  return ok({ message: "تم حذف الطلب" }, { requestId });
});
