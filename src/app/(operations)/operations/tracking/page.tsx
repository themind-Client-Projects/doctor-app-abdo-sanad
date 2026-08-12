"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeDollarSign, CheckCircle2, Loader2, Phone, Route, Search } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useOrderActions } from "@/hooks/use-order-actions";
import { Timeline, type LadderStep } from "@/components/shared/timeline";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, toneForStatus } from "@/components/data/crud-kit";
import { ORDER_STATUS_LABELS, SERVICE_TYPE_LABELS, labelOf } from "@/lib/labels";
import { formatCurrency, formatRelative } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// متابعة التنفيذ (req L384-407) — 11 خطوة
//
// The ladder was read-only: eleven steps rendered, none recordable, so an order
// that reached "تم التواصل" stayed there forever. It also read `assignedTo` off
// the order — not a column — so every card said "غير معين" even for a fully
// dispatched order, and the timeline came from the list endpoint's raw rows,
// which carry no completion flag.
//
// Now: the list gives the queue, and the selected order is fetched in full
// (assignees, amount) alongside its ladder from /advance.
// ─────────────────────────────────────────────────────────────

/** Everything still in flight — an accepted-but-unassigned order is trackable too. */
const OPEN_STATUSES = "ACCEPTED,ASSIGNED,IN_TRANSIT,ARRIVED,IN_PROGRESS,DELAYED";

type QueueOrder = {
  id: string;
  orderNumber: string;
  patientName: string;
  patientPhone: string;
  serviceType: string;
  status: string;
  priority: string;
  createdAt: string;
};

type Assignee = { id: string; name: string; phone: string } | null;

type OrderDetail = QueueOrder & {
  totalAmount: number | string | null;
  paymentStatus: string;
  area: string | null;
  address: string | null;
  governorate: { name: string } | null;
  assignedNurse: Assignee;
  assignedDriver: Assignee;
  assignedLab: Assignee;
  assignedPharmacy: Assignee;
  assignedRadiology: Assignee;
};

const ASSIGNEE_LABELS: { key: keyof OrderDetail; label: string }[] = [
  { key: "assignedNurse", label: "الممرض" },
  { key: "assignedDriver", label: "السائق" },
  { key: "assignedLab", label: "المختبر" },
  { key: "assignedRadiology", label: "الأشعة" },
  { key: "assignedPharmacy", label: "الصيدلية" },
];

export default function TrackingPage() {
  // `useSearchParams` suspends during prerender; the boundary keeps the rest of
  // the route from being pulled into that wait.
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <TrackingView />
    </Suspense>
  );
}

