"use client";

import { useCallback, useMemo, useState } from "react";
import { Clock, FileText, Phone, PhoneCall } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, StatTile } from "@/components/data/crud-kit";
import { SERVICE_TYPE_LABELS, labelOf, optionsOf } from "@/lib/labels";
import { formatDateTime, formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// إدارة الاتصالات (req L421-431) — اتصال مباشر، بدون VoIP
//
// The five target cards were `<a href="tel:">` — a colon with no number after
// it, so every one of them dialled nobody. They were also static: five cards
// that never referred to a particular order, and therefore to a particular
// person. Now a call target belongs to an order, and its number is the real one.
//
// The log table read `target`, `phone`, `duration` (as text) and `timestamp`;
// CallLog has `receiver`, `receiverType`, `duration` in seconds and `createdAt`,
// so four of the five columns were blank. "مدة المكالمات" was hardcoded "—".
// ─────────────────────────────────────────────────────────────

const RECEIVER_LABELS: Record<string, string> = {
  PATIENT: "المريض",
  NURSE: "الممرض",
  DRIVER: "السائق",
  LAB: "المختبر",
  PHARMACY: "الصيدلية",
  RADIOLOGY: "مركز الأشعة",
};

type CallLog = {
  id: string;
  orderId: string | null;
  receiverType: string;
  duration: number | null;
  notes: string | null;
  createdAt: string;
  caller: { name: string | null } | null;
  receiver: { name: string | null } | null;
};

type Contact = {
  userId: string;
  name: string;
  phone: string;
  type: string;
  label: string;
};

type ActiveOrder = {
  id: string;
  orderNumber: string;
  patientName: string;
  serviceType: string;
};

/** Seconds → m:ss. `duration` is stored in seconds, not as a display string. */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${formatNumber(m)}:${String(s).padStart(2, "0")}`;
}

/** Open orders — the ones an employee has a reason to ring about. */
const OPEN_STATUSES = "NEW,ACCEPTED,ASSIGNED,IN_TRANSIT,ARRIVED,IN_PROGRESS,DELAYED";

export default function CallsPage() {
  const { data: logs, isLoading, error, refetch } = useDashboardData<CallLog[]>({
    url: "/api/call-logs",
    params: { limit: "100" },
  });

  const { data: orders } = useDashboardData<ActiveOrder[]>({
    url: "/api/orders",
    params: { status: OPEN_STATUSES, limit: "100" },
  });

  const [orderId, setOrderId] = useState("");
  const [logging, setLogging] = useState<Contact | null>(null);
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");

  // Only fetched once an order is chosen — there are no contacts without one.
  const { data: contacts, isLoading: contactsLoading } = useDashboardData<Contact[]>(
    orderId ? { url: `/api/orders/${orderId}/contacts` } : { url: "" }
  );

  const close = useCallback(() => {
    setLogging(null);
    setDuration("");
    setNotes("");
  }, []);

  const done = useCallback(() => {
    close();
    void refetch();
  }, [close, refetch]);

  const { mutate: logCall, isPending: saving } = useMutation(
    async (body: Record<string, unknown>) =>
      apiFetch("/api/call-logs", { method: "POST", body: JSON.stringify(body) }),
    { successMessage: "تم تسجيل المكالمة", onSuccess: done }
  );

  const totals = useMemo(() => {
    const rows = logs ?? [];
    let seconds = 0;
    let withNotes = 0;
    for (const l of rows) {
      seconds += l.duration ?? 0;
      if (l.notes && l.notes.trim()) withNotes += 1;
    }
    return { count: rows.length, seconds, withNotes };
  }, [logs]);

  const columns: Column<CallLog>[] = useMemo(
    () => [
      {
        key: "receiver",
        header: "الجهة",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.receiver?.name ?? "—"}</p>
            <Pill tone="info">{labelOf(RECEIVER_LABELS, r.receiverType)}</Pill>
          </div>
        ),
        sortValue: (r) => r.receiver?.name ?? "",
      },
      {
        key: "caller",
        header: "الموظف",
        secondary: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground">{r.caller?.name ?? "—"}</span>
        ),
        sortValue: (r) => r.caller?.name ?? "",
      },
      {
        key: "duration",
        header: "المدة",
        align: "end",
        render: (r) => (
          <span className="tabular-nums text-foreground" dir="ltr">
            {formatDuration(r.duration)}
          </span>
        ),
        sortValue: (r) => r.duration ?? -1,
      },
      {
        key: "notes",
        header: "الملاحظات",
        render: (r) => (
          <span className="line-clamp-2 text-xs text-muted-foreground">{r.notes || "—"}</span>
        ),
      },
      {
        key: "createdAt",
        header: "الوقت",
        secondary: true,
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(r.createdAt)}
          </span>
        ),
        sortValue: (r) => new Date(r.createdAt).getTime(),
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة الاتصالات"
        subtitle="اتصال مباشر عبر الهاتف — اختر الطلب ثم الجهة، وسجّل الملاحظات بعد المكالمة"
        icon={Phone}
      />

      <div className="rounded-xl border border-border bg-card p-4">
        <label htmlFor="call-order" className="mb-1.5 block text-sm font-medium text-foreground">
          الطلب
        </label>
        <select
          id="call-order"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-[hsl(var(--primary))]"
        >
          <option value="">— اختر طلباً لعرض جهات الاتصال —</option>
          {(orders ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              #{o.orderNumber.slice(-8)} · {o.patientName} ·{" "}
              {labelOf(SERVICE_TYPE_LABELS, o.serviceType)}
            </option>
          ))}
        </select>

        {orderId ? (
          contactsLoading ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {(contacts ?? []).map((c) => (
                <div
                  key={`${c.type}-${c.userId}`}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3.5 text-center"
                >
                  <span className="text-xs font-semibold text-foreground">{c.label}</span>
                  <span className="truncate text-xs text-muted-foreground" title={c.name}>
                    {c.name}
                  </span>
                  <a
                    href={`tel:${c.phone}`}
                    aria-label={`اتصال بـ ${c.label} ${c.name}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    dir="ltr"
                  >
                    <PhoneCall size={11} aria-hidden />
                    {c.phone}
                  </a>
                  <button
                    type="button"
                    onClick={() => setLogging(c)}
                    className="mt-0.5 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    تسجيل المكالمة
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            جهات الاتصال تُشتق من الطلب: المريض والمنفّذون المعيَّنون عليه.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="سجل المكالمات" value={formatNumber(totals.count)} icon={FileText} />
        <StatTile
          label="مدة المكالمات"
          value={formatDuration(totals.seconds)}
          hint="دقيقة:ثانية"
          icon={Clock}
        />
        <StatTile
          label="مكالمات بملاحظات"
          value={formatNumber(totals.withNotes)}
          icon={FileText}
        />
      </div>

      <DataTable
        rows={logs}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.receiver?.name ?? ""} ${r.caller?.name ?? ""} ${r.notes ?? ""}`}
        searchPlaceholder="بحث بالجهة أو الملاحظات..."
        filters={[
          {
            key: "receiverType",
            label: "كل الجهات",
            options: optionsOf(RECEIVER_LABELS),
            match: (r, v) => r.receiverType === v,
          },
        ]}
        emptyMessage="لا توجد مكالمات مسجلة"
      />

      <FormDialog
        open={logging !== null}
        title="تسجيل المكالمة"
        description={logging ? `${logging.label} · ${logging.name} · ${logging.phone}` : undefined}
        submitLabel="تسجيل"
        onClose={close}
        onSubmit={() => {
          if (!logging) return;
          const seconds = Number(duration);
          void logCall({
            orderId,
            receiverId: logging.userId,
            receiverType: logging.type,
            // Omitted rather than sent as 0 — an unrecorded duration is not a
            // zero-second call.
            ...(duration.trim() && Number.isFinite(seconds) && seconds >= 0
              ? { duration: Math.round(seconds) }
              : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          });
        }}
        isPending={saving}
      >
        <Field label="مدة المكالمة (ثانية)" htmlFor="call-duration" hint="اختياري">
          <input
            id="call-duration"
            type="number"
            min={0}
            dir="ltr"
            className={fieldClass}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </Field>
        <Field label="ملاحظات بعد المكالمة" htmlFor="call-notes" hint="اختياري">
          <textarea
            id="call-notes"
            rows={3}
            className={fieldClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="المريض أكد الموعد، سيكون في المنزل بعد الساعة ٤"
          />
        </Field>
      </FormDialog>
    </div>
  );
}
