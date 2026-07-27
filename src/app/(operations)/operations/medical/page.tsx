"use client";

import { useState } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { FileHeart, Search, AlertTriangle, Pill, FlaskConical, ScanLine, Stethoscope, History, Heart } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Section 6: الملف الطبي المختصر (req L409-419) — 8 fields
// التاريخ المرضي, الأمراض المزمنة, الحساسية, الأدوية الحالية,
// آخر التحاليل, آخر الأشعة, الوصفات السابقة, الطبيب المعالج
// ─────────────────────────────────────────────────────────────

interface MedicalRecord {
  patientId: string;
  patientName: string;
  medicalHistory: string;
  chronicDiseases: string[];
  allergies: string[];
  currentMedications: string[];
  lastLabResults: string;
  lastRadiology: string;
  previousPrescriptions: string[];
  treatingDoctor: string;
}

export default function MedicalPage() {
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const { data: record, isLoading } = useDashboardData<MedicalRecord>(
    selectedPatient ? { url: `/api/medical-records/${selectedPatient}` } : { url: "" }
  );

  const fields = [
    { label: "التاريخ المرضي", value: record?.medicalHistory, icon: <History size={16} />, color: "border-blue-200 dark:border-blue-800" },
    { label: "الأمراض المزمنة", value: record?.chronicDiseases?.join("، "), icon: <Heart size={16} />, color: "border-red-200 dark:border-red-800" },
    { label: "الحساسية", value: record?.allergies?.join("، "), icon: <AlertTriangle size={16} />, color: "border-amber-200 dark:border-amber-800" },
    { label: "الأدوية الحالية", value: record?.currentMedications?.join("، "), icon: <Pill size={16} />, color: "border-emerald-200 dark:border-emerald-800" },
    { label: "آخر التحاليل", value: record?.lastLabResults, icon: <FlaskConical size={16} />, color: "border-cyan-200 dark:border-cyan-800" },
    { label: "آخر الأشعة", value: record?.lastRadiology, icon: <ScanLine size={16} />, color: "border-purple-200 dark:border-purple-800" },
    { label: "الوصفات السابقة", value: record?.previousPrescriptions?.join("، "), icon: <Pill size={16} />, color: "border-indigo-200 dark:border-indigo-800" },
    { label: "الطبيب المعالج", value: record?.treatingDoctor, icon: <Stethoscope size={16} />, color: "border-pink-200 dark:border-pink-800" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><FileHeart size={22} className="text-primary" /> الملف الطبي المختصر</h1>
        <p className="text-sm text-muted-foreground mt-0.5">8 عناصر لكل مريض</p>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="بحث بالاسم أو رقم الهاتف..." value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-background pr-9 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {record ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((f, i) => (
            <div key={i} className={`rounded-xl border p-4 bg-card ${f.color}`}>
              <div className="flex items-center gap-2 mb-2 text-muted-foreground">{f.icon}<span className="text-xs font-semibold">{f.label}</span></div>
              <p className="text-sm text-foreground">{f.value || "—"}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-muted-foreground">ابحث عن مريض لعرض ملفه الطبي</div>
      )}
    </div>
  );
}
