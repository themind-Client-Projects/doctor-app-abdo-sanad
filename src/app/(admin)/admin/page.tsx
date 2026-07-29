"use client";

import {
  Activity,
  AlertCircle,
  ClipboardList,
  Percent,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { DonutChart, DonutLegend, TrendChart } from "@/components/charts/chart-primitives";
import { formatCurrency, formatNumber, formatRelative } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// Command Center — لوحة المدير العام (req L117-127)
//
// Every figure is an aggregate over real rows. /api/dashboard/summary had no
// SUPER_ADMIN branch, so this page previously rendered zeros throughout.
// ─────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  IN_PERSON_CONSULT: "استشارة حضورية",
  ONLINE_CONSULT: "استشارة أونلاين",
  HOME_VISIT: "زيارة منزلية",
  HOME_BLOOD_DRAW: "سحب دم منزلي",
  HOME_LAB_TEST: "تحليل منزلي",
  LAB_TEST: "تحاليل مختبرية",
  RADIOLOGY: "أشعة",
  PHARMACY_DISPENSE: "صرف وصفات",
  MEDICINE_DELIVERY: "دواء مع توصيل",
  NURSING: "تمريض",
  PHYSIOTHERAPY: "علاج طبيعي",
  SURGERY: "عمليات",
  BLOOD_BANK: "بنك الدم",
  TAXI: "نقل",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: "جديدة",
  ACCEPTED: "مقبولة",
  ASSIGNED: "معيّنة",
  IN_TRANSIT: "في الطريق",
  ARRIVED: "تم الوصول",
  IN_PROGRESS: "قيد التنفيذ",
  COMPLETED: "مكتملة",
  CANCELLED: "ملغاة",
  DELAYED: "متأخرة",
};

const PARTNER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "نشط",
  PENDING: "بانتظار الاعتماد",
  PAUSED: "متوقف مؤقتاً",
  SUSPENDED: "معلّق",
};

const PARTNER_TYPE_LABELS: Record<string, string> = {
  DOCTOR: "طبيب",
  LAB: "مختبر",
  PHARMACY: "صيدلية",
  NURSE: "تمريض",
  DRIVER: "نقل",
  RADIOLOGY: "أشعة",
};

type Metric = { value: number | null; change: number | null; count?: number };

type Overview = {
  kpis: {
    totalUsers: Metric;
    totalOrders: Metric;
    totalRevenue: Metric;
    platformProfit: Metric;
    transactionsToday: Metric;
    satisfaction: Metric;
  };
  ordersByStatus: { status: string; count: number; percent: number }[];
  partnersByStatus: { status: string; count: number; percent: number }[];
  revenueByService: { serviceType: string; revenue: number; orders: number }[];
  revenueTrend: { date: string; revenue: number; orders: number }[];
  topPartners: {
    partnerId: string | null;
    name: string | null;
    type: string | null;
    revenue: number;
  }[];
  recentActivity: {
    id: string;
    action: string;
    at: string;
    user: string | null;
    role: string | null;
  }[];
  health: {
    totalOrders: number;
    completedOrders: number;
    successRate: number | null;
    activeServices: number;
    totalServices: number;
  };
};

