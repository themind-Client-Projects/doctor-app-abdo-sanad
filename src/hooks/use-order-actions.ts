"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { apiFetch, useMutation } from "@/hooks/use-mutation";

/**
 * Every action an operations employee can take on an order.
 *
 * All of these endpoints existed and NONE were reachable: the operations screens
 * were read-only, so the whole workflow the requirement describes — قبول، رفض،
 * تعليق، تحويل، تعيين، تقدّم الحالة — was built server-side and unusable.
 *
 * One hook rather than a mutation per screen, because the same order is acted on
 * from the orders list, dispatch and tracking. Six copies of "accept" would be
 * six chances for one of them to forget to refetch, or to send the wrong body.
 *
 * `onDone` is called after any successful action so the caller refreshes once,
 * in one place.
 */

export type AssignTarget = "doctor" | "nurse" | "driver" | "lab" | "pharmacy" | "radiology";

/**
 * The 11 canonical lifecycle steps, mirroring `TIMELINE_STEPS` on the server.
 *
 * These are the server's `code` values verbatim. `SERVICE_DONE` in particular is
 * easy to get wrong — the step reads "تم إنهاء الخدمة", and a code of `FINISHED`
 * would be rejected by the endpoint's `z.enum` as a 400.
 */
export type TimelineStep =
  | "CREATED"
  | "ACCEPTED"
  | "ASSIGNED"
  | "CONTACTED"
  | "IN_TRANSIT"
  | "ARRIVED"
  | "STARTED"
  | "SERVICE_DONE"
  | "RESULTS_UPLOADED"
  | "PATIENT_NOTIFIED"
  | "COMPLETED";

/** What POST /api/orders/[id]/complete answers with. */
type CompleteResult = {
  settled: boolean;
  settlementError: string | null;
};

export function useOrderActions(onDone?: () => void) {
  // Held in a stable callback so every mutation below keeps one identity for
  // the component's life — these are passed to memoized rows, and a new
  // function each render would defeat that memoization.
  const done = useCallback(() => onDone?.(), [onDone]);

  const accept = useMutation(
    async (id: string) => apiFetch(`/api/orders/${id}/accept`, { method: "POST", body: "{}" }),
    { successMessage: "تم قبول الطلب", onSuccess: done }
  );

  const reject = useMutation(
    async (id: string, reason?: string) =>
      apiFetch(`/api/orders/${id}/reject`, {
        method: "POST",
        body: JSON.stringify(reason ? { reason } : {}),
      }),
    { successMessage: "تم رفض الطلب", onSuccess: done }
  );

  const hold = useMutation(
    async (id: string) => apiFetch(`/api/orders/${id}/hold`, { method: "POST", body: "{}" }),
    { successMessage: "تم تعليق الطلب", onSuccess: done }
  );

  const transfer = useMutation(
    async (id: string, targetEmployeeId: string) =>
      apiFetch(`/api/orders/${id}/transfer`, {
        method: "POST",
        body: JSON.stringify({ targetEmployeeId }),
      }),
    { successMessage: "تم تحويل الطلب", onSuccess: done }
  );

  const assign = useMutation(
    async (id: string, type: AssignTarget, partnerId: string) =>
      apiFetch(`/api/orders/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({ type, partnerId }),
      }),
    { successMessage: "تم تعيين المنفّذ", onSuccess: done }
  );

  const advance = useMutation(
    async (id: string, step: TimelineStep, description?: string) =>
      apiFetch(`/api/orders/${id}/advance`, {
        method: "POST",
        body: JSON.stringify({ step, ...(description ? { description } : {}) }),
      }),
    { successMessage: "تم تحديث حالة الطلب", onSuccess: done }
  );

  /**
   * Resolve and store the order's amount.
   *
   * A separate step on purpose: completion refuses an unpriced order, because
   * settlement has nothing to split. Without this the complete action returns
   * "يجب تسعير الطلب قبل إكماله" and there is no way to act on it.
   */
  const price = useMutation(
    async (id: string, couponCode?: string) =>
      apiFetch(`/api/orders/${id}/price`, {
        method: "POST",
        body: JSON.stringify(couponCode ? { couponCode } : {}),
      }),
    { successMessage: "تم تسعير الطلب", onSuccess: done }
  );

  const complete = useMutation<CompleteResult, [string]>(
    async (id: string) => apiFetch(`/api/orders/${id}/complete`, { method: "POST", body: "{}" }),
    {
      // Settlement is best-effort by design: the service was delivered, so the
      // order stays completed even if the revenue split fails. A fixed
      // "وتمت التسوية" would therefore certify a payout that may not have
      // happened — the toast reports what the server actually did.
      successMessage: null,
      onSuccess: (result) => {
        if (result?.settled) {
          toast.success("اكتمل الطلب وتمت التسوية");
        } else {
          toast.warning("اكتمل الطلب، لكن التسوية لم تتم", {
            description: result?.settlementError ?? "راجع عقد الشريك وقواعد العمولة",
          });
        }
        done();
      },
    }
  );

  // One object, memoized — consumers spread it into handlers and an unstable
  // reference would re-render every row on any mutation's pending change.
  return useMemo(
    () => ({
      accept: accept.mutate,
      price: price.mutate,
      reject: reject.mutate,
      hold: hold.mutate,
      transfer: transfer.mutate,
      assign: assign.mutate,
      advance: advance.mutate,
      complete: complete.mutate,
      isPending:
        accept.isPending ||
        price.isPending ||
        reject.isPending ||
        hold.isPending ||
        transfer.isPending ||
        assign.isPending ||
        advance.isPending ||
        complete.isPending,
    }),
    [
      accept.mutate, accept.isPending,
      price.mutate, price.isPending,
      reject.mutate, reject.isPending,
      hold.mutate, hold.isPending,
      transfer.mutate, transfer.isPending,
      assign.mutate, assign.isPending,
      advance.mutate, advance.isPending,
      complete.mutate, complete.isPending,
    ]
  );
}

/**
 * Which actions an order in this status can actually take.
 *
 * Kept beside the hook so the buttons and the server agree. Rendering a
 * "قبول" on an already-accepted order invites a click that returns a 409 the
 * employee cannot interpret.
 */
export function allowedActions(status: string): {
  canAccept: boolean;
  canReject: boolean;
  canHold: boolean;
  canAssign: boolean;
  canComplete: boolean;
} {
  const isNew = status === "NEW";
  const isOpen = !["COMPLETED", "CANCELLED"].includes(status);
  return {
    canAccept: isNew,
    canReject: isNew || status === "ACCEPTED",
    canHold: isOpen && status !== "DELAYED",
    canAssign: ["ACCEPTED", "ASSIGNED", "DELAYED"].includes(status),
    canComplete: ["IN_PROGRESS", "ARRIVED"].includes(status),
  };
}
