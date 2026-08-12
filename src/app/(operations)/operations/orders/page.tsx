"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Check, Eye, Pause, X } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { allowedActions, useOrderActions } from "@/hooks/use-order-actions";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill, toneForStatus } from "@/components/data/crud-kit";
import {
  CHANNEL_LABELS,
  ORDER_PRIORITY_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  SERVICE_TYPE_LABELS,
  labelOf,
  optionsOf,
} from "@/lib/labels";
import { formatCurrency, formatRelative } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// الطلبات (req L300-322) — 12 حقلاً و5 أزرار.
//
// The screen listed orders and could do NOTHING to them: قبول، رفض، تعليق and
// تحويل all existed as endpoints and none had a button, so an employee could
// watch the queue grow without touching it.
//
// It also carried its own `serviceLabels` keyed on ONLINE / IN_PERSON / X_RAY —
// none of which are members of the `ServiceType` enum — so every row rendered
// its raw key. Same defect as the admin services screen, same fix: import the
// one map.
// ─────────────────────────────────────────────────────────────

type Order = {
  id: string;
  orderNumber: string;
  patientName: string;
  patientPhone: string;
  serviceType: string;
  status: string;
  priority: string;
  source: string;
  area: string | null;
  address: string | null;
  /** Prisma `Decimal` — arrives over JSON as a string, never a number. */
  totalAmount: number | string | null;
  paymentMethod: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
  governorate: { name: string } | null;
};

type Employee = { id: string; name: string | null; role: string };

/** Critical first — the point of a priority column is that it sorts. */
const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, URGENT: 1, NORMAL: 2 };

