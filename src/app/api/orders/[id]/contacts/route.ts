import { prisma } from "@/lib/prisma";
import { ROLES, withAuth } from "@/lib/api-auth";
import { ErrorCode, fail, ok } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

/** The five parties the requirement lists as call targets (req L425-429). */
export type OrderContact = {
  /** `User.id` — this is what a call log's `receiverId` must be. */
  userId: string;
  name: string;
  phone: string;
  /** Matches `CallLog.receiverType`. */
  type: "PATIENT" | "NURSE" | "DRIVER" | "LAB" | "PHARMACY" | "RADIOLOGY";
  label: string;
};

const PARTNER_SLOTS = [
  { field: "assignedNurse", type: "NURSE", label: "الممرض" },
  { field: "assignedDriver", type: "DRIVER", label: "السائق" },
  { field: "assignedLab", type: "LAB", label: "المختبر" },
  { field: "assignedPharmacy", type: "PHARMACY", label: "الصيدلية" },
  { field: "assignedRadiology", type: "RADIOLOGY", label: "مركز الأشعة" },
] as const;

// GET /api/orders/[id]/contacts — who can be called about this order.
//
// The calls screen showed five target cards, each an `<a href="tel:">` with
// nothing after the colon: five buttons that dialled nobody. The numbers were
// never fetched because nothing exposed them — a partner's phone lives on
// Partner, the patient's on the order, and the call log needs the User id
// behind each, which is a third place again.
export const GET = withAuth<Ctx>({ roles: ROLES.OPERATIONS }, async (req, { params }) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      patientId: true,
      patientName: true,
      patientPhone: true,
      // `userId` is what a call log records; `phone` is what gets dialled.
      assignedNurse: { select: { userId: true, name: true, phone: true } },
      assignedDriver: { select: { userId: true, name: true, phone: true } },
      assignedLab: { select: { userId: true, name: true, phone: true } },
      assignedPharmacy: { select: { userId: true, name: true, phone: true } },
      assignedRadiology: { select: { userId: true, name: true, phone: true } },
    },
  });

  if (!order) {
    return fail(ErrorCode.NOT_FOUND, 404, "الطلب غير موجود", { requestId });
  }

  const contacts: OrderContact[] = [
    {
      userId: order.patientId,
      name: order.patientName,
      phone: order.patientPhone,
      type: "PATIENT",
      label: "المريض",
    },
  ];

  for (const slot of PARTNER_SLOTS) {
    const partner = order[slot.field];
    // Only slots actually dispatched — an unassigned lab has no one to ring.
    if (!partner) continue;
    contacts.push({
      userId: partner.userId,
      name: partner.name,
      phone: partner.phone,
      type: slot.type,
      label: slot.label,
    });
  }

  return ok(contacts, { requestId });
});
