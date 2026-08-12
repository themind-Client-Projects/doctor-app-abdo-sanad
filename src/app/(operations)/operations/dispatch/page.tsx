"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Check,
  FlaskConical,
  HeartPulse,
  Pill as PillIcon,
  ScanLine,
  Send,
  Stethoscope,
  Truck,
} from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useOrderActions, type AssignTarget } from "@/hooks/use-order-actions";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader, Pill, toneForStatus } from "@/components/data/crud-kit";
import {
  ORDER_PRIORITY_LABELS,
  PARTNER_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  labelOf,
  optionsOf,
} from "@/lib/labels";
import { formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// مركز توزيع المهام (req L324-382)
//
// Rewritten for two reasons.
//
// 1. The buttons did nothing. POST /api/orders/[id]/assign has always existed;
//    "تعيين المهمة" was a `<button>` with no handler, so no order could be
//    dispatched from the dispatch centre.
//
// 2. Assignment needs an ORDER. The screen listed providers with an assign
//    button that had no order in hand — there was nothing it could have sent.
//    So the order comes first: choose what to dispatch, then choose who.
//
// Columns are the ones Partner actually holds. The previous version read
// `currentTasks`, `lastSeen`, `vehicleType`, `responseTime`, `workingHours`,
// `equipmentType`, `nextSlot`, `reportTime`, `availability` and `hasDelivery`
// off a `Record<string, unknown>` — not one of those is a field on Partner, so
// every one of those columns printed "—" on every row. Of that list only the
// workload is real, and it is now computed server-side as `activeOrders`.
// ─────────────────────────────────────────────────────────────

type Partner = {
  id: string;
  name: string;
  phone: string;
  type: string;
  status: string;
  rating: number;
  totalTasks: number;
  /** Open orders held right now — computed by the API under `?withLoad=1`. */
  activeOrders: number;
  address: string | null;
  governorate: { id: string; name: string } | null;
  complex: { id: string; name: string } | null;
};

type DispatchOrder = {
  id: string;
  orderNumber: string;
  patientName: string;
  serviceType: string;
  status: string;
  priority: string;
  area: string | null;
  address: string | null;
  governorate: { name: string } | null;
  assignedNurseId: string | null;
  assignedDriverId: string | null;
  assignedLabId: string | null;
  assignedPharmacyId: string | null;
  assignedRadiologyId: string | null;
  assignedDoctorId: string | null;
};

type Slot = {
  key: AssignTarget;
  /** Partner.type this slot accepts — the server rejects any mismatch. */
  partnerType: string;
  label: string;
  action: string;
  icon: typeof HeartPulse;
  /** Which column on the order records this slot's assignment. */
  field: keyof Pick<
    DispatchOrder,
    | "assignedNurseId"
    | "assignedDriverId"
    | "assignedLabId"
    | "assignedPharmacyId"
    | "assignedRadiologyId"
    | "assignedDoctorId"
  >;
};

const SLOTS: readonly Slot[] = [
  {
    key: "doctor",
    partnerType: "DOCTOR",
    label: "الأطباء",
    action: "تعيين الطبيب",
    icon: Stethoscope,
    field: "assignedDoctorId",
  },
  {
    key: "nurse",
    partnerType: "NURSE",
    label: "الممرضين",
    action: "تعيين المهمة",
    icon: HeartPulse,
    field: "assignedNurseId",
  },
  {
    key: "driver",
    partnerType: "DRIVER",
    label: "السائقين",
    action: "إرسال المهمة",
    icon: Truck,
    field: "assignedDriverId",
  },
  {
    key: "lab",
    partnerType: "LAB",
    label: "المختبرات",
    action: "اعتماد المختبر",
    icon: FlaskConical,
    field: "assignedLabId",
  },
  {
    key: "radiology",
    partnerType: "RADIOLOGY",
    label: "مراكز الأشعة",
    action: "إحالة للأشعة",
    icon: ScanLine,
    field: "assignedRadiologyId",
  },
  {
    key: "pharmacy",
    partnerType: "PHARMACY",
    label: "الصيدليات",
    action: "إرسال للصيدلية",
    icon: PillIcon,
    field: "assignedPharmacyId",
  },
];

/** Statuses the server will accept an assignment for — mirrors `allowedActions`. */
const DISPATCHABLE = "ACCEPTED,ASSIGNED,DELAYED";

export default function DispatchPage() {
  const [slotKey, setSlotKey] = useState<AssignTarget>("nurse");
  const [orderId, setOrderId] = useState("");

  const slot = useMemo(() => SLOTS.find((s) => s.key === slotKey) ?? SLOTS[0], [slotKey]);

  const {
    data: orders,
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useDashboardData<DispatchOrder[]>({
    url: "/api/orders",
    params: { status: DISPATCHABLE, limit: "100" },
    refreshInterval: 30_000,
  });

  // One request per tab, and only for the visible tab — the five provider
  // tables are never on screen together.
  const {
    data: partners,
    isLoading,
    error,
    refetch,
  } = useDashboardData<Partner[]>({
    url: "/api/partners",
    params: { type: slot.partnerType, status: "ACTIVE", withLoad: "1", limit: "100" },
  });

  const selected = useMemo(
    () => (orders ?? []).find((o) => o.id === orderId) ?? null,
    [orders, orderId]
  );

  const afterAssign = useCallback(() => {
    void refetchOrders();
    void refetch();
  }, [refetchOrders, refetch]);

  const { assign, isPending } = useOrderActions(afterAssign);

  // Who currently holds this slot on the selected order, so the table can mark
  // them instead of offering the same assignment again.
  const assignedId = selected ? selected[slot.field] : null;

  const columns: Column<Partner>[] = useMemo(
    () => [
      {
        key: "name",
        header: "الاسم",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.name}</p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {r.phone}
            </p>
          </div>
        ),
        sortValue: (r) => r.name,
      },
      {
        key: "location",
        header: "الموقع",
        render: (r) => (
          <span className="text-xs text-muted-foreground">
            {[r.governorate?.name, r.address].filter(Boolean).join(" - ") || "—"}
          </span>
        ),
        sortValue: (r) => r.governorate?.name ?? "",
      },
      {
        key: "complex",
        header: "المجمع",
        secondary: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground">{r.complex?.name ?? "—"}</span>
        ),
      },
      {
        key: "activeOrders",
        header: "المهام الحالية",
        align: "end",
        render: (r) => (
          <span
            className={`tabular-nums ${
              r.activeOrders === 0
                ? "text-emerald-600 dark:text-emerald-400"
                : r.activeOrders >= 5
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-foreground"
            }`}
          >
            {formatNumber(r.activeOrders)}
          </span>
        ),
        sortValue: (r) => r.activeOrders,
      },
      {
        key: "totalTasks",
        header: "إجمالي المهام",
        secondary: true,
        align: "end",
        render: (r) => formatNumber(r.totalTasks),
        sortValue: (r) => r.totalTasks,
      },
      {
        key: "rating",
        header: "التقييم",
        render: (r) =>
          // A partner with no completed work has rating 0, which is not a bad
          // score — it is no score. Saying "0.0 ★" would libel a new nurse.
          r.rating > 0 ? (
            <span className="tabular-nums text-foreground">{r.rating.toFixed(1)} ★</span>
          ) : (
            <span className="text-xs text-muted-foreground">لا تقييم بعد</span>
          ),
        sortValue: (r) => r.rating,
      },
      {
        key: "status",
        header: "الحالة",
        render: (r) => (
          <Pill tone={toneForStatus(r.status)}>{labelOf(PARTNER_STATUS_LABELS, r.status)}</Pill>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="مركز توزيع المهام"
        subtitle="اختر الطلب أولاً، ثم عيّن المنفّذ — الممرضين، السائقين، المختبرات، الأشعة، الصيدليات"
        icon={Send}
      />

      <OrderPicker
        orders={orders ?? []}
        isLoading={ordersLoading}
        value={orderId}
        onChange={setOrderId}
        selected={selected}
      />

      <div className="flex gap-1 overflow-x-auto pb-1 hide-scrollbar" role="tablist">
        {SLOTS.map((s) => {
          const Icon = s.icon;
          const active = s.key === slotKey;
          const filled = selected ? selected[s.field] !== null : false;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSlotKey(s.key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon size={16} />
              {s.label}
              {/* A tick on the tab, so a multi-party order shows at a glance
                  which slots are still open. */}
              {filled ? <Check size={13} className={active ? "" : "text-emerald-500"} /> : null}
            </button>
          );
        })}
      </div>

      <DataTable
        rows={partners}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.name} ${r.phone} ${r.governorate?.name ?? ""} ${r.complex?.name ?? ""}`}
        searchPlaceholder="بحث بالاسم أو الهاتف أو المحافظة..."
        filters={[
          {
            key: "load",
            label: "كل الأحمال",
            options: [
              { value: "free", label: "متاح الآن" },
              { value: "busy", label: "لديه مهام" },
            ],
            match: (r, v) => (v === "free" ? r.activeOrders === 0 : r.activeOrders > 0),
          },
          {
            key: "status",
            label: "كل الحالات",
            options: optionsOf(PARTNER_STATUS_LABELS),
            match: (r, v) => r.status === v,
          },
        ]}
        emptyMessage={`لا يوجد ${slot.label} مفعّلون`}
        actions={(r) =>
          r.id === assignedId ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check size={12} />
              معيَّن لهذا الطلب
            </span>
          ) : (
            <button
              type="button"
              // Disabled rather than hidden with no order: the employee needs to
              // see that dispatch is possible and what is missing.
              disabled={!selected || isPending}
              onClick={() => selected && void assign(selected.id, slot.key, r.id)}
              aria-label={`${slot.action} — ${r.name}`}
              title={selected ? undefined : "اختر طلباً أولاً"}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={12} />
              {slot.action}
            </button>
          )
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function OrderPicker({
  orders,
  isLoading,
  value,
  onChange,
  selected,
}: {
  orders: DispatchOrder[];
  isLoading: boolean;
  value: string;
  onChange: (id: string) => void;
  selected: DispatchOrder | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <label
        htmlFor="dispatch-order"
        className="mb-1.5 block text-sm font-medium text-foreground"
      >
        الطلب المراد توزيعه
      </label>

      <select
        id="dispatch-order"
        value={value}
        disabled={isLoading}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] disabled:opacity-60"
      >
        <option value="">
          {isLoading
            ? "جارِ التحميل..."
            : orders.length === 0
              ? "لا توجد طلبات بانتظار التوزيع"
              : "— اختر طلباً —"}
        </option>
        {orders.map((o) => (
          <option key={o.id} value={o.id}>
            #{o.orderNumber.slice(-8)} · {o.patientName} ·{" "}
            {labelOf(SERVICE_TYPE_LABELS, o.serviceType)}
          </option>
        ))}
      </select>

      {selected ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Pill tone={selected.priority === "NORMAL" ? "neutral" : "danger"}>
            {labelOf(ORDER_PRIORITY_LABELS, selected.priority)}
          </Pill>
          <span className="text-sm text-foreground">{selected.patientName}</span>
          <span className="text-xs text-muted-foreground">
            {[selected.governorate?.name, selected.area, selected.address]
              .filter(Boolean)
              .join(" - ") || "لا يوجد عنوان"}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          يُعرض هنا الطلبات المقبولة والمُسندة والمعلّقة فقط — غيرها لا يقبل التعيين.
        </p>
      )}
    </div>
  );
}