function TrackingView() {
  const params = useSearchParams();
  // Deep link from the orders screen's "فتح التفاصيل".
  const initialId = params.get("order");

  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [search, setSearch] = useState("");

  // The link is only an initial value, but the user can navigate back to the
  // same route with a different id, and the state would otherwise stick.
  useEffect(() => {
    if (initialId) setSelectedId(initialId);
  }, [initialId]);

  const {
    data: orders,
    isLoading,
    refetch: refetchQueue,
  } = useDashboardData<QueueOrder[]>({
    url: "/api/orders",
    params: { status: OPEN_STATUSES, limit: "100" },
    refreshInterval: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders ?? [];
    return (orders ?? []).filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.patientName.toLowerCase().includes(q) ||
        o.patientPhone.includes(q)
    );
  }, [orders, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="متابعة التنفيذ"
        subtitle="١١ خطوة لكل طلب — من الإنشاء حتى الاكتمال والتسوية"
        icon={Route}
      />

      <div className="relative max-w-md">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground start-3"
        />
        <input
          type="search"
          aria-label="بحث في الطلبات الجارية"
          placeholder="بحث برقم الطلب أو المريض أو الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background text-sm text-foreground outline-none transition-colors ps-9 pe-4 focus:border-[hsl(var(--primary))]"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {isLoading ? (
            [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
              {search ? "لا نتائج مطابقة للبحث" : "لا توجد طلبات قيد التنفيذ"}
            </p>
          ) : (
            filtered.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedId(order.id)}
                aria-pressed={selectedId === order.id}
                className={`w-full rounded-xl border p-4 text-start transition-colors ${
                  selectedId === order.id
                    ? "border-[hsl(var(--primary))] bg-primary/5"
                    : "border-border bg-card hover:bg-accent/40"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-primary" dir="ltr">
                    #{order.orderNumber.slice(-8)}
                  </span>
                  <Pill tone={toneForStatus(order.status)}>{labelOf(ORDER_STATUS_LABELS, order.status)}</Pill>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-foreground">
                    {order.patientName} · {labelOf(SERVICE_TYPE_LABELS, order.serviceType)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(order.createdAt)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          {selectedId ? (
            <OrderTrack key={selectedId} orderId={selectedId} onChanged={refetchQueue} />
          ) : (
            <p className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
              اختر طلباً لعرض مراحل التنفيذ
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * One order's detail and ladder.
 *
 * A separate component keyed by id, so selecting another order remounts it and
 * no state from the previous order can survive into the new one.
 */
function OrderTrack({ orderId, onChanged }: { orderId: string; onChanged: () => void }) {
  const {
    data: order,
    isLoading: orderLoading,
    refetch: refetchOrder,
  } = useDashboardData<OrderDetail>({ url: `/api/orders/${orderId}` });

  const {
    data: ladder,
    isLoading: ladderLoading,
    refetch: refetchLadder,
  } = useDashboardData<LadderStep[]>({ url: `/api/orders/${orderId}/advance` });

  const afterAction = useCallback(() => {
    void refetchOrder();
    void refetchLadder();
    onChanged();
  }, [refetchOrder, refetchLadder, onChanged]);

  const { advance, complete, price, isPending } = useOrderActions(afterAction);

  const [pricing, setPricing] = useState(false);
  const [coupon, setCoupon] = useState("");

  const onAdvance = useCallback(
    (code: LadderStep["code"]) => void advance(orderId, code),
    [advance, orderId]
  );

  const steps = ladder ?? [];
  // Completion refuses an unpriced order, so the amount has to be resolvable
  // from here — otherwise the flow dead-ends on a 422 with nothing to click.
  const isPriced = order?.totalAmount !== null && order?.totalAmount !== undefined;
  // The 10th rung done and the 11th not: everything is delivered and only the
  // settlement remains.
  const readyToComplete =
    steps.length > 0 && steps[steps.length - 2]?.completed && !steps[steps.length - 1]?.completed;

  if (orderLoading || ladderLoading) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (!order) {
    return (
      <p className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
        تعذّر تحميل الطلب
      </p>
    );
  }

  const assignees = ASSIGNEE_LABELS.map((a) => ({
    label: a.label,
    partner: order[a.key] as Assignee,
  })).filter((a) => a.partner !== null);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">
        تتبع الطلب <span dir="ltr">#{order.orderNumber.slice(-8)}</span>
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {order.patientName} · {labelOf(SERVICE_TYPE_LABELS, order.serviceType)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Pill tone={toneForStatus(order.status)}>{labelOf(ORDER_STATUS_LABELS, order.status)}</Pill>
        <Pill tone={order.paymentStatus === "PAID" ? "positive" : "warning"}>
          {order.totalAmount === null ? "لم يُسعّر" : formatCurrency(order.totalAmount)}
        </Pill>
        {order.totalAmount === null ? (
          <button
            type="button"
            onClick={() => {
              setCoupon("");
              setPricing(true);
            }}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
          >
            <BadgeDollarSign size={12} aria-hidden />
            تسعير الطلب
          </button>
        ) : null}
      </div>

      {assignees.length > 0 ? (
        <dl className="space-y-1.5 border-b border-border py-4">
          {assignees.map((a) => (
            <div key={a.label} className="flex items-center justify-between gap-2 text-xs">
              <dt className="text-muted-foreground">{a.label}</dt>
              <dd className="flex items-center gap-2 text-foreground">
                {a.partner!.name}
                <a
                  href={`tel:${a.partner!.phone}`}
                  aria-label={`اتصال بـ ${a.partner!.name}`}
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  <Phone size={12} />
                </a>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="border-b border-border py-4 text-xs text-muted-foreground">
          لم يُعيَّن منفّذ بعد — عيّنه من مركز توزيع المهام.
        </p>
      )}

      <div className="pt-4">
        <Timeline
          steps={steps}
          onAdvance={onAdvance}
          isPending={isPending}
          frozen={order.status === "CANCELLED" || order.status === "COMPLETED"}
        />
      </div>

      {readyToComplete ? (
        <button
          type="button"
          onClick={() => void complete(orderId)}
          // An unpriced order cannot be completed — the button says why rather
          // than sending a request that is guaranteed to fail.
          disabled={isPending || !isPriced}
          title={isPriced ? undefined : "يجب تسعير الطلب أولاً"}
          className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          إكمال الطلب وتوزيع الإيراد
        </button>
      ) : null}

      <FormDialog
        open={pricing}
        title="تسعير الطلب"
        description={`يُحتسب المبلغ من قائمة الأسعار حسب الخدمة والواجهة — ${labelOf(
          SERVICE_TYPE_LABELS,
          order.serviceType
        )}`}
        submitLabel="تسعير"
        onClose={() => setPricing(false)}
        onSubmit={() => {
          void price(orderId, coupon.trim() || undefined);
          setPricing(false);
        }}
        isPending={isPending}
      >
        <Field label="كود الخصم" htmlFor="coupon" hint="اختياري — يُستهلك عند التسعير">
          <input
            id="coupon"
            dir="ltr"
            className={fieldClass}
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            placeholder="WELCOME10"
          />
        </Field>
      </FormDialog>
    </div>
  );
}
