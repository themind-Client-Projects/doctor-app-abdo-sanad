"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  FileHeart,
  FlaskConical,
  Heart,
  History,
  Pill as PillIcon,
  ScanLine,
  Search,
  Stethoscope,
} from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { PageHeader } from "@/components/data/crud-kit";
import { SERVICE_TYPE_LABELS, labelOf } from "@/lib/labels";

// ─────────────────────────────────────────────────────────────
// الملف الطبي المختصر (req L409-419) — 8 عناصر
//
// The screen could never show a file. It had a search box whose value was never
// read and a `selectedPatient` that nothing ever set, so the fetch was always
// against `url: ""` and the page sat on "ابحث عن مريض" permanently.
//
// Three of the eight fields were also misnamed — `lastLabResults`,
// `lastRadiology` and `treatingDoctor` against the record's `latestLabResults`,
// `latestRadiology` and `treatingDoctorId` — so they would have read blank even
// with a patient loaded.
//
// Patients are reached through their orders, which is the only patient
// directory operations has, and it is also how this file gets opened in
// practice: mid-call, about a specific order.
//
// Read-only by design: writing a patient's allergies is restricted to
// SUPER_ADMIN, DOCTOR and NURSE, so an edit control here would only ever 403.
// ─────────────────────────────────────────────────────────────

type PatientRef = {
  patientId: string;
  patientName: string;
  patientPhone: string;
  serviceType: string;
  orderNumber: string;
};

type MedicalRecord = {
  patientId: string;
  medicalHistory: string | null;
  chronicDiseases: unknown;
  allergies: unknown;
  currentMedications: unknown;
  latestLabResults: unknown;
  latestRadiology: unknown;
  previousPrescriptions: unknown;
  treatingDoctorId: string | null;
};

/**
 * These are Json columns, so a value may be a string, an array of strings, or
 * an array of objects. Rendering it raw is how "[object Object]" reaches a
 * clinician's screen.
 */
function renderJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string" || typeof item === "number"
          ? String(item)
          : // An object entry: prefer a name-ish key over dumping JSON.
            (((item as Record<string, unknown>)?.name ??
              (item as Record<string, unknown>)?.title ??
              (item as Record<string, unknown>)?.value) as string | undefined) ??
            JSON.stringify(item)
      )
      .filter(Boolean)
      .join("، ");
  }
  const obj = value as Record<string, unknown>;
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("، ");
}

export default function MedicalPage() {
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);

  const { data: orders } = useDashboardData<PatientRef[]>({
    url: "/api/orders",
    params: { limit: "100" },
  });

  // One entry per patient — a patient with six orders is still one person.
  const patients = useMemo(() => {
    const byId = new Map<string, PatientRef>();
    for (const o of orders ?? []) {
      if (!byId.has(o.patientId)) byId.set(o.patientId, o);
    }
    return [...byId.values()];
  }, [orders]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return patients
      .filter(
        (p) => p.patientName.toLowerCase().includes(q) || p.patientPhone.includes(q)
      )
      .slice(0, 8);
  }, [patients, search]);

  const selected = useMemo(
    () => patients.find((p) => p.patientId === patientId) ?? null,
    [patients, patientId]
  );

  const { data: record, isLoading, error } = useDashboardData<MedicalRecord>(
    patientId ? { url: `/api/medical-records/${patientId}` } : { url: "" }
  );

  const fields = useMemo(
    () => [
      { label: "التاريخ المرضي", value: record?.medicalHistory ?? "", Icon: History },
      { label: "الأمراض المزمنة", value: renderJson(record?.chronicDiseases), Icon: Heart },
      { label: "الحساسية", value: renderJson(record?.allergies), Icon: AlertTriangle },
      {
        label: "الأدوية الحالية",
        value: renderJson(record?.currentMedications),
        Icon: PillIcon,
      },
      { label: "آخر التحاليل", value: renderJson(record?.latestLabResults), Icon: FlaskConical },
      { label: "آخر الأشعة", value: renderJson(record?.latestRadiology), Icon: ScanLine },
      {
        label: "الوصفات السابقة",
        value: renderJson(record?.previousPrescriptions),
        Icon: PillIcon,
      },
      { label: "الطبيب المعالج", value: record?.treatingDoctorId ?? "", Icon: Stethoscope },
    ],
    [record]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="الملف الطبي المختصر"
        subtitle="٨ عناصر لكل مريض — للاطلاع أثناء معالجة الطلب"
        icon={FileHeart}
      />

      <div className="relative max-w-md">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground start-3"
        />
        <input
          type="search"
          aria-label="بحث عن مريض"
          placeholder="بحث بالاسم أو رقم الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background text-sm text-foreground outline-none transition-colors ps-9 pe-4 focus:border-[hsl(var(--primary))]"
        />

        {matches.length > 0 ? (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            {matches.map((p) => (
              <li key={p.patientId}>
                <button
                  type="button"
                  onClick={() => {
                    setPatientId(p.patientId);
                    setSearch("");
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start text-sm transition-colors hover:bg-accent"
                >
                  <span className="truncate text-foreground">{p.patientName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground" dir="ltr">
                    {p.patientPhone}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : search.trim() ? (
          <p className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground shadow-lg">
            لا مريض مطابق ضمن الطلبات الأخيرة
          </p>
        ) : null}
      </div>

      {selected ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-medium text-foreground">{selected.patientName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span dir="ltr">{selected.patientPhone}</span> ·{" "}
            {labelOf(SERVICE_TYPE_LABELS, selected.serviceType)}
          </p>
        </div>
      ) : null}

      {!patientId ? (
        <p className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
          ابحث عن مريض لعرض ملفه الطبي
        </p>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : error || !record ? (
        // A patient with no file is the normal case, not a failure — the record
        // is created the first time a clinician writes one.
        <p className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
          لا يوجد ملف طبي مسجّل لهذا المريض بعد
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                <f.Icon size={16} aria-hidden />
                <span className="text-xs font-semibold">{f.label}</span>
              </div>
              <p className="text-sm text-foreground">{f.value || "—"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
