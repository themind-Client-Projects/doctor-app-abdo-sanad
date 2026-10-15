import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/lib/tokens";

/**
 * An admin can put money into a patient's wallet.
 *
 * `POST /api/patients/[id]/wallet` was written for exactly this — its own
 * header says "admin can add money to wallet", and it logs every adjustment to
 * `ActivityLog` — but no screen ever called it, so no administrator could
 * credit a single dinar. /admin/users now does.
 *
 * Exercised through the real handler, because the things that matter here are
 * facts the types cannot check: that the wallet row is created on first credit,
 * that the balance actually moves, and that a debit beyond the balance is
 * refused rather than writing a negative one.
 */

const CREDITED = 7_500;
let walletId: string | null = null;
let patientId: string | null = null;

function req(url: string, init: { method: string; body?: unknown; bearer: string }) {
  return new NextRequest(`http://localhost${url}`, {
    method: init.method,
    headers: { "content-type": "application/json", authorization: `Bearer ${init.bearer}` },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

afterAll(async () => {
  // Leave the balance as it was found.
  if (walletId && patientId) {
    await prisma.patientTransaction.deleteMany({
      where: { walletId, description: "vitest: admin top-up" },
    });
    await prisma.patientWallet.update({
      where: { id: walletId },
      data: { balance: { decrement: CREDITED } },
    });
  }
});

describe("admin wallet adjustment", () => {
  it("credits a patient's wallet and the balance really moves", async () => {
    const admin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN", deletedAt: null, isActive: true },
      select: { id: true, role: true },
    });
    const patient = await prisma.user.findFirst({
      where: { role: "PATIENT", deletedAt: null },
      select: { id: true },
    });
    if (!admin || !patient) {
      console.warn("SKIP: no admin or patient fixture");
      return;
    }
    patientId = patient.id;

    const before = await prisma.patientWallet.findUnique({
      where: { userId: patient.id },
      select: { balance: true },
    });
    const bearer = await signAccessToken({
      sub: admin.id,
      role: admin.role,
      partnerId: null,
      doctorProfileId: null,
    });

    const { POST } = await import("@/app/api/patients/[id]/wallet/route");
    const res = await POST(
      req(`/api/patients/${patient.id}/wallet`, {
        method: "POST",
        bearer,
        body: {
          direction: "CREDIT",
          amount: CREDITED,
          reason: "TOPUP",
          description: "vitest: admin top-up",
        },
      }),
      { params: Promise.resolve({ id: patient.id }) } as never
    );

    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);

    const after = await prisma.patientWallet.findUniqueOrThrow({
      where: { userId: patient.id },
      select: { id: true, balance: true },
    });
    walletId = after.id;

    // The wallet is created on first credit when the patient had none.
    expect(Number(after.balance)).toBe(Number(before?.balance ?? 0) + CREDITED);
    expect(Number(body.data.balance)).toBe(Number(after.balance));
  });

  it("writes an audit row naming the admin who moved the money", async () => {
    if (!patientId) {
      console.warn("SKIP: nothing credited");
      return;
    }
    const log = await prisma.activityLog.findFirst({
      where: { entityType: "patient_wallet", entityId: patientId },
      orderBy: { createdAt: "desc" },
      select: { action: true, userId: true },
    });
    expect(log).not.toBeNull();
    expect(log!.action).toContain("إيداع");
    expect(log!.userId).toBeTruthy();
  });

  it("refuses a debit larger than the balance instead of going negative", async () => {
    const admin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN", deletedAt: null, isActive: true },
      select: { id: true, role: true },
    });
    if (!admin || !patientId) {
      console.warn("SKIP: no fixture");
      return;
    }
    const bearer = await signAccessToken({
      sub: admin.id,
      role: admin.role,
      partnerId: null,
      doctorProfileId: null,
    });

    const { POST } = await import("@/app/api/patients/[id]/wallet/route");
    const res = await POST(
      req(`/api/patients/${patientId}/wallet`, {
        method: "POST",
        bearer,
        body: { direction: "DEBIT", amount: 99_999_999, reason: "PAYMENT" },
      }),
      { params: Promise.resolve({ id: patientId }) } as never
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("الرصيد غير كافٍ");

    const wallet = await prisma.patientWallet.findUniqueOrThrow({
      where: { userId: patientId },
      select: { balance: true },
    });
    expect(Number(wallet.balance)).toBeGreaterThanOrEqual(0);
  });
});
