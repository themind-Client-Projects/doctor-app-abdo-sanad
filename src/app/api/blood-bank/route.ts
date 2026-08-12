import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { keysetArgs, ok, okList, toPage } from "@/lib/api-response";
import { nonEmpty, parseBody, parseQuery } from "@/lib/validation";
import {
  bloodType,
  createBloodBankRequestSchema,
  requestStatus,
  requestType,
} from "@/server/services/blood-bank";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // Filters. The screen had these as CLIENT-side filters over whatever page had
  // loaded, so "كل الحالات → مكتمل" searched the newest 100 rows and quietly
  // reported nothing for anything older. A blood bank keeps its history, so
  // that boundary is reached quickly.
  requestType: z.preprocess(emptyToUndefined, requestType.optional()),
  status: z.preprocess(emptyToUndefined, requestStatus.optional()),
  bloodType: z.preprocess(emptyToUndefined, bloodType.optional()),
  governorateId: z.preprocess(emptyToUndefined, nonEmpty.optional()),
  /** Name, phone, or operation — the three things staff have on a phone call. */
  q: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
});

// GET /api/blood-bank — Blood bank requests (req L433-443)
//
// Was unbounded: requests are kept after they are fulfilled, so this returned
// the entire history of the blood bank on every load.
export const GET = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { cursor, limit, ...filters } = parseQuery(req.nextUrl.searchParams, listQuerySchema);

  const where: Prisma.BloodBankRequestWhereInput = {};
  if (filters.requestType) where.requestType = filters.requestType;
  if (filters.status) where.status = filters.status;
  if (filters.bloodType) where.bloodType = filters.bloodType;
  if (filters.governorateId) where.governorateId = filters.governorateId;
  if (filters.q) {
    where.OR = [
      { fullName: { contains: filters.q, mode: "insensitive" } },
      { phone: { contains: filters.q } },
      { operationType: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  const keyset = keysetArgs(cursor, limit);
  const cursorWhere = "where" in keyset ? keyset.where : undefined;

  const rows = await prisma.bloodBankRequest.findMany({
    ...keyset,
    where: cursorWhere ? { AND: [where, cursorWhere] } : where,
    include: { governorate: { select: { id: true, name: true } } },
  });

  const { items, page } = toPage(rows, limit);
  return okList(items, page, { requestId });
});

// POST /api/blood-bank — Create a request.
//
// Staff take these over the phone as often as through the patient form, so this
// is a first-class entry point, not just the form's endpoint.
export const POST = withAuth({ roles: ROLES.OPERATIONS }, async (req) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const input = await parseBody(req, createBloodBankRequestSchema);

  const data = await prisma.bloodBankRequest.create({
    data: {
      requestType: input.requestType,
      userId: input.userId ?? null,
      fullName: input.fullName,
      phone: input.phone,
      photoUrl: input.photoUrl ?? null,
      age: input.age ?? null,
      gender: input.gender ?? null,
      residence: input.residence ?? null,
      landmark: input.landmark ?? null,
      lastDonation: input.lastDonation ?? null,
      operationType: input.operationType ?? null,
      bagsNeeded: input.bagsNeeded ?? null,
      operationPlace: input.operationPlace ?? null,
      notes: input.notes ?? null,
      bloodType: input.bloodType,
      governorateId: input.governorateId ?? null,
      status: input.status,
      // Stamped here rather than taken from the body, for the same reason the
      // PATCH route derives it: it evidences that the case went out to donors.
      broadcastAt: input.status === "broadcast" ? new Date() : null,
      donorId: input.donorId ?? null,
      donorName: input.donorName ?? null,
      drawAppointment: input.drawAppointment ?? null,
      testStatus: input.testStatus ?? null,
      deliveryStatus: input.deliveryStatus ?? null,
    },
    include: { governorate: { select: { id: true, name: true } } },
  });

  return ok(data, { status: 201, requestId });
});
