"use client";

import { useCallback, useMemo, useState } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";

/**
 * The referral screen's data and actions, in one hook.
 *
 * The page underneath renders; everything about WHICH list is showing, what a
 * send or a reply does, and when to refetch lives here. That split is what
 * keeps the page from re-implementing the four `fetch` calls by hand — the
 * pattern that produced the six dead `/api/dashboard/*` URLs elsewhere.
 *
 * Nothing here decides permission: `direction` arrives from the server on every
 * row, so the UI never derives "is this mine" from a partner id it holds.
 */

export type ReferralDirection = "incoming" | "outgoing" | "observed";

export type ReferralParty = {
  id: string;
  name: string;
  type: string;
  phone: string | null;
};

export type ReferralAttachment = { url: string; name: string };

export type Referral = {
  id: string;
  /** `RAD-2024-05120` — computed server-side from the sequence. */
  referenceNumber: string;
  kind: string;
  priority: string;
  expiresAt: string | null;
  isExpired: boolean;
  /** The document's own fields. Shape depends on `kind`. */
  clinical: Record<string, unknown>;
  /** The printed track: one entry per stage, with the time it happened. */
  events: { id: string; status: string; at: string; note: string | null }[];
  status: string;
  title: string;
  description: string | null;
  serviceType: string | null;
  patientId: string;
  patientName: string;
  patientPhone: string;
  resultSummary: string | null;
  attachments: unknown;
  respondedAt: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
  fromPartner: ReferralParty;
  toPartner: ReferralParty;
  complex: { id: string; name: string };
  direction: ReferralDirection;
  /** إعادة الإحالة — the document this one continues, and what came out of it. */
  parent: ReferralChainLink | null;
  children: ReferralChainLink[];
};

/**
 * A neighbour in the chain — enough to name and link it, and nothing more.
 *
 * Deliberately carries no result, clinical payload or attachments: the
 * recipient of a re-referral is not a party to its parent and has no right to
 * read it. The re-referral form gets that context from the sender's own row.
 */
export type ReferralChainLink = {
  id: string;
  referenceNumber: string;
  kind: string;
  status: string;
  createdAt: string;
  toPartner: { id: string; name: string; type: string };
};

export type RecipientsPayload = {
  complex: { id: string; name: string; isOwner: boolean } | null;
  recipients: ReferralParty[];
};

/** `attachments` is a Json column — one malformed row must not break the list. */
export function readAttachments(value: unknown): ReferralAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    item &&
    typeof item === "object" &&
    typeof (item as ReferralAttachment).url === "string" &&
    typeof (item as ReferralAttachment).name === "string"
      ? [item as ReferralAttachment]
      : []
  );
}

export type ReferralBox = "inbox" | "outbox" | "all";

export type SendReferralInput = {
  /** Which of the four documents — decides the required clinical fields. */
  kind: string;
  toPartnerId: string;
  patientId: string;
  title: string;
  description?: string;
  /** عادي / مهم / عاجل. */
  priority?: string;
  /** The document's own fields, validated server-side against `kind`. */
  clinical?: unknown;
  /**
   * إعادة الإحالة — the referral this one continues.
   *
   * The ONLY thing carried over. `kind`, the recipient, the title and above all
   * `clinical` are re-authored: a copied "لا حساسية من الصبغة" would read as an
   * answer given today when nobody was asked.
   */
  parentId?: string;
};

export type RespondInput = {
  status?: string;
  resultSummary?: string;
  attachments?: ReferralAttachment[];
};

export function useReferrals(initialBox: ReferralBox = "inbox") {
  const [box, setBox] = useState<ReferralBox>(initialBox);
  const [stage, setStage] = useState<string | null>(null);

  const list = useDashboardData<Referral[]>({
    url: "/api/referrals",
    params: { box, limit: "100" },
    // A referral is someone waiting on an answer, so the list should not need a
    // manual reload to show one arriving.
    refreshInterval: 30_000,
  });

  // Who I may refer to — also the answer to "am I in a complex at all", which
  // decides whether the send form is offered.
  const context = useDashboardData<RecipientsPayload>({ url: "/api/referrals/recipients" });

  const refresh = useCallback(() => void list.refetch(), [list]);

  const send = useMutation(
    (input: SendReferralInput) =>
      apiFetch<Referral>("/api/referrals", { method: "POST", body: JSON.stringify(input) }),
    { successMessage: "تم إرسال الإحالة", onSuccess: refresh }
  );

  const respond = useMutation(
    (id: string, input: RespondInput) =>
      apiFetch<Referral>(`/api/referrals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    { successMessage: "تم تحديث الإحالة", onSuccess: refresh }
  );

  const rows = useMemo(() => {
    const all = list.data ?? [];
    return stage ? all.filter((r) => r.status === stage) : all;
  }, [list.data, stage]);

  return {
    box,
    setBox,
    stage,
    setStage,
    rows,
    all: list.data ?? [],
    isLoading: list.isLoading,
    error: list.error,
    refetch: list.refetch,
    complex: context.data?.complex ?? null,
    recipients: context.data?.recipients ?? [],
    isContextLoading: context.isLoading,
    send: send.mutate,
    isSending: send.isPending,
    respond: respond.mutate,
    isResponding: respond.isPending,
  };
}

/** "My patients", reused for the referral form's patient picker. */
export type ReferablePatient = {
  id: string;
  name: string | null;
  phone: string | null;
  lastVisit: string | null;
};

export function useMyPatients(enabled = true) {
  const { data, isLoading } = useDashboardData<ReferablePatient[]>({
    url: "/api/dashboard/patients",
    enabled,
  });
  return { patients: data ?? [], isLoading };
}
