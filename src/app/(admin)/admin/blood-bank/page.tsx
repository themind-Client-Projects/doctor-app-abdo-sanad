"use client";

import { useCallback, useMemo, useState } from "react";
import { Droplet, Send, Users } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/admin/data-table";
import { Field, FormDialog, fieldClass } from "@/components/admin/form-dialog";
import { PageHeader, Pill, StatTile, type PillTone } from "@/components/admin/crud-kit";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// مصرف الدم — the employee side of the patient's form.
//
// The client's spec ends "يتم ارسال الاستمارة إلى موظف التطبيق ومن خلاله يتم
// ارسال الحالة داخل التطبيق أو مراسلة المتبرعين" — so a request is not finished
// when it is submitted; someone has to broadcast it and match a donor. This is
// that screen, and without it the form had nowhere to go.
// ─────────────────────────────────────────────────────────────

const BLOOD_LABELS: Record<string, string> = {
  A_POS: "+A", A_NEG: "−A", B_POS: "+B", B_NEG: "−B",
  AB_POS: "+AB", AB_NEG: "−AB", O_POS: "+O", O_NEG: "−O",
};

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  broadcast: "أُرسل للمتبرعين",
  matched: "تم إيجاد متبرع",
  fulfilled: "مكتمل",
  cancelled: "ملغي",
};

const STATUS_TONES: Record<string, PillTone> = {
  new: "warning",
  broadcast: "info",
  matched: "info",
  fulfilled: "positive",
  cancelled: "neutral",
};

type Request = {
  id: string;
  requestType: string;
  fullName: string;
  phone: string;
  age: number | null;
  gender: string | null;
  residence: string | null;
  landmark: string | null;
  bloodType: string;
  lastDonation: string | null;
  operationType: string | null;
  bagsNeeded: number | null;
  operationPlace: string | null;
  status: string;
  broadcastAt: string | null;
  donorName: string | null;
  notes: string | null;
  createdAt: string;
  governorate: { name: string } | null;
};

