"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { KeyRound, UserCog, Wallet } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useServerFilters } from "@/hooks/use-server-filters";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader, Pill } from "@/components/data/crud-kit";
import { ServerFilterBar } from "@/components/data/server-filter-bar";
import { formatDate, formatNumber } from "@/lib/format";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// المستخدمون — إدارة الحسابات (req L265)
//
// This page said "User CRUD, role assignment, enable/disable" in its header and
// did none of it: "إضافة مستخدم" and "تعديل" were buttons with no handler,
// while the API behind them already supported every operation. The owner could
// not switch off a single account, patient or staff.
//
// It also could not have made a staff login work even with the buttons wired:
// an account created here had no password, and nothing in the product could
// set one — onboarding deliberately leaves it blank for "an administrator to
// set afterwards", with nowhere to do so. `كلمة المرور` below is that place.
//
// Provider accounts (doctor, lab, pharmacy…) are NOT created here. They are
// half of a pair with a Partner record, and /admin/partners creates both
// together. They are listed, edited and given passwords here like any other.
// ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "مدير عام",
  OPERATIONS: "عمليات",
  DOCTOR: "طبيب",
  LAB: "مختبر",
  PHARMACY: "صيدلية",
  NURSE: "تمريض",
  DRIVER: "سائق",
  RADIOLOGY: "أشعة",
  PATIENT: "مريض",
};

/** Created here. Providers come from onboarding — see the header. */
const CREATABLE_ROLES = ["OPERATIONS", "SUPER_ADMIN", "PATIENT"] as const;

/** Mirrors `PASSWORD_ROLES` on the server: everyone but a patient. */
const hasPasswordLogin = (role: string) => role !== "PATIENT";

/**
 * Only a patient holds a `PatientWallet`, and the endpoint behind this lives at
 * /api/patients/[id]/wallet — so the action is offered on patient rows only.
 */
const hasWallet = (role: string) => role === "PATIENT";

/** `reason` as the endpoint's schema spells it. PAYMENT is a debit reason. */
type WalletReason = "TOPUP" | "REFUND" | "REWARD" | "PAYMENT";

const CREDIT_REASONS: { value: WalletReason; label: string }[] = [
  { value: "TOPUP", label: "شحن رصيد" },
  { value: "REFUND", label: "استرجاع" },
  { value: "REWARD", label: "مكافأة" },
];

type User = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  hasPassword: boolean;
  createdAt: string;
  partner: { id: string; name: string } | null;
};

type Draft = {
  name: string;
  email: string;
  phone: string;
  role: string;
  password: string;
  isActive: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  email: "",
  phone: "",
  role: "OPERATIONS",
  password: "",
  isActive: true,
};

const EMPTY_FILTERS = { q: "", role: "", status: "" };

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; user: User }
  | { kind: "password"; user: User }
  | { kind: "role"; user: User }
  | { kind: "delete"; user: User }
  | { kind: "wallet"; user: User }
  | null;

