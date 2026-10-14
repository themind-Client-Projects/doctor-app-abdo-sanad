import { APPOINTMENT_TYPE_LABELS, SERVICE_TYPE_LABELS, labelOf } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// المهام الحالية — the row shape the table actually reads.
//
// `/api/dashboard/tasks` returned raw Prisma rows while `lib/task-columns.ts`
// asks for `patientName`, `serviceType`, `sampleId`, `prescriptionId`,
// `requestType`… — names no model has. The table falls back to
// `String(row[key] ?? "—")`, so the LARGEST panel on the most-visited screen
// in the product printed "—" in two of its four columns, for every row, for
// every role except NURSE and DRIVER — and those two were clean only because
// `Order` happens to own `patientName` and `serviceType` natively.
//
// PHARMACY was worse than dashes: `medications` is a Json array, and
// `String([{…}])` renders "[object Object]".
//
// Pure and separate from the route so it can be tested with no database — the
// defect is a mapping, and a mapping is exactly what a test can pin.
// ─────────────────────────────────────────────────────────────

/** Loose by necessity: six different Prisma models feed this. */
type Row = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** The patient's display name, from whichever source this model carries. */
function patientName(r: Row, fallback: string): string {
  const nested = r.patient as { name?: string | null } | null | undefined;
  const order = r.order as { patientName?: string | null } | null | undefined;
  return nested?.name || order?.patientName || str(r.patientName) || fallback;
}

export function shapeTaskRows(role: string, rows: readonly Row[]): Row[] {
  switch (role) {
    case "DOCTOR":
      return rows.map((r) => ({
        id: r.id,
        patientName: patientName(r, "حساب غير متاح"),
        // The appointment's own axis — حضوري / أونلاين / زيارة منزلية — not a
        // ServiceType, which an Appointment does not have.
        serviceType: labelOf(APPOINTMENT_TYPE_LABELS, str(r.type)),
        status: r.status,
        time: r.time,
      }));

    case "LAB":
      return rows.map((r) => ({
        id: r.id,
        sampleId: str(r.id).slice(-8),
        sampleType: r.sampleType,
        status: r.status,
        createdAt: formatDateTime(r.createdAt as string),
      }));

    case "PHARMACY":
      return rows.map((r) => ({
        id: r.id,
        prescriptionId: str(r.id).slice(-8),
        patientName: patientName(r, "حساب غير متاح"),
        // A COUNT. `String(jsonArray)` was rendering "[object Object]".
        medications: Array.isArray(r.medications) ? r.medications.length : 0,
        status: r.status,
      }));

    case "RADIOLOGY":
      return rows.map((r) => ({
        id: r.id,
        // RadiologyRequest has no patientId — it reaches a patient only
        // through its order, which is optional.
        patientName: patientName(r, "طلب بلا مريض مرتبط"),
        requestType: r.requestType,
        appointmentDate: r.appointmentDate
          ? formatDate(r.appointmentDate as string)
          : "بلا موعد",
        status: r.status,
      }));

    // NURSE, DRIVER, and the platform roles' whole-queue view: all Order rows.
    default:
      return rows.map((r) => ({
        id: r.id,
        orderNumber: `#${str(r.orderNumber).slice(-8)}`,
        patientName: str(r.patientName) || "—",
        serviceType: labelOf(SERVICE_TYPE_LABELS, str(r.serviceType)),
        address: str(r.address) || "—",
        status: r.status,
      }));
  }
}