export default function BloodBankPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Request[]>({
    url: "/api/blood-bank",
    params: { limit: "100" },
  });

  const [viewing, setViewing] = useState<Request | null>(null);
  const [donorName, setDonorName] = useState("");

  const close = useCallback(() => {
    setViewing(null);
    setDonorName("");
  }, []);

  const { mutate: setStatus } = useMutation(
    // PATCH, not PUT — and `broadcastAt` is stamped server-side from the status,
    // so the client never sends a time that could disagree with it.
    async (id: string, status: string) =>
      apiFetch(`/api/blood-bank/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    { successMessage: "تم تحديث الحالة", onSuccess: () => void refetch() }
  );

  const { mutate: assignDonor, isPending: assigning } = useMutation(
    async () =>
      apiFetch(`/api/blood-bank/${viewing!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "matched", donorName: donorName.trim() }),
      }),
    {
      successMessage: "تم ربط المتبرع بالطلب",
      onSuccess: () => {
        close();
        void refetch();
      },
    }
  );

  const requests = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const requesters = requests.filter((r) => r.requestType === "REQUESTER");
    return {
      open: requesters.filter((r) => r.status === "new").length,
      broadcast: requesters.filter((r) => r.status === "broadcast").length,
      donors: requests.filter((r) => r.requestType === "DONOR").length,
      bags: requesters
        .filter((r) => r.status !== "fulfilled" && r.status !== "cancelled")
        .reduce((a, r) => a + (r.bagsNeeded ?? 0), 0),
    };
  }, [requests]);

  const columns: Column<Request>[] = [
    {
      key: "fullName",
      header: "مقدّم الطلب",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.fullName}</p>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {r.phone}
          </p>
        </div>
      ),
      sortValue: (r) => r.fullName,
    },
    {
      key: "requestType",
      header: "النوع",
      render: (r) => (
        <Pill tone={r.requestType === "REQUESTER" ? "danger" : "positive"}>
          {r.requestType === "REQUESTER" ? "طالب دم" : "متبرع"}
        </Pill>
      ),
    },
    {
      key: "bloodType",
      header: "الفصيلة",
      render: (r) => (
        <span className="font-bold tabular-nums text-foreground" dir="ltr">
          {BLOOD_LABELS[r.bloodType] ?? r.bloodType}
        </span>
      ),
      sortValue: (r) => r.bloodType,
    },
    {
      key: "need",
      header: "المطلوب",
      secondary: true,
      render: (r) =>
        r.requestType === "REQUESTER" ? (
          <div className="min-w-0">
            <p className="truncate text-xs text-foreground">{r.operationType ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {r.bagsNeeded ? `${formatNumber(r.bagsNeeded)} كيس` : "—"}
              {r.operationPlace ? ` · ${r.operationPlace}` : ""}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            آخر تبرع: {r.lastDonation ? formatDate(r.lastDonation) : "—"}
          </span>
        ),
    },
    {
      key: "governorate",
      header: "الموقع",
      secondary: true,
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {[r.governorate?.name, r.residence].filter(Boolean).join(" - ") || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "الحالة",
      render: (r) => (
        <Pill tone={STATUS_TONES[r.status] ?? "neutral"}>
          {STATUS_LABELS[r.status] ?? r.status}
        </Pill>
      ),
    },
    {
      key: "createdAt",
      header: "منذ",
      secondary: true,
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatRelative(r.createdAt)}
        </span>
      ),
      sortValue: (r) => new Date(r.createdAt).getTime(),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="مصرف الدم"
        subtitle="طلبات الدم وتسجيلات المتبرعين — أرسل الحالة للمتبرعين ثم اربط المتبرع بالطلب"
        icon={Droplet}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="طلبات جديدة" value={formatNumber(stats.open)} icon={Droplet} />
        <StatTile label="أُرسلت للمتبرعين" value={formatNumber(stats.broadcast)} icon={Send} />
        <StatTile label="أكياس مطلوبة" value={formatNumber(stats.bags)} hint="للطلبات غير المكتملة" />
        <StatTile label="متبرعون مسجّلون" value={formatNumber(stats.donors)} icon={Users} />
      </div>

      <DataTable
        rows={requests}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.fullName} ${r.phone} ${r.bloodType} ${r.operationType ?? ""}`}
        searchPlaceholder="بحث بالاسم أو الهاتف أو الفصيلة..."
        filters={[
          {
            key: "requestType",
            label: "الكل",
            options: [
              { value: "REQUESTER", label: "طالبو الدم" },
              { value: "DONOR", label: "المتبرعون" },
            ],
            match: (r, v) => r.requestType === v,
          },
          {
            key: "status",
            label: "كل الحالات",
            options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
            match: (r, v) => r.status === v,
          },
          {
            key: "bloodType",
            label: "كل الفصائل",
            options: Object.entries(BLOOD_LABELS).map(([value, label]) => ({ value, label })),
            match: (r, v) => r.bloodType === v,
          },
        ]}
        emptyMessage="لا توجد طلبات بعد"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            {/* The two steps the spec describes: broadcast the case, then match
                a donor to it. Only offered where they make sense. */}
            {r.requestType === "REQUESTER" && r.status === "new" ? (
              <button
                type="button"
                onClick={() =>
                  void setStatus(r.id, "broadcast")
                }
                className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-sky-600 transition-colors hover:bg-sky-500/10 dark:text-sky-400"
              >
                إرسال للمتبرعين
              </button>
            ) : null}
            {r.requestType === "REQUESTER" && ["new", "broadcast"].includes(r.status) ? (
              <button
                type="button"
                onClick={() => {
                  setViewing(r);
                  setDonorName(r.donorName ?? "");
                }}
                className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                ربط متبرع
              </button>
            ) : null}
            {r.status === "matched" ? (
              <button
                type="button"
                onClick={() => void setStatus(r.id, "fulfilled")}
                className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                إكمال
              </button>
            ) : null}
          </div>
        )}
      />

      <FormDialog
        open={viewing !== null}
        title="ربط متبرع بالطلب"
        description={
          viewing
            ? `${viewing.fullName} · ${BLOOD_LABELS[viewing.bloodType] ?? viewing.bloodType} · ${
                viewing.bagsNeeded ?? "—"
              } كيس`
            : undefined
        }
        submitLabel="ربط المتبرع"
        onClose={close}
        onSubmit={() => void assignDonor()}
        isPending={assigning}
      >
        <Field
          label="اسم المتبرع"
          htmlFor="donor"
          hint="يتولى الموظف التواصل بين الطالب والمتبرع"
        >
          <input
            id="donor"
            className={fieldClass}
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder="اسم المتبرع الثلاثي"
          />
        </Field>
      </FormDialog>
    </div>
  );
}
