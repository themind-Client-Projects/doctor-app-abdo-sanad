"use client";

import { useCallback, useMemo, useState } from "react";
import { ToggleLeft } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill } from "@/components/data/crud-kit";
import { formatCurrency } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// خيارات النظام — "يكون معلق تفعيله من الادمن فقط"
//
// Not a DataTable: there are four switches, they are seeded rather than created,
// and the thing an admin needs here is to read what each one does before
// flipping it — which a dense table row cannot carry. Cards with the
// description visible.
// ─────────────────────────────────────────────────────────────

type Flag = {
  key: string;
  label: string;
  description: string | null;
  group: string;
  isEnabled: boolean;
  numericValue: number | null;
};

const GROUP_LABELS: Record<string, string> = {
  booking: "الحجز والدفع",
  taxi: "التاكسي",
  sanad: "سند",
  general: "عام",
};

export default function FeaturesPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Flag[]>({
    url: "/api/feature-flags",
  });

  const [editing, setEditing] = useState<Flag | null>(null);
  const [value, setValue] = useState("");

  const close = useCallback(() => {
    setEditing(null);
    setValue("");
  }, []);

  const { mutate: toggle } = useMutation(
    async (key: string, isEnabled: boolean) =>
      apiFetch(`/api/feature-flags/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled }),
      }),
    { successMessage: "تم تحديث الخيار", onSuccess: () => void refetch() }
  );

  const { mutate: saveValue, isPending: saving } = useMutation(
    async () =>
      apiFetch(`/api/feature-flags/${editing!.key}`, {
        method: "PATCH",
        body: JSON.stringify({ numericValue: value.trim() === "" ? null : Number(value) }),
      }),
    {
      successMessage: "تم تحديث السعر",
      onSuccess: () => {
        close();
        void refetch();
      },
    }
  );

  const grouped = useMemo(() => {
    const out = new Map<string, Flag[]>();
    for (const f of data ?? []) {
      const list = out.get(f.group) ?? [];
      list.push(f);
      out.set(f.group, list);
    }
    return [...out.entries()];
  }, [data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="خيارات النظام"
        subtitle="تفعيل أو تعليق خيارات التطبيق — لا تظهر للمستخدم إلا بعد تفعيلها من هنا"
        icon={ToggleLeft}
      />

      {error ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-destructive">
          تعذّر تحميل الخيارات
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        grouped.map(([group, flags]) => (
          <section key={group} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {GROUP_LABELS[group] ?? group}
            </h2>

            {flags.map((flag) => (
              <div
                key={flag.key}
                className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    {flag.label}
                    <Pill tone={flag.isEnabled ? "positive" : "neutral"}>
                      {flag.isEnabled ? "مفعّل" : "معلّق"}
                    </Pill>
                  </p>
                  {flag.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {flag.description}
                    </p>
                  ) : null}

                  {flag.numericValue !== null ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(flag);
                        setValue(String(flag.numericValue ?? ""));
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      السعر المحدّد: {formatCurrency(flag.numericValue)}
                      <span className="text-muted-foreground">— تعديل</span>
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={flag.isEnabled}
                  aria-label={`${flag.isEnabled ? "تعليق" : "تفعيل"} ${flag.label}`}
                  onClick={() => void toggle(flag.key, !flag.isEnabled)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    flag.isEnabled ? "bg-emerald-500" : "bg-muted"
                  }`}
                >
                  {/* RTL: the knob travels from the start edge, so `end-*`
                      would move it the wrong way. */}
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start] ${
                      flag.isEnabled ? "start-6" : "start-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </section>
        ))
      )}

      <FormDialog
        open={editing !== null}
        title="تعديل السعر المحدّد"
        description={editing?.label}
        onClose={close}
        onSubmit={() => void saveValue()}
        isPending={saving}
      >
        <Field
          label="السعر (د.ع)"
          htmlFor="flag-value"
          hint="يُطبَّق على كل طلب يستخدم هذا الخيار"
        >
          <input
            id="flag-value"
            type="number"
            min={0}
            dir="ltr"
            className={fieldClass}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
      </FormDialog>
    </div>
  );
}
