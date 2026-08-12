"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill } from "@/components/data/crud-kit";
import { USER_ROLE_KEYS, USER_ROLE_LABELS, labelOf, optionsOf } from "@/lib/labels";
import { formatNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// الصلاحيات والأدوار (req L264)
//
// Roles are not a database table — they are the `UserRole` enum, and the access
// each one has is the `ROLES` groups in src/lib/api-auth.ts that guard every
// endpoint. So this screen shows the *real* matrix rather than an editable
// fiction: a permissions UI whose toggles do not change what the API enforces
// is worse than none, because it tells an administrator a lie they will act on.
//
// What IS changeable is which role a user holds, and that is here.
// ─────────────────────────────────────────────────────────────

type User = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
};

/** Mirrors the `ROLES` groups in src/lib/api-auth.ts. */
const CAPABILITIES: { key: string; label: string; roles: readonly string[] }[] = [
  {
    key: "admin",
    label: "إدارة المنصة (الأسعار، العمولات، المستخدمون)",
    roles: ["SUPER_ADMIN"],
  },
  {
    key: "operations",
    label: "غرفة العمليات (الطلبات، الإسناد، الشركاء)",
    roles: ["SUPER_ADMIN", "OPERATIONS"],
  },
  {
    key: "clinical",
    label: "السجلات السريرية (التحاليل، الوصفات، الأشعة)",
    roles: ["SUPER_ADMIN", "OPERATIONS", "DOCTOR", "LAB", "PHARMACY", "NURSE", "RADIOLOGY"],
  },
  {
    key: "staff",
    label: "تطبيق الكادر (الطلبات المسندة، الحالة، الإشعارات)",
    roles: [
      "SUPER_ADMIN",
      "OPERATIONS",
      "DOCTOR",
      "LAB",
      "PHARMACY",
      "NURSE",
      "DRIVER",
      "RADIOLOGY",
    ],
  },
];

export default function RolesPage() {
  const { data, isLoading, error, refetch } = useDashboardData<User[]>({
    url: "/api/users",
    params: { limit: "100" },
  });

  const [target, setTarget] = useState<User | null>(null);
  const [nextRole, setNextRole] = useState("");

  const close = useCallback(() => {
    setTarget(null);
    setNextRole("");
  }, []);

  const { mutate: changeRole, isPending } = useMutation(
    async () =>
      apiFetch(`/api/users/${target!.id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: nextRole }),
      }),
    {
      successMessage: "تم تغيير الدور",
      onSuccess: () => {
        close();
        void refetch();
      },
    }
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const u of data ?? []) out[u.role] = (out[u.role] ?? 0) + 1;
    return out;
  }, [data]);

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "المستخدم",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name ?? "بدون اسم"}</p>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {r.email ?? r.phone ?? "—"}
          </p>
        </div>
      ),
      sortValue: (r) => r.name ?? "",
    },
    {
      key: "role",
      header: "الدور",
      render: (r) => (
        <Pill tone={r.role === "SUPER_ADMIN" ? "info" : "neutral"}>
          {labelOf(USER_ROLE_LABELS, r.role)}
        </Pill>
      ),
      sortValue: (r) => labelOf(USER_ROLE_LABELS, r.role),
    },
    {
      key: "isActive",
      header: "الحساب",
      secondary: true,
      render: (r) => (
        <Pill tone={r.isActive ? "positive" : "neutral"}>{r.isActive ? "نشط" : "معطّل"}</Pill>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="الصلاحيات والأدوار"
        subtitle="الأدوار محدَّدة في النظام وتُطبَّق على كل نقطة وصول — هنا تُسنَد للمستخدمين"
        icon={ShieldCheck}
      />

      {/* Role census — real counts over the loaded users. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {USER_ROLE_KEYS.map((role) => (
          <div key={role} className="rounded-2xl border border-border bg-card p-3">
            <p className="truncate text-xs text-muted-foreground">{USER_ROLE_LABELS[role]}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(counts[role] ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">مصفوفة الصلاحيات</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            هذه المصفوفة تعكس ما يفرضه الخادم فعلياً على كل نقطة وصول — للاطلاع فقط،
            وتغييرها يتم في إعداد النظام لا من الواجهة.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 text-start font-medium">
                  الصلاحية
                </th>
                {USER_ROLE_KEYS.map((role) => (
                  <th key={role} scope="col" className="px-2 py-2.5 text-center font-medium">
                    {USER_ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {CAPABILITIES.map((cap) => (
                <tr key={cap.key}>
                  <th scope="row" className="px-4 py-3 text-start font-normal text-foreground">
                    {cap.label}
                  </th>
                  {USER_ROLE_KEYS.map((role) => {
                    const allowed = cap.roles.includes(role);
                    return (
                      <td key={role} className="px-2 py-3 text-center">
                        {allowed ? (
                          <Check
                            size={16}
                            className="mx-auto text-emerald-600 dark:text-emerald-400"
                            aria-label="مسموح"
                          />
                        ) : (
                          <Minus
                            size={16}
                            className="mx-auto text-muted-foreground/40"
                            aria-label="غير مسموح"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.name ?? ""} ${r.email ?? ""} ${r.phone ?? ""}`}
        searchPlaceholder="بحث بالاسم أو البريد..."
        filters={[
          {
            key: "role",
            label: "كل الأدوار",
            options: optionsOf(USER_ROLE_LABELS),
            match: (r, v) => r.role === v,
          },
        ]}
        emptyMessage="لا يوجد مستخدمون"
        actions={(r) => (
          <button
            type="button"
            onClick={() => {
              setTarget(r);
              setNextRole(r.role);
            }}
            className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            تغيير الدور
          </button>
        )}
      />

      <FormDialog
        open={target !== null}
        title="تغيير دور المستخدم"
        description={`${target?.name ?? target?.email ?? ""} — الدور الحالي: ${labelOf(
          USER_ROLE_LABELS,
          target?.role
        )}`}
        submitLabel="تغيير الدور"
        onClose={close}
        onSubmit={() => void changeRole()}
        isPending={isPending}
      >
        <Field
          label="الدور الجديد"
          htmlFor="next-role"
          hint="لا يمكن تغيير دور حسابك الخاص، ولا دور آخر مدير عام في النظام"
        >
          <select
            id="next-role"
            className={fieldClass}
            value={nextRole}
            onChange={(e) => setNextRole(e.target.value)}
          >
            {USER_ROLE_KEYS.map((role) => (
              <option key={role} value={role}>
                {USER_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </Field>
      </FormDialog>
    </div>
  );
}