export default function OperationsOrdersPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Order[]>({
    url: "/api/orders",
    params: { limit: "100" },
    // A live queue: a new order matters within a minute, and the employee
    // should not have to reload to see it.
    refreshInterval: 30_000,
  });

  // Staff a request can be handed to. Loaded once, not per row — a dropdown
  // rebuilt on every row render would fetch as many times as there are orders.
  const { data: employees } = useDashboardData<Employee[]>({ url: "/api/users/staff" });

  const [rejecting, setRejecting] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const [transferring, setTransferring] = useState<Order | null>(null);
  const [targetEmployee, setTargetEmployee] = useState("");

  const close = useCallback(() => {
    setRejecting(null);
    setTransferring(null);
    setReason("");
    setTargetEmployee("");
  }, []);

  const refresh = useCallback(() => void refetch(), [refetch]);
  const actions = useOrderActions(refresh);

  const orders = useMemo(() => data ?? [], [data]);

  const columns: Column<Order>[] = useMemo(
    () => [
      {
        key: "orderNumber",
        header: "الطلب",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground" dir="ltr">
              #{r.orderNumber.slice(-8)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {labelOf(SERVICE_TYPE_LABELS, r.serviceType)}
            </p>
          </div>
        ),
        sortValue: (r) => r.orderNumber,
      },
      {
        key: "patient",
        header: "المريض",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.patientName}</p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {r.patientPhone}
            </p>
          </div>
        ),
        sortValue: (r) => r.patientName,
      },
      {
        key: "location",
        header: "الموقع",
        secondary: true,
        render: (r) => (
          <span className="text-xs text-muted-foreground">
            {[r.governorate?.name, r.area, r.address].filter(Boolean).join(" - ") || "—"}
          </span>
        ),
      },
      {
        key: "priority",
        header: "الأولوية",
        render: (r) => (
          <Pill
            tone={
              r.priority === "CRITICAL" ? "danger" : r.priority === "URGENT" ? "warning" : "neutral"
            }
          >
            {labelOf(ORDER_PRIORITY_LABELS, r.priority)}
          </Pill>
        ),
        sortValue: (r) => PRIORITY_RANK[r.priority] ?? 3,
      },
      {
        key: "status",
        header: "الحالة",
        render: (r) => (
          <div className="flex flex-wrap gap-1">
            <Pill tone={toneForStatus(r.status === "NEW" ? "PENDING" : r.status)}>
              {labelOf(ORDER_STATUS_LABELS, r.status)}
            </Pill>
            {r.source !== "DIRECT" ? (
              <Pill tone="info">{labelOf(CHANNEL_LABELS, r.source)}</Pill>
            ) : null}
          </div>
        ),
      },
      {
        key: "payment",
        header: "الدفع",
        secondary: true,
        render: (r) => (
          <div className="min-w-0">
            <p className="text-xs text-foreground">
              {r.totalAmount === null ? "لم يُسعّر" : formatCurrency(r.totalAmount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {labelOf(PAYMENT_METHOD_LABELS, r.paymentMethod)} ·{" "}
              {r.paymentStatus === "PAID" ? "مدفوع" : "غير مدفوع"}
            </p>
          </div>
        ),
        // Coerced: the Decimal is a string, and sorting strings would put
        // "9,000" above "25,000".
        sortValue: (r) => (r.totalAmount === null ? -1 : Number(r.totalAmount)),
      },
      {
        key: "createdAt",
        header: "منذ",
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatRelative(r.createdAt)}
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
        title="الطلبات"
        subtitle="قبول الطلبات ورفضها وتعليقها وتحويلها — تُحدَّث تلقائياً كل 30 ثانية"
      />

      <DataTable
        rows={orders}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.orderNumber} ${r.patientName} ${r.patientPhone} ${r.governorate?.name ?? ""} ${r.area ?? ""}`
        }
        searchPlaceholder="بحث برقم الطلب أو المريض أو الهاتف..."
        filters={[
          {
            key: "status",
            label: "كل الحالات",
            options: optionsOf(ORDER_STATUS_LABELS),
            match: (r, v) => r.status === v,
          },
          {
            key: "priority",
            label: "كل الأولويات",
            options: optionsOf(ORDER_PRIORITY_LABELS),
            match: (r, v) => r.priority === v,
          },
          {
            key: "serviceType",
            label: "كل الخدمات",
            options: optionsOf(SERVICE_TYPE_LABELS),
            match: (r, v) => r.serviceType === v,
          },
          {
            key: "source",
            label: "كل الواجهات",
            options: optionsOf(CHANNEL_LABELS),
            match: (r, v) => r.source === v,
          },
        ]}
        emptyMessage="لا توجد طلبات"
        actions={(r) => {
          // Derived from the order's own status, so a button never offers a
          // transition the server rejects with a 409 nobody can interpret.
          const can = allowedActions(r.status);
          return (
            <div className="flex items-center justify-end gap-0.5">
              {can.canAccept ? (
                <IconAction
                  label={`قبول الطلب ${r.orderNumber.slice(-8)}`}
                  tone="positive"
                  disabled={actions.isPending}
                  onClick={() => void actions.accept(r.id)}
                >
                  <Check size={15} />
                </IconAction>
              ) : null}

              {can.canReject ? (
                <IconAction
                  label={`رفض الطلب ${r.orderNumber.slice(-8)}`}
                  tone="danger"
                  disabled={actions.isPending}
                  onClick={() => {
                    setRejecting(r);
                    setReason("");
                  }}
                >
                  <X size={15} />
                </IconAction>
              ) : null}

              {can.canHold ? (
                <IconAction
                  label={`تعليق الطلب ${r.orderNumber.slice(-8)}`}
                  tone="warning"
                  disabled={actions.isPending}
                  onClick={() => void actions.hold(r.id)}
                >
                  <Pause size={15} />
                </IconAction>
              ) : null}

              <IconAction
                label={`تحويل الطلب ${r.orderNumber.slice(-8)}`}
                disabled={actions.isPending}
                onClick={() => {
                  setTransferring(r);
                  setTargetEmployee("");
                }}
              >
                <ArrowLeftRight size={15} />
              </IconAction>

              <Link
                href={`/operations/tracking?order=${r.id}`}
                aria-label={`تفاصيل الطلب ${r.orderNumber.slice(-8)}`}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Eye size={15} />
              </Link>
            </div>
          );
        }}
      />

      <FormDialog
        open={rejecting !== null}
        title="رفض الطلب"
        description={
          rejecting ? `#${rejecting.orderNumber.slice(-8)} · ${rejecting.patientName}` : undefined
        }
        submitLabel="رفض الطلب"
        submitTone="danger"
        onClose={close}
        onSubmit={() => {
          if (!rejecting) return;
          void actions.reject(rejecting.id, reason.trim() || undefined);
          close();
        }}
      >
        <Field label="سبب الرفض" htmlFor="reason" hint="اختياري — يُحفظ في سجل الطلب">
          <input
            id="reason"
            className={fieldClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="لا يوجد مزوّد متاح في المنطقة"
          />
        </Field>
      </FormDialog>

      <FormDialog
        open={transferring !== null}
        title="تحويل الطلب"
        description={
          transferring
            ? `#${transferring.orderNumber.slice(-8)} · ${transferring.patientName}`
            : undefined
        }
        submitLabel="تحويل"
        onClose={close}
        onSubmit={() => {
          if (!transferring || !targetEmployee) return;
          void actions.transfer(transferring.id, targetEmployee);
          close();
        }}
      >
        <Field label="الموظف المستلم" htmlFor="target">
          <select
            id="target"
            className={fieldClass}
            value={targetEmployee}
            onChange={(e) => setTargetEmployee(e.target.value)}
          >
            <option value="">— اختر —</option>
            {(employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name ?? e.id}
              </option>
            ))}
          </select>
        </Field>
      </FormDialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const TONES = {
  positive: "text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400",
  danger: "text-red-600 hover:bg-red-500/10 dark:text-red-400",
  warning: "text-amber-600 hover:bg-amber-500/10 dark:text-amber-400",
  neutral: "text-muted-foreground hover:bg-accent hover:text-foreground",
} as const;

function IconAction({
  label,
  tone = "neutral",
  disabled,
  onClick,
  children,
}: {
  label: string;
  tone?: keyof typeof TONES;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // Names the ORDER, not just the verb — a screen reader hearing "قبول"
      // eleven times cannot tell which row it is on.
      aria-label={label}
      className={`rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${TONES[tone]}`}
    >
      {children}
    </button>
  );
}
