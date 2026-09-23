"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, Ban, Check, Eye, Pause, X } from "lucide-react";
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

// The global search lands here with `?q=<orderNumber>`, and `useSearchParams`
// suspends, so the boundary is required rather than defensive.
export default function OperationsOrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersScreen />
    </Suspense>
  );
}

function OrdersScreen() {
  const initialQuery = useSearchParams().get("q") ?? "";
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
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const [transferring, setTransferring] = useState<Order | null>(null);
  const [targetEmployee, setTargetEmployee] = useState("");
  const [creating, setCreating] = useState(false);

  const close = useCallback(() => {
    setRejecting(null);
    setCancelling(null);
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
        subtitle="استقبال الطلبات وقبولها ورفضها وتعليقها وتحويلها وإلغاؤها"
        action={{ label: "طلب هاتفي", onClick: () => setCreating(true) }}
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
        initialQuery={initialQuery}
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

              {/* `reject` stops at ACCEPTED. Past that a provider is already
                  involved, and until now an order that had to be stopped —
                  patient not home, provider broken down, lab closed — simply
                  could not be. Cancelling also returns a wallet-paid fee. */}
              {can.canCancel ? (
                <IconAction
                  label={`إلغاء الطلب ${r.orderNumber.slice(-8)}`}
                  tone="danger"
                  disabled={actions.isPending}
                  onClick={() => {
                    setCancelling(r);
                    setReason("");
                  }}
                >
                  <Ban size={15} />
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

      <FormDialog
        open={cancelling !== null}
        title="إلغاء الطلب"
        description={
          cancelling
            ? `#${cancelling.orderNumber.slice(-8)} · ${cancelling.patientName}`
            : undefined
        }
        submitLabel="إلغاء الطلب"
        submitTone="danger"
        onClose={close}
        onSubmit={() => {
          if (!cancelling) return;
          void actions.cancel(cancelling.id, reason.trim() || undefined);
          close();
        }}
      >
        <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          سيُوقف تنفيذ الطلب نهائياً. إن كانت الرسوم قد خُصمت من محفظة المريض
          فستُعاد إليها تلقائياً.
        </p>
        <Field label="سبب الإلغاء" htmlFor="cancel-reason" hint="اختياري — يُحفظ في سجل النشاط">
          <input
            id="cancel-reason"
            className={fieldClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="المريض غير متواجد"
            maxLength={500}
          />
        </Field>
      </FormDialog>

      {creating ? (
        <PhoneOrderDialog
          onClose={() => setCreating(false)}
          onSubmit={(body) => {
            void actions.create(body).then((created) => {
              if (created) setCreating(false);
            });
          }}
          isPending={actions.isPending}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------ طلب هاتفي --------------------------------- */

type Governorate = { id: string; name: string };
type Patient = { id: string; name: string | null; phone: string | null };

/**
 * Find the caller by phone or name.
 *
 * Searched on the SERVER rather than filtering a preloaded page: every patient
 * on the platform is an account, so the list this would have to preload is the
 * user table. The call centre's own question — "what's your number?" — is the
 * query, and `/api/patients` answers it with id, name and phone only.
 */
function PatientPicker({
  value,
  onChange,
}: {
  value: Patient | null;
  onChange: (patient: Patient | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const enabled = settled.length >= 2 && value === null;
  const { data, isLoading } = useDashboardData<Patient[]>({
    url: "/api/patients",
    params: { q: settled, limit: "10" },
    enabled,
  });

  if (value) {
    return (
      <Field
        label="المريض"
        htmlFor="po-patient"
        hint={value.phone ? undefined : "هذا الحساب بلا رقم هاتف — لا يمكن إرسال مزوّد إليه"}
      >
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {value.name ?? "مريض بلا اسم"}
            </p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {value.phone ?? "بلا رقم"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
            className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            تغيير
          </button>
        </div>
      </Field>
    );
  }

  const results = enabled ? (data ?? []) : [];

  return (
    <Field
      label="المريض"
      htmlFor="po-patient"
      hint="ابحث برقم المتصل أو اسمه — الطلب يُربط بحسابه ومحفظته"
    >
      <input
        id="po-patient"
        className={fieldClass}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="رقم الهاتف أو الاسم"
        autoComplete="off"
      />

      {query.trim().length >= 2 ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-border">
          {isLoading ? (
            <p className="px-3 py-3 text-center text-xs text-muted-foreground">جارِ البحث...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-muted-foreground">
              لا حساب بهذا الاسم أو الرقم — يجب أن يكون للمريض حساب على المنصة
            </p>
          ) : (
            <ul className="max-h-44 divide-y divide-border overflow-y-auto">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onChange(p)}
                    className="w-full px-3 py-2 text-start transition-colors hover:bg-accent"
                  >
                    <span className="block truncate text-sm text-foreground">
                      {p.name ?? "مريض بلا اسم"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground" dir="ltr">
                      {p.phone ?? "بلا رقم"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Field>
  );
}

/**
 * استقبال الطلبات (req L300) — an order taken over the phone.
 *
 * `POST /api/orders` has existed and been OPERATIONS-scoped from the start, and
 * no screen ever called it: every order in the system had to arrive through the
 * patient app. A call centre that cannot write down the call it is on is not a
 * call centre.
 *
 * `patientId` is required by the endpoint — an order belongs to an account, and
 * that is what links it to the patient's wallet, tracking screen and history.
 * So the caller is identified from the platform's own users rather than typed
 * in free-text, which would create an order nobody could ever see.
 */
function PhoneOrderDialog({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [chosen, setChosen] = useState<Patient | null>(null);
  const [serviceType, setServiceType] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [governorateId, setGovernorateId] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");

  const { data: governorates } = useDashboardData<Governorate[]>({
    url: "/api/governorates",
    // Effectively constant — no reason to refetch it per dialog open.
    staleTime: 10 * 60_000,
  });

  const ready = chosen !== null && serviceType !== "" && Boolean(chosen.phone);

  return (
    <FormDialog
      open
      title="طلب هاتفي"
      description="تسجيل طلب وارد عبر الاتصال — يدخل الطابور كطلب جديد"
      onClose={onClose}
      isPending={isPending}
      submitDisabled={!ready}
      submitLabel="إنشاء الطلب"
      onSubmit={() => {
        if (!chosen?.phone) return;
        onSubmit({
          patientId: chosen.id,
          // Denormalised onto the order on purpose: these are the details as
          // given on the call, and they must not change under a later profile
          // edit — the provider is dispatched against what was said.
          patientName: chosen.name ?? chosen.phone,
          patientPhone: chosen.phone,
          serviceType,
          priority,
          source: "DIRECT",
          paymentMethod,
          ...(governorateId ? { governorateId } : {}),
          ...(area.trim() ? { area: area.trim() } : {}),
          ...(address.trim() ? { address: address.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
      }}
    >
      <PatientPicker value={chosen} onChange={setChosen} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الخدمة" htmlFor="po-service">
          <select
            id="po-service"
            className={fieldClass}
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
          >
            <option value="">— اختر —</option>
            {optionsOf(SERVICE_TYPE_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الأولوية" htmlFor="po-priority">
          <select
            id="po-priority"
            className={fieldClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {optionsOf(ORDER_PRIORITY_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="المحافظة" htmlFor="po-gov">
          <select
            id="po-gov"
            className={fieldClass}
            value={governorateId}
            onChange={(e) => setGovernorateId(e.target.value)}
          >
            <option value="">— اختر —</option>
            {(governorates ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="المنطقة" htmlFor="po-area">
          <input
            id="po-area"
            className={fieldClass}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="الكرادة"
          />
        </Field>
      </div>

      <Field label="العنوان" htmlFor="po-address" hint="أقرب نقطة دالة">
        <input
          id="po-address"
          className={fieldClass}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Field>

      <Field label="طريقة الدفع" htmlFor="po-payment">
        <select
          id="po-payment"
          className={fieldClass}
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          {optionsOf(PAYMENT_METHOD_LABELS).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="ملاحظات المكالمة" htmlFor="po-notes" hint="اختياري">
        <textarea
          id="po-notes"
          className={`${fieldClass} h-20 py-2.5`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
    </FormDialog>
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
