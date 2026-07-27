// ─────────────────────────────────────────────────────────────
// Role → Table Column Config (req L48-58)
// "لكن تصميم الجدول واحد" — same table component, different columns
// ─────────────────────────────────────────────────────────────

export interface TaskColumn {
  key: string;
  label: string;
}

const doctorColumns: TaskColumn[] = [
  { key: "patientName", label: "المريض" },
  { key: "serviceType", label: "نوع الخدمة" },
  { key: "status", label: "الحالة" },
  { key: "time", label: "الوقت" },
];

const labColumns: TaskColumn[] = [
  { key: "sampleId", label: "رقم العينة" },
  { key: "sampleType", label: "نوع التحليل" },
  { key: "status", label: "الحالة" },
  { key: "createdAt", label: "التاريخ" },
];

const pharmacyColumns: TaskColumn[] = [
  { key: "prescriptionId", label: "رقم الوصفة" },
  { key: "patientName", label: "المريض" },
  { key: "medications", label: "الأدوية" },
  { key: "status", label: "الحالة" },
];

const nurseColumns: TaskColumn[] = [
  { key: "patientName", label: "المريض" },
  { key: "serviceType", label: "نوع الزيارة" },
  { key: "address", label: "العنوان" },
  { key: "status", label: "الحالة" },
];

const driverColumns: TaskColumn[] = [
  { key: "orderNumber", label: "الطلب" },
  { key: "address", label: "العنوان" },
  { key: "serviceType", label: "نوع المهمة" },
  { key: "status", label: "الحالة" },
];

const radiologyColumns: TaskColumn[] = [
  { key: "patientName", label: "المريض" },
  { key: "requestType", label: "نوع الأشعة" },
  { key: "appointmentDate", label: "الموعد" },
  { key: "status", label: "الحالة" },
];

const columnMap: Record<string, TaskColumn[]> = {
  DOCTOR: doctorColumns,
  LAB: labColumns,
  PHARMACY: pharmacyColumns,
  NURSE: nurseColumns,
  DRIVER: driverColumns,
  RADIOLOGY: radiologyColumns,
};

export function getTaskColumns(role: string): TaskColumn[] {
  return columnMap[role] || doctorColumns;
}

// Task title per role
export function getTaskTitle(role: string): string {
  const titles: Record<string, string> = {
    DOCTOR: "المرضى الحاليون",
    LAB: "العينات الحالية",
    PHARMACY: "الوصفات الحالية",
    NURSE: "الزيارات الحالية",
    DRIVER: "الرحلات الحالية",
    RADIOLOGY: "طلبات الأشعة الحالية",
  };
  return titles[role] || "المهام الحالية";
}
