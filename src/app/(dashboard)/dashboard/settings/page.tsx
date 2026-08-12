"use client";

import { Building2, Phone, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { PageHeader, Pill, toneForStatus } from "@/components/data/crud-kit";
import {
  CHANNEL_LABELS,
  PARTNER_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
  USER_ROLE_LABELS,
  labelOf,
} from "@/lib/labels";

// ─────────────────────────────────────────────────────────────
// الإعدادات — linked from every partner role's menu, and the page did not exist.
//
// Deliberately READ-ONLY. A partner's name, phone, status, channels, services
// and commission percentages are contract terms: they are agreed with the
// platform and changed by an administrator, and every one of the endpoints
// behind them is ADMIN-scoped. A form here would be a form whose every save
// returned 403.
//
// So it shows what the account actually is, and says who to ask to change it —
// which is the honest version of this screen.
// ─────────────────────────────────────────────────────────────

type Me = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string;
  } | null;
};

type Partner = {
  id: string;
  name: string;
  type: string;
  status: string;
  phone: string;
  address: string | null;
  governorate: { name: string } | null;
  complex: { name: string } | null;
  channels: { channel: string; status: string }[];
  serviceConfigs?: { serviceType: string; status: string }[];
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 text-end text-sm text-foreground">{value}</span>
    </div>
  );
}

export default function PartnerSettingsPage() {
  const { data: me, isLoading } = useDashboardData<Me>({ url: "/api/v1/me" });
  // `/api/partners/me` does not exist; the partner's own record comes back on
  // the identity endpoint the rest of the dashboard already uses.
  const { data: partner } = useDashboardData<Partner>({ url: "/api/partners/me" });

  const user = me?.user;

  return (
    <div className="space-y-5">
      <PageHeader
        title="الإعدادات"
        subtitle="بيانات حسابك كما هي مسجّلة لدى المنصة"
        icon={SettingsIcon}
      />

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <ShieldCheck size={18} className="text-primary" aria-hidden />
          الحساب
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <div>
            <Row label="الاسم" value={user?.name ?? "—"} />
            <Row
              label="البريد الإلكتروني"
              value={user?.email ? <span dir="ltr">{user.email}</span> : "—"}
            />
            <Row
              label="رقم الهاتف"
              value={user?.phone ? <span dir="ltr">{user.phone}</span> : "—"}
            />
            <Row label="الصلاحية" value={labelOf(USER_ROLE_LABELS, user?.role)} />
          </div>
        )}
      </section>

      {partner ? (
        <>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
              <Building2 size={18} className="text-primary" aria-hidden />
              بيانات المزوّد
            </h2>
            <Row label="الاسم التجاري" value={partner.name} />
            <Row label="النوع" value={labelOf(PARTNER_TYPE_LABELS, partner.type)} />
            <Row
              label="الحالة"
              value={
                <Pill tone={toneForStatus(partner.status)}>
                  {labelOf(PARTNER_STATUS_LABELS, partner.status)}
                </Pill>
              }
            />
            <Row
              label="الموقع"
              value={
                [partner.governorate?.name, partner.address].filter(Boolean).join(" - ") || "—"
              }
            />
            <Row label="المجمع" value={partner.complex?.name ?? "غير منتسب لمجمع"} />
            <Row
              label="الواجهات"
              value={
                partner.channels.length > 0 ? (
                  <span className="flex flex-wrap justify-end gap-1">
                    {partner.channels.map((c) => (
                      <Pill key={c.channel} tone="info">
                        {labelOf(CHANNEL_LABELS, c.channel)}
                      </Pill>
                    ))}
                  </span>
                ) : (
                  "—"
                )
              }
            />
          </section>

          {partner.serviceConfigs && partner.serviceConfigs.length > 0 ? (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 text-base font-semibold text-foreground">الخدمات المفعّلة</h2>
              <div className="flex flex-wrap gap-1.5">
                {partner.serviceConfigs.map((s) => (
                  <Pill key={s.serviceType} tone={s.status === "ACTIVE" ? "positive" : "neutral"}>
                    {labelOf(SERVICE_TYPE_LABELS, s.serviceType)}
                  </Pill>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Phone size={14} className="mt-0.5 shrink-0" aria-hidden />
        هذه البيانات جزء من عقدك مع المنصة — لتعديل الاسم أو الخدمات أو النسب تواصل
        مع إدارة وريد.
      </p>
    </div>
  );
}
