import { prisma } from "@/lib/prisma";
import { withMaybeAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

/**
 * GET /api/v1/me — the signed-in patient and their wallet balance, or nulls.
 *
 * One request for the two things every patient screen's header shows: the
 * greeting name and the wallet chip. Both were hardcoded — "أحمد محمد" passed
 * in by each page, and "150,000 د.ع" written into the header component itself,
 * so every account saw the same name and the same balance.
 *
 * Answers 200 with `user: null` for a visitor rather than 401, because browsing
 * signed-out is a normal state here — the header simply hides the chip.
 */
export const GET = withMaybeAuth(async (req, _ctx, identity) => {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  if (!identity) return ok({ user: null, wallet: null }, { requestId });

  const [user, wallet, completedOrders, completedAppointments, prescriptions, labReports] =
    await Promise.all([
    prisma.user.findUnique({
      where: { id: identity.userId },
      select: {
        id: true, name: true, phone: true, email: true, image: true, role: true,
        // What the onboarding screen judges completeness on.
        governorateId: true, area: true,
      },
    }),
    // Read-only: the wallet is created on first write, not by looking at it —
    // a GET that creates rows turns every page load into a mutation.
    prisma.patientWallet.findUnique({
      where: { userId: identity.userId },
      select: { balance: true },
    }),
    // The three tiles on /profile were the literals 12 / 3 / 8 for every
    // account. Counted rather than stored: a stored total drifts the moment an
    // order is cancelled or a record is deleted.
    // «حجز مكتمل» means a BOOKING, and a patient's bookings live in two
    // tables — `/api/v1/me/bookings` merges orders and appointments into one
    // list for exactly that reason. Counting orders alone made the tile
    // contradict the list it summarises.
    //
    // `deletedAt: null` to match that feed: without it a soft-deleted order
    // counted on the tile while being absent from the list below it.
    prisma.order.count({
      where: { patientId: identity.userId, status: "COMPLETED", deletedAt: null },
    }),
    prisma.appointment.count({
      where: { patientId: identity.userId, status: "completed", deletedAt: null },
    }),
    prisma.prescription.count({ where: { patientId: identity.userId } }),
    // `LabSample` has no patientId — it reaches the patient through its order,
    // so the count has to traverse the relation rather than assume a column.
    //
    // And only samples that actually CARRY a result: the tile says
    // «تقارير مختبر», and a sample still at `received` or `testing` is not a
    // report. It was counting the whole ladder, so a patient with ten samples
    // and no finished test was told they had ten reports — and the tile leads
    // nowhere, so nothing corrected the impression. The boundary is the
    // schema's own: `ready (النتيجة جاهزة)`.
    prisma.labSample.count({
      where: {
        deletedAt: null,
        order: { patientId: identity.userId },
        status: { in: ["ready", "sent_to_doctor", "sent_to_patient"] },
      },
    }),
  ]);

  return ok(
    {
      user,
      // `null` when the patient has no PatientWallet row — the wallet is
      // created on first write, so "no row" is a normal state and NOT a zero
      // balance. `?? 0` made the two indistinguishable, and the header then
      // printed «0 د.ع» to patients who have no wallet at all.
      wallet: wallet ? { balance: wallet.balance } : null,
      stats: { completedOrders: completedOrders + completedAppointments, prescriptions, labReports },
    },
    { requestId }
  );
});