export default function AdminCommandCenter() {
  const { data, isLoading, error } = useDashboardData<Overview>({
    url: "/api/dashboard/admin-overview",
    refreshInterval: 60_000,
  });

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        تعذّر تحميل بيانات اللوحة
      </div>
    );
  }

  const k = data?.kpis;

  const orderSlices = (data?.ordersByStatus ?? []).map((s) => ({
    label: ORDER_STATUS_LABELS[s.status] ?? s.status,
    value: s.count,
  }));
  const serviceSlices = (data?.revenueByService ?? []).map((s) => ({
    label: SERVICE_LABELS[s.serviceType] ?? s.serviceType,
    value: s.revenue,
  }));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-foreground">لوحة المدير العام</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">نظرة شاملة على أداء المنصة</p>
      </header>

      {/* ── KPI row ─────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="إجمالي المستخدمين"
          value={formatNumber(k?.totalUsers.value)}
          change={k?.totalUsers.change}
          icon={<Users size={18} />}
          tone="blue"
          loading={isLoading}
        />
        <KpiCard
          label="إجمالي الطلبات"
          value={formatNumber(k?.totalOrders.value)}
          change={k?.totalOrders.change}
          icon={<ClipboardList size={18} />}
          tone="indigo"
          loading={isLoading}
        />
        <KpiCard
          label="إجمالي الإيرادات"
          value={formatCurrency(k?.totalRevenue.value)}
          change={k?.totalRevenue.change}
          icon={<Wallet size={18} />}
          tone="emerald"
          loading={isLoading}
        />
        <KpiCard
          label="صافي أرباح وريد"
          value={formatCurrency(k?.platformProfit.value)}
          change={k?.platformProfit.change}
          icon={<Percent size={18} />}
          tone="violet"
          loading={isLoading}
        />
        <KpiCard
          label="المعاملات اليوم"
          value={formatNumber(k?.transactionsToday.value)}
          change={k?.transactionsToday.change}
          icon={<Activity size={18} />}
          tone="cyan"
          loading={isLoading}
        />
        <KpiCard
          label="رضا العملاء"
          value={k?.satisfaction.value ? `${formatNumber(k.satisfaction.value)} / 5` : "—"}
          hint={k?.satisfaction.count ? `${formatNumber(k.satisfaction.count)} تقييم` : undefined}
          change={k?.satisfaction.change}
          icon={<Star size={18} />}
          tone="amber"
          loading={isLoading}
        />
      </section>

      {/* ── trend + order mix ───────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="الإيرادات خلال آخر 7 أيام" className="xl:col-span-2">
          <TrendChart
            data={(data?.revenueTrend ?? []).map((d) => ({
              label: new Date(d.date).toLocaleDateString("ar-IQ-u-nu-latn", {
                day: "numeric",
                month: "numeric",
              }),
              value: d.revenue,
            }))}
          />
        </Panel>

        <Panel title="توزيع الطلبات حسب الحالة">
          <DonutChart
            data={orderSlices}
            centerValue={formatNumber(data?.health.totalOrders)}
            centerLabel="إجمالي الطلبات"
          />
          <div className="mt-3">
            <DonutLegend data={orderSlices} />
          </div>
        </Panel>
      </section>

      {/* ── revenue mix + partners ──────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="الإيرادات حسب نوع الخدمة">
          <DonutChart
            data={serviceSlices}
            money
            centerValue={formatCurrency(k?.totalRevenue.value, { symbol: false })}
            centerLabel="د.ع"
          />
          <div className="mt-3">
            <DonutLegend money data={serviceSlices} />
          </div>
        </Panel>

        <Panel title="الشركاء الأعلى إيراداً">
          {data?.topPartners.length ? (
            <ul className="divide-y divide-border">
              {data.topPartners.map((p, i) => (
                <li key={p.partnerId ?? i} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                    {formatNumber(i + 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {p.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {p.type ? (PARTNER_TYPE_LABELS[p.type] ?? p.type) : "—"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    {formatCurrency(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Panel>

        <Panel title="الشركاء حسب الحالة">
          {data?.partnersByStatus.length ? (
            <ul className="divide-y divide-border">
              {data.partnersByStatus.map((s) => (
                <li key={s.status} className="flex items-center gap-3 py-2.5">
                  <StatusDot status={s.status} />
                  <span className="flex-1 text-sm text-muted-foreground">
                    {PARTNER_STATUS_LABELS[s.status] ?? s.status}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatNumber(s.count)}
                  </span>
                  <span className="w-10 text-end text-xs text-muted-foreground">
                    {formatNumber(s.percent)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Panel>
      </section>

      {/* ── activity + health ───────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="آخر النشاطات" className="lg:col-span-2">
          {data?.recentActivity.length ? (
            <ul className="divide-y divide-border">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-foreground">{a.action}</span>
                    <span className="block text-xs text-muted-foreground">
                      {a.user ?? "النظام"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Panel>

        <Panel title="أداء النظام">
          <dl className="space-y-3">
            <Stat label="إجمالي الطلبات" value={formatNumber(data?.health.totalOrders)} />
            <Stat label="الطلبات المكتملة" value={formatNumber(data?.health.completedOrders)} />
            <Stat
              label="معدل الإنجاز"
              value={
                data?.health.successRate != null
                  ? `${formatNumber(data.health.successRate)}%`
                  : "—"
              }
            />
            <Stat
              label="الخدمات النشطة"
              value={`${formatNumber(data?.health.activeServices)} / ${formatNumber(
                data?.health.totalServices
              )}`}
            />
          </dl>
          {/* Response time, uptime and error counts need instrumentation that
              does not exist yet, so they are absent rather than invented —
              /api/system-monitoring currently reports a fabricated healthy
              system, which is worse than showing nothing. */}
          <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
            مؤشرات زمن الاستجابة والأخطاء تتطلب ربط أدوات المراقبة.
          </p>
        </Panel>
      </section>
    </div>
  );
}

/* ------------------------------- pieces --------------------------------- */

const TONES: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function KpiCard({
  label,
  value,
  change,
  hint,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  change?: number | null;
  hint?: string;
  icon: React.ReactNode;
  tone: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONES[tone]}`}>
          {icon}
        </span>
        {/* `!= null` on purpose: the API sends null, and a `!== undefined`
            guard rendered the literal string "+null%". */}
        {change != null ? (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
            }`}
          >
            {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {formatNumber(Math.abs(change))}%
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="h-7 w-24 animate-pulse rounded-lg bg-muted" />
      ) : (
        <p className="truncate text-xl font-bold text-foreground">{value}</p>
      )}
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 sm:p-5 ${className}`}>
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? "bg-emerald-500"
      : status === "PENDING"
        ? "bg-amber-500"
        : status === "PAUSED"
          ? "bg-blue-500"
          : "bg-destructive";
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} />;
}

function Empty() {
  return <p className="py-6 text-center text-sm text-muted-foreground">لا توجد بيانات بعد</p>;
}