export default function UsersPage() {
  const filters = useServerFilters(EMPTY_FILTERS);
  const { data, isLoading, error, refetch } = useDashboardData<User[]>({
    url: "/api/users",
    params: { limit: "100", ...filters.params },
  });

  const [dialog, setDialog] = useState<Dialog>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [password, setPassword] = useState("");
  const [nextRole, setNextRole] = useState("");
  // محفظة المريض — amount is held as a STRING so the field can be empty and so
  // a half-typed number never becomes 0.
  const [walletAmount, setWalletAmount] = useState("");
  const [walletDirection, setWalletDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [walletReason, setWalletReason] = useState<WalletReason>("TOPUP");
  const [walletNote, setWalletNote] = useState("");

  const close = useCallback(() => {
    setDialog(null);
    setDraft(EMPTY_DRAFT);
    setPassword("");
    setNextRole("");
    setWalletAmount("");
    setWalletDirection("CREDIT");
    setWalletReason("TOPUP");
    setWalletNote("");
  }, []);

  const done = useCallback(() => {
    close();
    void refetch();
  }, [close, refetch]);

  /* ------------------------------- mutations ------------------------------ */

  const { mutate: create, isPending: creating } = useMutation(
    async () =>
      apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: draft.name.trim() || undefined,
          email: draft.email.trim() || undefined,
          phone: draft.phone.trim() || undefined,
          role: draft.role,
          isActive: draft.isActive,
          // Only staff sign in with a password; the server refuses one for a
          // patient, so it is never sent for one.
          password: hasPasswordLogin(draft.role) && draft.password ? draft.password : undefined,
        }),
      }),
    { successMessage: "تم إنشاء الحساب", onSuccess: done }
  );

  const { mutate: update, isPending: updating } = useMutation(
    async (id: string) =>
      apiFetch(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name.trim() || undefined,
          email: draft.email.trim() || undefined,
          phone: draft.phone.trim() || undefined,
          isActive: draft.isActive,
        }),
      }),
    { successMessage: "تم تحديث الحساب", onSuccess: done }
  );

  const { mutate: setActive, isPending: toggling } = useMutation(
    async (id: string, isActive: boolean) =>
      apiFetch(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    { successMessage: "تم تحديث حالة الحساب", onSuccess: () => void refetch() }
  );

  const { mutate: savePassword, isPending: savingPassword } = useMutation(
    async (id: string) =>
      apiFetch(`/api/users/${id}/password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
    { successMessage: "تم تعيين كلمة المرور", onSuccess: done }
  );

  const { mutate: changeRole, isPending: changingRole } = useMutation(
    async (id: string) =>
      apiFetch(`/api/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role: nextRole }) }),
    { successMessage: "تم تغيير الدور", onSuccess: done }
  );

  // The wallet being adjusted, read live so the admin sees the balance they
  // are changing rather than one cached from a list.
  const walletUserId = dialog?.kind === "wallet" ? dialog.user.id : null;
  const { data: walletData, isLoading: walletLoading } = useDashboardData<{
    balance: number;
  }>({
    url: walletUserId ? `/api/patients/${walletUserId}/wallet` : "",
    enabled: Boolean(walletUserId),
  });

  const { mutate: adjustWallet, isPending: adjusting } = useMutation<{ balance: number }, [string]>(
    async (userId: string) =>
      apiFetch(`/api/patients/${userId}/wallet`, {
        method: "POST",
        body: JSON.stringify({
          direction: walletDirection,
          amount: Number(walletAmount),
          // PAYMENT is the only debit reason the schema takes; a credit always
          // carries one of the three above.
          reason: walletDirection === "DEBIT" ? "PAYMENT" : walletReason,
          description: walletNote.trim() || undefined,
        }),
      }),
    {
      successMessage: null,
      onSuccess: (r) => {
        toast.success(
          `${walletDirection === "CREDIT" ? "تم إيداع" : "تم خصم"} ${formatNumber(Number(walletAmount))} د.ع — الرصيد الآن ${formatNumber(r.balance)} د.ع`
        );
        done();
      },
    }
  );

  const { mutate: remove, isPending: removing } = useMutation(
    async (id: string) => apiFetch(`/api/users/${id}`, { method: "DELETE" }),
    { successMessage: "تم حذف الحساب", onSuccess: done }
  );

  const openEdit = useCallback((user: User) => {
    setDraft({
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      role: user.role,
      password: "",
      isActive: user.isActive,
    });
    setDialog({ kind: "edit", user });
  }, []);

  /* -------------------------------- columns ------------------------------- */

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "الحساب",
      render: (u) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{u.name || "بلا اسم"}</p>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {u.email ?? u.phone ?? "—"}
          </p>
        </div>
      ),
      sortValue: (u) => u.name ?? "",
    },
    {
      key: "role",
      header: "الدور",
      render: (u) => (
        <div className="min-w-0">
          <Pill tone={u.role === "SUPER_ADMIN" ? "danger" : u.role === "PATIENT" ? "neutral" : "info"}>
            {ROLE_LABELS[u.role] ?? u.role}
          </Pill>
          {u.partner ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{u.partner.name}</p>
          ) : null}
        </div>
      ),
      sortValue: (u) => u.role,
    },
    {
      key: "login",
      header: "الدخول",
      secondary: true,
      render: (u) =>
        hasPasswordLogin(u.role) ? (
          // The column that answers "can this person actually sign in?" —
          // before, a provider onboarded without a password looked exactly like
          // one who could.
          u.hasPassword ? (
            <span className="text-xs text-muted-foreground">كلمة مرور</span>
          ) : (
            <Pill tone="warning">بلا كلمة مرور</Pill>
          )
        ) : (
          <span className="text-xs text-muted-foreground">رمز الهاتف</span>
        ),
    },
    {
      key: "isActive",
      header: "الحالة",
      render: (u) => (
        <Pill tone={u.isActive ? "positive" : "neutral"}>{u.isActive ? "فعّال" : "موقوف"}</Pill>
      ),
    },
    {
      key: "createdAt",
      header: "تاريخ الإنشاء",
      secondary: true,
      render: (u) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(u.createdAt)}</span>
      ),
      sortValue: (u) => new Date(u.createdAt).getTime(),
    },
  ];

  const busy = toggling || removing || adjusting;

  return (
    <div className="space-y-5">
      <PageHeader
        title="المستخدمون"
        subtitle="الحسابات وكلمات المرور والحالة — أضف حسابات الأطباء والمختبرات من صفحة الشركاء"
        icon={UserCog}
        action={{
          label: "إضافة مستخدم",
          onClick: () => {
            setDraft(EMPTY_DRAFT);
            setDialog({ kind: "create" });
          },
        }}
      />

      {/* Server-backed: the list is paged, so a browser-side search would only
          ever search the first hundred accounts. */}
      <ServerFilterBar
        idPrefix="users"
        search={{ placeholder: "بحث بالاسم أو البريد أو الهاتف..." }}
        selects={[
          {
            key: "role",
            label: "الدور",
            placeholder: "كل الأدوار",
            options: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
          },
          {
            key: "status",
            label: "الحالة",
            placeholder: "كل الحالات",
            options: [
              { value: "active", label: "فعّال" },
              { value: "inactive", label: "موقوف" },
            ],
          },
        ]}
        values={filters.values}
        onChange={(key, value) => filters.set(key as keyof typeof EMPTY_FILTERS, value)}
        isActive={filters.isActive}
        onReset={filters.reset}
      />

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        emptyMessage={filters.isActive ? "لا حسابات تطابق البحث" : "لا توجد حسابات بعد"}
        actions={(u) => (
          <div className="flex items-center justify-end gap-1.5">
            <RowButton onClick={() => openEdit(u)} disabled={busy}>
              تعديل
            </RowButton>
            {hasPasswordLogin(u.role) ? (
              <RowButton
                onClick={() => {
                  setPassword("");
                  setDialog({ kind: "password", user: u });
                }}
                disabled={busy}
              >
                كلمة المرور
              </RowButton>
            ) : null}
            <RowButton
              onClick={() => {
                setNextRole(u.role);
                setDialog({ kind: "role", user: u });
              }}
              disabled={busy}
            >
              الدور
            </RowButton>
            {hasWallet(u.role) ? (
              <RowButton onClick={() => setDialog({ kind: "wallet", user: u })} disabled={busy}>
                المحفظة
              </RowButton>
            ) : null}
            <RowButton onClick={() => void setActive(u.id, !u.isActive)} disabled={busy}>
              {u.isActive ? "إيقاف" : "تفعيل"}
            </RowButton>
            <RowButton onClick={() => setDialog({ kind: "delete", user: u })} disabled={busy} danger>
              حذف
            </RowButton>
          </div>
        )}
      />

      {/* ── create / edit ──────────────────────────────────────── */}
      <FormDialog
        open={dialog?.kind === "create" || dialog?.kind === "edit"}
        title={dialog?.kind === "edit" ? "تعديل الحساب" : "حساب جديد"}
        description={
          dialog?.kind === "edit"
            ? (dialog.user.name ?? dialog.user.email ?? undefined)
            : "للإدارة والعمليات والمرضى — الشركاء يُضافون من صفحة الشركاء"
        }
        onClose={close}
        onSubmit={() =>
          void (dialog?.kind === "edit" ? update(dialog.user.id) : create())
        }
        isPending={creating || updating}
        submitDisabled={
          (draft.email.trim() === "" && draft.phone.trim() === "") ||
          // A new staff account without a password is one that cannot sign in.
          (dialog?.kind === "create" && hasPasswordLogin(draft.role) && draft.password.length < 10)
        }
      >
        <Field label="الاسم" htmlFor="u-name">
          <input
            id="u-name"
            className={fieldClass}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="البريد الإلكتروني" htmlFor="u-email">
            <input
              id="u-email"
              type="email"
              dir="ltr"
              className={fieldClass}
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            />
          </Field>
          <Field label="رقم الهاتف" htmlFor="u-phone" hint="البريد أو الهاتف مطلوب">
            <input
              id="u-phone"
              type="tel"
              dir="ltr"
              className={fieldClass}
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              placeholder="07701234567"
            />
          </Field>
        </div>

        {dialog?.kind === "create" ? (
          <>
            <Field
              label="الدور"
              htmlFor="u-role"
              hint="لإضافة طبيب أو مختبر أو صيدلية استخدم صفحة الشركاء"
            >
              <select
                id="u-role"
                className={fieldClass}
                value={draft.role}
                onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
              >
                {CREATABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </Field>

            {hasPasswordLogin(draft.role) ? (
              <PasswordField value={draft.password} onChange={(v) => setDraft((d) => ({ ...d, password: v }))} />
            ) : (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                المرضى يدخلون برمز يُرسل إلى هواتفهم — لا كلمة مرور لهم.
              </p>
            )}
          </>
        ) : null}

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
            checked={draft.isActive}
            onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
          />
          الحساب فعّال
        </label>
      </FormDialog>

      {/* ── password ───────────────────────────────────────────── */}
      {/* محفظة المريض — «admin can add money to wallet».
          POST /api/patients/[id]/wallet has supported this since it was
          written (it even logs every adjustment to ActivityLog, because money
          moved by hand is the first thing anyone asks about later) and no
          screen ever called it, so no admin could put a dinar into a wallet. */}
      <FormDialog
        open={dialog?.kind === "wallet"}
        title="محفظة المريض"
        description={
          dialog?.kind === "wallet"
            ? `${dialog.user.name ?? dialog.user.phone ?? dialog.user.email ?? ""}`
            : undefined
        }
        onClose={close}
        onSubmit={() => void (dialog?.kind === "wallet" && adjustWallet(dialog.user.id))}
        isPending={adjusting}
        submitLabel={walletDirection === "CREDIT" ? "إيداع" : "خصم"}
        submitDisabled={!(Number(walletAmount) > 0)}
      >
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">الرصيد الحالي: </span>
          {/* «—» while unknown: a patient with no wallet row and a failed read
              are both "we do not know", and 0 is a real balance. */}
          <span className="font-bold text-foreground">
            {walletLoading || !walletData ? "—" : `${formatNumber(walletData.balance)} د.ع`}
          </span>
        </div>

        <Field label="العملية" htmlFor="wallet-direction">
          <select
            id="wallet-direction"
            className={fieldClass}
            value={walletDirection}
            onChange={(e) => setWalletDirection(e.target.value as "CREDIT" | "DEBIT")}
          >
            <option value="CREDIT">إيداع — إضافة رصيد</option>
            <option value="DEBIT">خصم — سحب رصيد</option>
          </select>
        </Field>

        <Field label="المبلغ (د.ع)" htmlFor="wallet-amount">
          <input
            id="wallet-amount"
            type="number"
            min="1"
            step="250"
            inputMode="numeric"
            className={fieldClass}
            value={walletAmount}
            onChange={(e) => setWalletAmount(e.target.value)}
            placeholder="مثال: 25000"
          />
        </Field>

        {walletDirection === "CREDIT" ? (
          <Field label="السبب" htmlFor="wallet-reason">
            <select
              id="wallet-reason"
              className={fieldClass}
              value={walletReason}
              onChange={(e) => setWalletReason(e.target.value as WalletReason)}
            >
              {CREDIT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="ملاحظة (اختياري)" htmlFor="wallet-note" hint="تظهر للمريض في سجل معاملاته">
          <input
            id="wallet-note"
            className={fieldClass}
            value={walletNote}
            onChange={(e) => setWalletNote(e.target.value)}
            maxLength={160}
            placeholder="مثال: شحن مقابل خدمة"
          />
        </Field>

        <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          كل عملية تُسجَّل باسمك في سجل النشاط، وتظهر فوراً في محفظة المريض.
          الخصم يُرفض إذا كان الرصيد غير كافٍ.
        </p>
      </FormDialog>

      <FormDialog
        open={dialog?.kind === "password"}
        title={dialog?.kind === "password" && dialog.user.hasPassword ? "إعادة تعيين كلمة المرور" : "تعيين كلمة المرور"}
        description={
          dialog?.kind === "password"
            ? `${dialog.user.name ?? dialog.user.email ?? ""} — تنتهي كل جلسات الحساب المفتوحة عند الحفظ`
            : undefined
        }
        onClose={close}
        onSubmit={() => void (dialog?.kind === "password" && savePassword(dialog.user.id))}
        isPending={savingPassword}
        submitLabel="حفظ"
        submitDisabled={password.length < 10}
      >
        <PasswordField value={password} onChange={setPassword} />
        <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          سلّم كلمة المرور لصاحب الحساب مباشرة. لا تُرسل تلقائياً — لا توجد قناة
          بريد أو رسائل مهيّأة للموظفين بعد.
        </p>
      </FormDialog>

      {/* ── role ───────────────────────────────────────────────── */}
      <FormDialog
        open={dialog?.kind === "role"}
        title="تغيير الدور"
        description={dialog?.kind === "role" ? (dialog.user.name ?? dialog.user.email ?? undefined) : undefined}
        onClose={close}
        onSubmit={() => void (dialog?.kind === "role" && changeRole(dialog.user.id))}
        isPending={changingRole}
        submitDisabled={dialog?.kind !== "role" || nextRole === dialog.user.role}
      >
        <Field
          label="الدور الجديد"
          htmlFor="u-next-role"
          hint="حسابات الشركاء تُغيَّر من صفحة الشركاء، لأن نوع الشريك يحدّد توجيه الطلبات والتسويات"
        >
          <select
            id="u-next-role"
            className={fieldClass}
            value={nextRole}
            onChange={(e) => setNextRole(e.target.value)}
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </FormDialog>

      {/* ── delete ─────────────────────────────────────────────── */}
      <FormDialog
        open={dialog?.kind === "delete"}
        title="حذف الحساب"
        description={
          dialog?.kind === "delete"
            ? `«${dialog.user.name ?? dialog.user.email ?? dialog.user.phone ?? ""}» — يُغلق الحساب وتنتهي جلساته. سجلّاته الطبية وطلباته تبقى محفوظة، ويُحرَّر رقمه وبريده لتسجيل جديد.`
            : undefined
        }
        submitLabel="حذف"
        submitTone="danger"
        onClose={close}
        onSubmit={() => void (dialog?.kind === "delete" && remove(dialog.user.id))}
        isPending={removing}
      />

      <p className="text-xs text-muted-foreground">
        تغيير أدوار عدة حسابات دفعة واحدة من{" "}
        <Link href="/admin/roles" className="text-primary hover:underline">
          الصلاحيات والأدوار
        </Link>
        .
      </p>
    </div>
  );
}

/* --------------------------------- pieces --------------------------------- */

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="كلمة المرور" htmlFor="u-password" hint="10 أحرف على الأقل — عبارة طويلة أقوى من رموز معقّدة">
      <input
        id="u-password"
        type="password"
        dir="ltr"
        // "new-password" so the browser offers to generate one and never
        // autofills the ADMIN's own saved password into someone else's account.
        autoComplete="new-password"
        className={fieldClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={72}
      />
    </Field>
  );
}

function RowButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50 ${
        danger ? "text-destructive hover:bg-destructive/10" : "text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
