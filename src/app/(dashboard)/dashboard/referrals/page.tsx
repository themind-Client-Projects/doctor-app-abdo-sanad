"use client";

import { useCallback, useMemo, useState } from "react";
import { Building2, Share2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/data/crud-kit";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { SearchableSelect, type SelectOption } from "@/components/data/searchable-select";
import { PipelineStrip, StagePill, useStageCounts, type Stage } from "@/components/data/status-pipeline";
import {
  readAttachments,
  useMyPatients,
  useReferrals,
  type Referral,
  type ReferralAttachment,
} from "@/hooks/use-referrals";
import {
  PARTNER_TYPE_LABELS,
  REFERRAL_PRIORITY_LABELS,
  SERVICE_TYPE_LABELS,
} from "@/lib/labels";
import {
  ClinicalFields,
  emptyClinical,
  isClinicalComplete,
  type ClinicalDraft,
} from "@/components/features/referrals/clinical-fields";
import { ReReferDialog } from "@/components/features/referrals/re-refer-dialog";
import {
  KIND_RECIPIENTS,
  REFERRAL_KINDS,
  REFERRAL_KIND_LABELS,
  type ReferralKind,
} from "@/server/services/referral-forms";
import { formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// الإحالات داخل المجمّع
//
// A doctor inside a complex sends the patient's case to ITS pharmacy or ITS
// lab; they reply with the result, a description, files and a status.
//
// Only members see this screen at all — the sidebar hides it otherwise, and a
// partner who reaches the URL directly gets an explanation rather than an empty
// table that looks broken.
// ─────────────────────────────────────────────────────────────

const STAGES: readonly Stage[] = [
  { key: "sent", label: "مُرسلة", tone: "info" },
  { key: "received", label: "تم الاستلام", tone: "info" },
  { key: "in_progress", label: "قيد التنفيذ", tone: "warning" },
  { key: "completed", label: "مكتملة", tone: "positive" },
  { key: "cancelled", label: "ملغاة", tone: "danger" },
];

/** What the RECIPIENT may move a referral to. Mirrors the server's machine. */
const RECIPIENT_NEXT: Record<string, string[]> = {
  sent: ["received", "in_progress", "completed"],
  received: ["in_progress", "completed"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

/** عادي / مهم / عاجل — from `labels.ts`, so the form and the printed sheet agree. */
const PRIORITY_OPTIONS = Object.entries(REFERRAL_PRIORITY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * One class for every row action, so the buttons do not drift apart.
 *
 * `whitespace-nowrap` because the cell can now hold up to four controls, and
 * "إعادة الإحالة" is two words — without it the label wraps mid-phrase at
 * narrow widths and the row grows a second line.
 */
const rowActionClass =
  "whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50";

const partnerLabel = (type: string) =>
  PARTNER_TYPE_LABELS[type as keyof typeof PARTNER_TYPE_LABELS] ?? type;

const serviceLabel = (key: string | null) =>
  key ? (SERVICE_TYPE_LABELS[key as keyof typeof SERVICE_TYPE_LABELS] ?? key) : "—";

export default function ReferralsPage() {
  const {
    box,
    setBox,
    stage,
    setStage,
    rows,
    all,
    isLoading,
    error,
    refetch,
    complex,
    recipients,
    isContextLoading,
    send,
    isSending,
    respond,
    isResponding,
  } = useReferrals("inbox");

  // Only the send form needs the patient list, and only members can send.
  const { patients } = useMyPatients(complex !== null);

  const [sendOpen, setSendOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Referral | null>(null);
  const [reReferFrom, setReReferFrom] = useState<Referral | null>(null);

  const counts = useStageCounts(all, STAGES, (r) => r.status);

  const columns: Column<Referral>[] = useMemo(
    () => [
      {
        key: "patient",
        header: "المريض",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.patientName}</p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {r.patientPhone}
            </p>
          </div>
        ),
        sortValue: (r) => r.patientName,
      },
      {
        key: "title",
        header: "الطلب",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.title}</p>
            <p className="truncate text-xs text-muted-foreground">{serviceLabel(r.serviceType)}</p>
            {/* The chain, in whichever direction it exists. Without this a
                re-referral is invisible in the list and the two documents look
                unrelated. */}
            {r.parent ? (
              <p className="truncate text-[11px] text-muted-foreground">
                متابعة لـ <span className="font-mono" dir="ltr">{r.parent.referenceNumber}</span>
              </p>
            ) : null}
            {r.children.length > 0 ? (
              <p className="truncate text-[11px] text-muted-foreground">
                أُعيدت الإحالة —{" "}
                <span className="font-mono" dir="ltr">
                  {r.children.map((c) => c.referenceNumber).join("، ")}
                </span>
              </p>
            ) : null}
          </div>
        ),
        sortValue: (r) => r.title,
      },
      {
        key: "party",
        header: "الطرف الآخر",
        render: (r) => {
          // Incoming shows the sender, outgoing the recipient — the column is
          // "who is on the other end", which flips with direction.
          const party = r.direction === "incoming" ? r.fromPartner : r.toPartner;
          return (
            <div className="min-w-0">
              <p className="truncate text-foreground">{party.name}</p>
              <p className="truncate text-xs text-muted-foreground">{partnerLabel(party.type)}</p>
            </div>
          );
        },
        sortValue: (r) => (r.direction === "incoming" ? r.fromPartner.name : r.toPartner.name),
      },
      {
        key: "status",
        header: "الحالة",
        render: (r) => <StagePill stages={STAGES} value={r.status} />,
      },
      {
        key: "result",
        header: "النتيجة",
        render: (r) => {
          const files = readAttachments(r.attachments);
          if (!r.resultSummary && files.length === 0) {
            return <span className="text-xs text-muted-foreground">بانتظار الرد</span>;
          }
          return (
            <div className="min-w-0">
              {r.resultSummary ? (
                <p className="truncate text-xs text-foreground">{r.resultSummary}</p>
              ) : null}
              {files.length > 0 ? (
                <p className="text-xs text-muted-foreground">{files.length} مرفق</p>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "createdAt",
        header: "التاريخ",
        secondary: true,
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(r.createdAt)}
          </span>
        ),
        sortValue: (r) => new Date(r.createdAt).getTime(),
      },
    ],
    []
  );

  const withdraw = useCallback(
    (r: Referral) => void respond(r.id, { status: "cancelled" }),
    [respond]
  );

  // Not in a complex: say so, rather than showing an empty table.
  if (!isContextLoading && !complex) {
    return (
      <div className="space-y-5">
        <PageHeader title="الإحالات" subtitle="إحالة المرضى داخل المجمّع الطبي" icon={Share2} />
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Building2 className="mx-auto mb-3 text-muted-foreground" size={32} />
          <p className="font-medium text-foreground">حسابك غير مرتبط بمجمّع طبي</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            الإحالة تتم بين أعضاء المجمّع الواحد — طبيب يحيل مريضاً إلى صيدلية أو مختبر المجمّع
            نفسه. لانتساب حسابك إلى مجمّع، راجع إدارة وريد.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="الإحالات"
        subtitle={complex ? `داخل «${complex.name}»` : "إحالة المرضى داخل المجمّع الطبي"}
        icon={Share2}
        action={
          recipients.length > 0
            ? { label: "إحالة مريض", onClick: () => setSendOpen(true) }
            : undefined
        }
      />

      {/* Direction. Two lists over one endpoint — `?box=` is a server filter,
          so switching does not fetch every referral and hide half in the browser. */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1" role="tablist">
        {(
          [
            ["inbox", "الواردة إليّ"],
            ["outbox", "التي أرسلتها"],
            ["all", "الكل"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={box === key}
            onClick={() => setBox(key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              box === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <PipelineStrip stages={STAGES} counts={counts} active={stage} onSelect={setStage} />

      <DataTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.patientName} ${r.patientPhone} ${r.title} ${r.fromPartner.name} ${r.toPartner.name}`}
        searchPlaceholder="بحث باسم المريض أو الطلب..."
        emptyMessage={stage ? "لا إحالات في هذه الحالة" : "لا إحالات بعد"}
        actions={(r) => (
          <div className="flex items-center justify-end gap-1.5">
            {r.direction === "incoming" && RECIPIENT_NEXT[r.status]?.length ? (
              <button
                type="button"
                onClick={() => setReplyTo(r)}
                disabled={isResponding}
                className={`${rowActionClass} text-foreground`}
              >
                الرد
              </button>
            ) : null}

            {/* إعادة الإحالة — available to whichever side is holding the case
                now. A lab that finished a test sends the patient on to the
                pharmacy; a doctor whose result came back re-refers onward.
                Withdrawn documents are excluded: continuing a chain from a
                referral that never happened would assert care that never
                occurred.

                Not for `observed` — a platform role is watching, not treating,
                and the server refuses their send with 422 because they belong
                to no complex. Offering a button that cannot succeed is worse
                than offering none. */}
            {r.status !== "cancelled" && r.direction !== "observed" ? (
              <button
                type="button"
                onClick={() => setReReferFrom(r)}
                disabled={isSending}
                className={`${rowActionClass} text-foreground`}
              >
                إعادة الإحالة
              </button>
            ) : null}

            {/* A new tab, not a route change: the reviewer is mid-worklist and
                the sheet is a document to print, not a place to navigate to. */}
            <a
              href={`/referrals/${r.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${rowActionClass} text-muted-foreground`}
            >
              طباعة
            </a>

            {r.direction === "outgoing" && (r.status === "sent" || r.status === "received") ? (
              <button
                type="button"
                onClick={() => withdraw(r)}
                disabled={isResponding}
                className={`${rowActionClass} text-muted-foreground`}
              >
                سحب
              </button>
            ) : null}
          </div>
        )}
      />

      <SendReferralDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        recipients={recipients}
        patients={patients.map<SelectOption>((p) => ({
          value: p.id,
          label: p.name ?? "—",
          hint: p.phone ?? undefined,
        }))}
        isPending={isSending}
        onSubmit={async (input) => {
          const created = await send(input);
          if (created) setSendOpen(false);
        }}
      />

      <RespondDialog
        referral={replyTo}
        onClose={() => setReplyTo(null)}
        isPending={isResponding}
        onSubmit={async (input) => {
          if (!replyTo) return;
          const updated = await respond(replyTo.id, input);
          if (updated) setReplyTo(null);
        }}
      />

      <ReReferDialog
        source={reReferFrom}
        recipients={recipients}
        isPending={isSending}
        onClose={() => setReReferFrom(null)}
        onSubmit={async (input) => {
          const created = await send(input);
          if (created) setReReferFrom(null);
        }}
      />
    </div>
  );
}

/* ------------------------------ send dialog ------------------------------ */

function SendReferralDialog({
  open,
  onClose,
  recipients,
  patients,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  /** Every member of the complex, with their type — filtered per document below. */
  recipients: { id: string; name: string; type: string }[];
  patients: SelectOption[];
  isPending: boolean;
  onSubmit: (input: {
    kind: ReferralKind;
    toPartnerId: string;
    patientId: string;
    title: string;
    description?: string;
    priority: string;
    clinical: ClinicalDraft;
  }) => void;
}) {
  const [kind, setKind] = useState<ReferralKind>("PHARMACY");
  const [toPartnerId, setToPartnerId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [clinical, setClinical] = useState<ClinicalDraft>(() => emptyClinical("PHARMACY"));

  const reset = useCallback(() => {
    setKind("PHARMACY");
    setToPartnerId("");
    setPatientId("");
    setTitle("");
    setDescription("");
    setPriority("NORMAL");
    setClinical(emptyClinical("PHARMACY"));
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  /**
   * Changing the document changes the fields AND the eligible recipients.
   *
   * The clinical draft is reset rather than merged: carrying a drug list into a
   * radiology request would submit fields the server rejects, and carrying a
   * safety answer into a prescription would silently store a stale one.
   */
  const changeKind = useCallback((next: ReferralKind) => {
    setKind(next);
    setClinical(emptyClinical(next));
    setToPartnerId("");
  }, []);

  // A prescription goes to a pharmacy, not to a lab. Offering everyone and
  // letting the server refuse would be a round trip and a confusing error.
  const eligible = useMemo<SelectOption[]>(
    () =>
      recipients
        .filter((p) => KIND_RECIPIENTS[kind].includes(p.type))
        .map((p) => ({ value: p.id, label: p.name, hint: partnerLabel(p.type) })),
    [recipients, kind]
  );

  const clinicalReady = isClinicalComplete(kind, clinical);

  return (
    <FormDialog
      open={open}
      title={REFERRAL_KIND_LABELS[kind]}
      description="إلى عضو داخل مجمّعك — تُرسل إلكترونياً ويمكن طباعتها"
      onClose={close}
      isPending={isPending}
      submitLabel="إرسال"
      // Everything the server refuses, refused here first — including the
      // document's own required fields, so a radiology request cannot be sent
      // with the safety questions unanswered.
      submitDisabled={
        !toPartnerId || !patientId || title.trim() === "" || !clinicalReady
      }
      onSubmit={() =>
        onSubmit({
          kind,
          toPartnerId,
          patientId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          clinical,
        })
      }
    >
      <Field label="نوع النموذج" htmlFor="ref-kind">
        <select
          id="ref-kind"
          className={fieldClass}
          value={kind}
          onChange={(e) => changeKind(e.target.value as ReferralKind)}
        >
          {REFERRAL_KINDS.map((k) => (
            <option key={k} value={k}>
              {REFERRAL_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="المريض" htmlFor="ref-patient" hint="من مرضاك الذين لديك معهم حجز أو موعد أو إحالة">
        <SearchableSelect
          id="ref-patient"
          value={patientId}
          onChange={setPatientId}
          options={patients}
          placeholder="— اختر المريض —"
          emptyMessage="لا مرضى بعد"
        />
      </Field>

      <Field
        label="الجهة المستلمة"
        htmlFor="ref-to"
        hint={`${REFERRAL_KIND_LABELS[kind]} تُرسل إلى ${KIND_RECIPIENTS[kind]
          .map((t) => partnerLabel(t))
          .join(" أو ")} فقط`}
      >
        <SearchableSelect
          id="ref-to"
          value={toPartnerId}
          onChange={setToPartnerId}
          options={eligible}
          placeholder="— اختر الجهة —"
          emptyMessage={`لا ${KIND_RECIPIENTS[kind].map((t) => partnerLabel(t)).join(" أو ")} في مجمّعك`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="عنوان الطلب" htmlFor="ref-title">
          <input
            id="ref-title"
            className={fieldClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="صرف علاج / تحليل دم شامل"
            maxLength={160}
          />
        </Field>

        <Field label="مستوى الأولوية" htmlFor="ref-priority">
          <select
            id="ref-priority"
            className={fieldClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <ClinicalFields kind={kind} value={clinical} onChange={setClinical} />

      <Field label="سبب الطلب / التشخيص المبدئي" htmlFor="ref-desc">
        <textarea
          id="ref-desc"
          className={`${fieldClass} h-24 py-2.5`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
        />
      </Field>
    </FormDialog>
  );
}

/* ----------------------------- respond dialog ---------------------------- */

function RespondDialog({
  referral,
  onClose,
  isPending,
  onSubmit,
}: {
  referral: Referral | null;
  onClose: () => void;
  isPending: boolean;
  onSubmit: (input: {
    status?: string;
    resultSummary?: string;
    attachments?: ReferralAttachment[];
  }) => void;
}) {
  const [status, setStatus] = useState("");
  const [resultSummary, setResultSummary] = useState("");
  const [files, setFiles] = useState<ReferralAttachment[]>([]);
  // Remounts the body whenever a different referral is opened, so the fields
  // start from THAT referral's values rather than the previous one's.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (referral && loadedFor !== referral.id) {
    setLoadedFor(referral.id);
    setStatus("");
    setResultSummary(referral.resultSummary ?? "");
    setFiles(readAttachments(referral.attachments));
  }

  const nextStatuses = referral ? (RECIPIENT_NEXT[referral.status] ?? []) : [];
  // The server refuses to close a referral with nothing to show for it.
  const blocked = status === "completed" && resultSummary.trim() === "";

  return (
    <FormDialog
      open={referral !== null}
      title="الرد على الإحالة"
      description={referral ? `${referral.patientName} — ${referral.title}` : undefined}
      onClose={onClose}
      isPending={isPending}
      submitLabel="حفظ الرد"
      submitDisabled={blocked || (status === "" && resultSummary.trim() === "" && files.length === 0)}
      onSubmit={() =>
        onSubmit({
          status: status || undefined,
          resultSummary: resultSummary.trim() || undefined,
          attachments: files,
        })
      }
    >
      {referral?.description ? (
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">وصف المُحيل</p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{referral.description}</p>
        </div>
      ) : null}

      <Field label="الحالة" htmlFor="ref-status">
        <select
          id="ref-status"
          className={fieldClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">— دون تغيير —</option>
          {nextStatuses.map((key) => (
            <option key={key} value={key}>
              {STAGES.find((s) => s.key === key)?.label ?? key}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="النتيجة أو الوصف"
        htmlFor="ref-result"
        hint={blocked ? "مطلوب قبل إنهاء الإحالة" : "ما تم للمريض — صرف العلاج، نتيجة الفحص"}
      >
        <textarea
          id="ref-result"
          className={`${fieldClass} h-28 py-2.5`}
          value={resultSummary}
          onChange={(e) => setResultSummary(e.target.value)}
          maxLength={4000}
        />
      </Field>

      <AttachmentsField files={files} onChange={setFiles} />
    </FormDialog>
  );
}

/**
 * Result files, as links.
 *
 * Not a file picker: `SUPABASE_SERVICE_ROLE_KEY` is unset, so the storage admin
 * client cannot write to a bucket and every upload would fail. A link field
 * that works beats a picker that does not. The stored shape is the one an
 * upload endpoint would produce, so adding the picker later changes no data.
 */
function AttachmentsField({
  files,
  onChange,
}: {
  files: ReferralAttachment[];
  onChange: (files: ReferralAttachment[]) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  // Mirrors `safeUrl` closely enough that the button does not offer to add a
  // link the server will refuse. `//evil.example` is the one worth spelling
  // out: it starts with `/` and looks internal, but the browser reads it as
  // protocol-relative and goes off-site.
  const trimmed = url.trim();
  const urlOk =
    !trimmed.includes("\\") &&
    !trimmed.startsWith("//") &&
    (trimmed.startsWith("/") || /^https:\/\/\S+$/i.test(trimmed));

  const canAdd = name.trim() !== "" && trimmed !== "" && urlOk && files.length < 10;

  const add = useCallback(() => {
    if (!canAdd) return;
    onChange([...files, { name: name.trim(), url: trimmed }]);
    setName("");
    setUrl("");
  }, [canAdd, files, name, trimmed, onChange]);

  return (
    <div>
      <p className="mb-1.5 block text-[13px] font-semibold text-foreground">المرفقات</p>

      {files.length > 0 ? (
        <ul className="mb-2 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.url}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
            >
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm text-primary hover:underline"
              >
                {f.name}
              </a>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, index) => index !== i))}
                className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                aria-label={`إزالة ${f.name}`}
              >
                إزالة
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        <input
          className={`${fieldClass} flex-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم المرفق"
          maxLength={120}
          aria-label="اسم المرفق"
        />
        <input
          className={`${fieldClass} flex-1`}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          dir="ltr"
          aria-label="رابط المرفق"
        />
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="shrink-0 rounded-xl border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          إضافة
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        رابط يبدأ بـ https:// — حتى 10 مرفقات
      </p>
    </div>
  );
}
