"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, ImageIcon, ScanLine } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useStageMutation } from "@/hooks/use-stage-mutation";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { useRole } from "@/hooks/use-role";
import { DataTable, type Column } from "@/components/data/data-table";
import { Field, FormDialog, fieldClass } from "@/components/data/form-dialog";
import { PageHeader } from "@/components/data/crud-kit";
import { SearchableSelect } from "@/components/data/searchable-select";
import {
  PipelineStrip,
  StageAdvance,
  StagePill,
  useStageCounts,
  type Stage,
} from "@/components/data/status-pipeline";
import { formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// طلبات الأشعة — the centre's own worklist.
//
// Called `/api/dashboard/imaging`, which does not exist.
// `/api/radiology-requests` does, and is already scoped to the caller's centre.
//
// The queue and its ladder worked; the radiologist's actual output did not.
// `report` is a Text column and `images` a Json array of storage URLs, both
// writable through PATCH, and nothing on screen could write either — so a study
// could be walked all the way to "أُرسلت للطبيب" while carrying no report at
// all. The stage asserted a delivery of something that did not exist.
//
// Images are recorded as URLs, not uploaded here: the app has no storage upload
// path wired, and a file picker that silently discarded the file would be worse
// than an honest field. A centre pastes the link its PACS or viewer produces.
// ─────────────────────────────────────────────────────────────

const STAGES: readonly Stage[] = [
  { key: "scheduled", label: "الموعد", tone: "info" },
  { key: "imaged", label: "تم التصوير", tone: "info" },
  { key: "report_ready", label: "التقرير الطبي", tone: "warning" },
  { key: "images_attached", label: "الصور المرفقة", tone: "positive" },
  { key: "sent_to_doctor", label: "أُرسلت للطبيب", tone: "positive" },
];

type Request = {
  id: string;
  requestType: string;
  equipmentType: string | null;
  appointmentDate: string | null;
  status: string;
  report: string | null;
  images: unknown;
  order: { orderNumber: string; patientName: string } | null;
};

type OpenOrder = {
  id: string;
  orderNumber: string;
  patientName: string;
  patientPhone: string;
};

/** Assigned but not finished — what the centre is actually holding. */
const OPEN_ORDER_STATUSES = "ASSIGNED,IN_TRANSIT,ARRIVED,IN_PROGRESS";

const statusOf = (r: Request) => r.status;

/** A Json column — a malformed row must render as "no images", never throw. */
const readImages = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((u): u is string => typeof u === "string") : [];

// `?new=1` opens the booking form on arrival — the home page's "حجز فحص"
// shortcut lands here. `useSearchParams` suspends, hence the boundary.
export default function ImagingPage() {
  return (
    <Suspense fallback={null}>
      <ImagingScreen />
    </Suspense>
  );
}

function ImagingScreen() {
  const { partnerId } = useRole();
  const openNew = useSearchParams().get("new") === "1";

  const { data, isLoading, error, refetch } = useDashboardData<Request[]>({
    url: "/api/radiology-requests",
    params: { limit: "100" },
    refreshInterval: 30_000,
  });

  const [stage, setStage] = useState<string | null>(null);
  const [booking, setBooking] = useState(openNew);
  const [reporting, setReporting] = useState<Request | null>(null);
  const counts = useStageCounts(data, STAGES, statusOf);

  const refresh = useCallback(() => void refetch(), [refetch]);
  const { setStage: advance, isPending } = useStageMutation("/api/radiology-requests", refresh);

  const rows = useMemo(
    () => (stage ? (data ?? []).filter((r) => r.status === stage) : (data ?? [])),
    [data, stage]
  );

  const columns: Column<Request>[] = useMemo(
    () => [
      {
        key: "patient",
        header: "المريض",
        render: (r) =>
          r.order ? (
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{r.order.patientName}</p>
              <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                #{r.order.orderNumber.slice(-8)}
              </p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">بلا طلب مرتبط</span>
          ),
        sortValue: (r) => r.order?.patientName ?? "",
      },
      {
        key: "requestType",
        header: "نوع الأشعة",
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate text-foreground">{r.requestType}</p>
            {r.equipmentType ? (
              <p className="truncate text-xs text-muted-foreground">{r.equipmentType}</p>
            ) : null}
          </div>
        ),
        sortValue: (r) => r.requestType,
      },
      {
        key: "appointmentDate",
        header: "الموعد",
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {r.appointmentDate ? formatDateTime(r.appointmentDate) : "بلا موعد"}
          </span>
        ),
        sortValue: (r) => (r.appointmentDate ? new Date(r.appointmentDate).getTime() : 0),
      },
      {
        key: "status",
        header: "المرحلة",
        render: (r) => <StagePill stages={STAGES} value={r.status} />,
      },
      {
        key: "attachments",
        header: "المرفقات",
        secondary: true,
        render: (r) => {
          const images = readImages(r.images).length;
          const hasReport = Boolean(r.report && r.report.trim());
          if (!hasReport && images === 0) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {hasReport ? (
                <span className="inline-flex items-center gap-1">
                  <FileText size={12} aria-hidden />
                  تقرير
                </span>
              ) : null}
              {images > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <ImageIcon size={12} aria-hidden />
                  {images}
                </span>
              ) : null}
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="طلبات الأشعة"
        subtitle="طلبات مركزك — من الموعد حتى إرسال التقرير"
        icon={ScanLine}
        action={{ label: "حجز فحص", onClick: () => setBooking(true) }}
      />

      <PipelineStrip stages={STAGES} counts={counts} active={stage} onSelect={setStage} />

      <DataTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) =>
          `${r.requestType} ${r.equipmentType ?? ""} ${r.order?.patientName ?? ""}`
        }
        searchPlaceholder="بحث بنوع الأشعة أو المريض..."
        emptyMessage={stage ? "لا طلبات في هذه المرحلة" : "لا طلبات أشعة بعد"}
        actions={(r) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setReporting(r)}
              className="whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              التقرير
            </button>
            <StageAdvance
              stages={STAGES}
              current={r.status}
              onAdvance={(next) => void advance(r.id, next)}
              disabled={isPending}
              label={`أشعة ${r.requestType}`}
            />
          </div>
        )}
      />

      {booking ? (
        <BookDialog
          centerId={partnerId}
          onClose={() => setBooking(false)}
          onDone={() => {
            setBooking(false);
            refresh();
          }}
        />
      ) : null}

      {reporting ? (
        <ReportDialog
          key={reporting.id}
          request={reporting}
          onClose={() => setReporting(null)}
          onDone={() => {
            setReporting(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------- حجز فحص --------------------------------- */

function BookDialog({
  centerId,
  onClose,
  onDone,
}: {
  centerId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [requestType, setRequestType] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [orderId, setOrderId] = useState("");

  const { data: orders, isLoading } = useDashboardData<OpenOrder[]>({
    url: "/api/orders",
    params: { limit: "100", status: OPEN_ORDER_STATUSES },
  });

  const options = useMemo(
    () =>
      (orders ?? []).map((o) => ({
        value: o.id,
        label: o.patientName,
        hint: `#${o.orderNumber.slice(-8)} — ${o.patientPhone}`,
      })),
    [orders]
  );

  const { mutate: create, isPending } = useMutation(
    async () =>
      apiFetch("/api/radiology-requests", {
        method: "POST",
        body: JSON.stringify({
          // Overridden server-side by the session's own partner — sent because
          // the schema requires the field, never trusted.
          centerId: centerId ?? "",
          requestType: requestType.trim(),
          ...(equipmentType.trim() ? { equipmentType: equipmentType.trim() } : {}),
          // `null` is the schema's "no appointment yet", which is a real state:
          // a walk-in is imaged before anything is booked.
          appointmentDate: appointmentDate ? new Date(appointmentDate).toISOString() : null,
          ...(orderId ? { orderId } : {}),
        }),
      }),
    { successMessage: "تم تسجيل طلب الأشعة", onSuccess: onDone }
  );

  return (
    <FormDialog
      open
      title="حجز فحص"
      description="يُسجَّل باسم مركزك، ويدخل الطابور في مرحلة «الموعد»"
      onClose={onClose}
      onSubmit={() => void create()}
      isPending={isPending}
      submitDisabled={requestType.trim() === ""}
      submitLabel="تسجيل الطلب"
    >
      <Field label="نوع الأشعة" htmlFor="rq-type" hint="مثال: أشعة صدر — X-Ray">
        <input
          id="rq-type"
          className={fieldClass}
          value={requestType}
          onChange={(e) => setRequestType(e.target.value)}
          maxLength={160}
          placeholder="نوع الفحص المطلوب"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الجهاز" htmlFor="rq-equipment" hint="اختياري">
          <input
            id="rq-equipment"
            className={fieldClass}
            value={equipmentType}
            onChange={(e) => setEquipmentType(e.target.value)}
            maxLength={160}
            placeholder="نوع الجهاز"
          />
        </Field>
        <Field label="الموعد" htmlFor="rq-date" hint="اختياري — اتركه فارغاً للحضوري">
          <input
            id="rq-date"
            type="datetime-local"
            className={fieldClass}
            value={appointmentDate}
            onChange={(e) => setAppointmentDate(e.target.value)}
          />
        </Field>
      </div>

      <Field
        label="الطلب المرتبط"
        htmlFor="rq-order"
        hint="اختياري — اتركه فارغاً لفحص حضوري بلا طلب"
      >
        <SearchableSelect
          id="rq-order"
          value={orderId}
          options={options}
          onChange={setOrderId}
          placeholder={isLoading ? "جارِ التحميل..." : "— بلا طلب —"}
          searchPlaceholder="ابحث بالمريض أو رقم الطلب..."
          emptyMessage="لا طلبات مسندة إليك حالياً"
          disabled={isLoading}
        />
      </Field>
    </FormDialog>
  );
}

/* ------------------------------ تقرير الأشعة ------------------------------ */

function ReportDialog({
  request,
  onClose,
  onDone,
}: {
  request: Request;
  onClose: () => void;
  onDone: () => void;
}) {
  const [report, setReport] = useState(request.report ?? "");
  // One URL per line: the shape a radiographer can paste into, and the shape
  // the column stores once split.
  const [imagesText, setImagesText] = useState(readImages(request.images).join("\n"));
  const [markReady, setMarkReady] = useState(request.status !== "report_ready");

  const images = useMemo(
    () =>
      imagesText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [imagesText]
  );

  const { mutate: save, isPending } = useMutation(
    async () =>
      apiFetch(`/api/radiology-requests/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          report: report.trim(),
          images,
          ...(markReady ? { status: "report_ready" } : {}),
        }),
      }),
    { successMessage: "تم حفظ التقرير", onSuccess: onDone }
  );

  return (
    <FormDialog
      open
      title="تقرير الأشعة"
      description={request.order?.patientName ?? request.requestType}
      onClose={onClose}
      onSubmit={() => void save()}
      isPending={isPending}
      submitDisabled={report.trim() === ""}
      submitLabel="حفظ التقرير"
    >
      <Field label="التقرير الطبي" htmlFor="rq-report" hint="قراءة أخصائي الأشعة">
        <textarea
          id="rq-report"
          className={`${fieldClass} h-40 py-2.5`}
          value={report}
          onChange={(e) => setReport(e.target.value)}
          placeholder="الوصف، النتائج، والانطباع"
        />
      </Field>

      <Field
        label="روابط الصور"
        htmlFor="rq-images"
        hint={`رابط في كل سطر — ${images.length} صورة`}
      >
        <textarea
          id="rq-images"
          className={`${fieldClass} h-24 py-2.5`}
          value={imagesText}
          onChange={(e) => setImagesText(e.target.value)}
          dir="ltr"
          placeholder="https://..."
        />
      </Field>

      {request.status !== "report_ready" ? (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={markReady}
            onChange={(e) => setMarkReady(e.target.checked)}
          />
          نقل الطلب إلى «التقرير الطبي» وإعلام الطلب المرتبط
        </label>
      ) : null}
    </FormDialog>
  );
}
