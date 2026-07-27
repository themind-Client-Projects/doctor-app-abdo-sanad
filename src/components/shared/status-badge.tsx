"use client";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const statusConfig: Record<string, { label: string; style: string }> = {
  // Order statuses
  NEW:         { label: "جديد",         style: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  ACCEPTED:    { label: "مقبول",        style: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  ASSIGNED:    { label: "تم التعيين",   style: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  IN_TRANSIT:  { label: "في الطريق",    style: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  ARRIVED:     { label: "تم الوصول",    style: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  IN_PROGRESS: { label: "قيد التنفيذ",  style: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  COMPLETED:   { label: "مكتمل",        style: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  CANCELLED:   { label: "ملغي",         style: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  DELAYED:     { label: "متأخر",        style: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  // Partner
  ACTIVE:      { label: "نشط",          style: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  SUSPENDED:   { label: "معلق",         style: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  PENDING:     { label: "بانتظار",      style: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  PAUSED:      { label: "متوقف",        style: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  // Priority
  NORMAL:      { label: "عادي",         style: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  URGENT:      { label: "عاجل",         style: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  CRITICAL:    { label: "حرج",          style: "bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  // Payment
  PAID:        { label: "مدفوع",        style: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  FAILED:      { label: "فشل",          style: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  REFUNDED:    { label: "مسترد",        style: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  // Lab
  received:         { label: "استلمت",        style: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  in_lab:           { label: "وصلت المختبر",  style: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  testing:          { label: "قيد الفحص",     style: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  ready:            { label: "جاهزة",         style: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  sent_to_doctor:   { label: "أرسلت للطبيب",  style: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  sent_to_patient:  { label: "أرسلت للمريض",  style: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  // Pharmacy
  preparing: { label: "قيد التجهيز", style: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  delivered: { label: "تم التوصيل",  style: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  returned:  { label: "مرتجع",       style: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  // Employee
  AVAILABLE: { label: "متاح",      style: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  BUSY:      { label: "مشغول",     style: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  ON_BREAK:  { label: "استراحة",   style: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  // Sanad
  waiting:    { label: "انتظار",         style: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  calling:    { label: "جاري الاتصال",   style: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  in_session: { label: "في الجلسة",      style: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  ended:      { label: "انتهت",          style: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  // Radiology
  scheduled:       { label: "مجدول",         style: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  imaged:          { label: "تم التصوير",    style: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  report_ready:    { label: "التقرير جاهز",  style: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  images_attached: { label: "الصور مرفقة",   style: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, style: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${config.style} ${
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
    }`}>
      {config.label}
    </span>
  );
}
