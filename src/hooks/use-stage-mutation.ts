"use client";

import { useMemo } from "react";
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
export function useStageMutation(basePath: string, onDone: () => void) {
  const { mutate, isPending } = useMutation(
    async (id: string, status: string) =>
      apiFetch(`${basePath}/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    { successMessage: "تم تحديث الحالة", onSuccess: onDone }
  );

  // Memoized so the memoized table rows that receive it keep their identity.
  return useMemo(() => ({ setStage: mutate, isPending }), [mutate, isPending]);
}
