"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

/** Shape of an error returned by the API contract (src/lib/api-response.ts). */
type ApiErrorBody = {
  error?: string;
  code?: string;
  details?: { field: string; code: string; message: string }[];
  requestId?: string;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: ApiErrorBody["details"],
    readonly requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Perform a mutating request against the API.
 *
 * Understands the response contract, so callers get a typed `ApiError` with a
 * machine-readable `code` instead of having to guess from a status.
 */
export async function apiFetch<T>(
  url: string,
  init: RequestInit & { method: "POST" | "PUT" | "PATCH" | "DELETE" }
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const body = (await res.json().catch(() => null)) as
    | (ApiErrorBody & { data?: T })
    | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error ?? "تعذّر إتمام العملية",
      body?.code,
      body?.details,
      body?.requestId ?? res.headers.get("x-request-id") ?? undefined
    );
  }

  return (body?.data ?? body) as T;
}

type UseMutationOptions<T> = {
  /** Toast shown on success. Pass `null` to stay silent. */
  successMessage?: string | null;
  /** Called after a successful call — use it to refetch. */
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
};

/**
 * Mutation helper: pending state, typed errors, and success/error toasts.
 *
 * The app had no toast system and no shared mutation path, so every write
 * either succeeded or failed invisibly. Every wired action should go through
 * this.
 */
export function useMutation<T = unknown, TArgs extends unknown[] = unknown[]>(
  fn: (...args: TArgs) => Promise<T>,
  options: UseMutationOptions<T> = {}
) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // Guards against setting state after the component unmounts mid-request.
  const mountedRef = useRef(true);

  const mutate = useCallback(
    async (...args: TArgs): Promise<T | undefined> => {
      setIsPending(true);
      setError(null);
      try {
        const data = await fn(...args);
        if (options.successMessage !== null) {
          toast.success(options.successMessage ?? "تمت العملية بنجاح");
        }
        options.onSuccess?.(data);
        return data;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError(0, err instanceof Error ? err.message : "تعذّر إتمام العملية");

        if (mountedRef.current) setError(apiError);

        // Field-level detail is far more useful than a generic failure toast.
        const detail = apiError.details?.[0];
        toast.error(detail ? `${detail.field}: ${detail.message}` : apiError.message, {
          description: apiError.requestId ? `#${apiError.requestId.slice(0, 8)}` : undefined,
        });

        options.onError?.(apiError);
        return undefined;
      } finally {
        if (mountedRef.current) setIsPending(false);
      }
    },
    [fn, options]
  );

  return { mutate, isPending, error };
}
