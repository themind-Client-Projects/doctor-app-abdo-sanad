"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { apiFetch, useMutation } from "@/hooks/use-mutation";

/**
 * Moves one row of a clinical worklist to another stage.
 *
 * Every one of these resources exposes the same write — `PATCH /<collection>/<id>`
 * with `{ status }` — so the lab, radiology, pharmacy, Sanad and blood-bank
 * screens share this rather than each declaring its own mutation. None of them
 * could change a status at all before; this is the write they were missing.
 *
 * `basePath` is the collection, e.g. "/api/lab-samples".
 */

/**
 * Lab samples and radiology studies also carry their linked order along when a
 * result is marked ready. That bridge is best-effort by design — see
 * `advanceOrderQuietly` — so the toast reports what actually happened rather
 * than claiming the patient's tracking screen moved when it did not.
 */
type StageResult = { order?: { advanced: boolean; reason: string | null } | null } | null;

export function useStageMutation(basePath: string, onDone: () => void) {
  const { mutate, isPending } = useMutation<StageResult, [string, string]>(
    async (id: string, status: string) =>
      apiFetch(`${basePath}/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    {
      successMessage: null,
      onSuccess: (result) => {
        const reason = result?.order?.reason;
        if (reason) {
          toast.warning("تم تحديث الحالة — ولم يتقدّم الطلب المرتبط", { description: reason });
        } else {
          toast.success("تم تحديث الحالة");
        }
        onDone();
      },
    }
  );

  // Memoized so the memoized table rows that receive it keep their identity.
  return useMemo(() => ({ setStage: mutate, isPending }), [mutate, isPending]);
}
