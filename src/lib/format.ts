import { BAGHDAD_TZ } from "@/lib/time";
/**
 * Number, money and date formatting.
 *
 * One place, because 37 ad-hoc `toLocaleString` calls had drifted into three
 * different locales (`ar-EG`, `ar-IQ`, and none at all) — so the same value
 * rendered with different digits, different separators and different month
 * names depending on which screen you were on.
 *
 * `ar-IQ-u-nu-latn` is the Arabic (Iraq) locale with the Latin numbering
 * system: Arabic text and Iraqi month names (تموز, not يوليو) with Western
 * digits, which is what the dashboards want:
 *
 *   ar-IQ            ١٬٢٣٤٬٥٦٧٫٥   الأربعاء، ٢٩ تموز ٢٠٢٦
 *   ar-IQ-u-nu-latn  1,234,567.5   الأربعاء، 29 تموز 2026
 */

/** Arabic locale, Latin digits — the dashboard default. */
export const LOCALE = "ar-IQ-u-nu-latn";

/** Iraqi Dinar. Note this is د.ع — NOT ر.ي, which is the Yemeni Rial. */
export const CURRENCY = "IQD";
export const CURRENCY_SYMBOL = "د.ع";

/** A value that may arrive as a Prisma Decimal serialized to a string. */
type Numeric = number | string | null | undefined;

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Format a count or quantity.
 *
 * Accepts a string because money columns are `Decimal` and serialize to JSON
 * as strings — passing one to `toLocaleString` used to return it verbatim,
 * unformatted and in Latin digits by accident.
 */
export function formatNumber(value: Numeric, fallback = "—"): string {
  const n = toNumber(value);
  return n === null ? fallback : n.toLocaleString(LOCALE);
}

/**
 * An instant → the "YYYY-MM-DDTHH:mm" a `datetime-local` input expects.
 *
 * It must be the BROWSER's wall clock for that instant, because that is what
 * the control both renders and parses. Slicing the API's ISO string instead —
 * `iso.slice(0, 16)` — hands it the UTC wall clock, which the browser then
 * reads as local: a draw stored at 09:00 Baghdad displayed as 06:00, and
 * `new Date(value).toISOString()` on submit re-stored that 06:00 as Baghdad
 * local, three hours earlier. Every save, compounding.
 *
 * These getters are deliberately the local ones. `lib/time.ts` pins Baghdad
 * for the SERVER, where the runtime zone is UTC and must not be trusted; in a
 * browser the local zone IS the user's, and this is the inverse of
 * `new Date(value)` on the same machine — which is what makes the round trip
 * lossless.
 */
export function toDateTimeInput(value: Numeric | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Format money. Whole dinars by default — IQD has no practical subunit. */
export function formatCurrency(
  value: Numeric,
  options: { decimals?: number; symbol?: boolean } = {}
): string {
  const n = toNumber(value);
  if (n === null) return "—";

  const formatted = n.toLocaleString(LOCALE, {
    minimumFractionDigits: options.decimals ?? 0,
    maximumFractionDigits: options.decimals ?? 0,
  });

  return options.symbol === false ? formatted : `${formatted} ${CURRENCY_SYMBOL}`;
}

/** Format a percentage, e.g. 70 -> "70%". */
export function formatPercent(value: Numeric, fallback = "—"): string {
  const n = toNumber(value);
  return n === null ? fallback : `${n.toLocaleString(LOCALE)}%`;
}

/**
 * Every date in this product is rendered in BAGHDAD, not in the runtime's zone.
 *
 * On a dashboard this was invisible — an Iraqi browser is already UTC+3. But
 * two surfaces are SERVER components: the printed referral
 * (`(print)/referrals/[id]/print`) and the public page its QR code opens
 * (`verify/[reference]`). A Vercel function runs in UTC with no TZ set, so a
 * referral issued between 00:00 and 03:00 Baghdad printed the PREVIOUS
 * calendar date, its expiry could print a day early, and the pharmacist's
 * verification screen disagreed with the paper in their hand by three hours.
 *
 * Pinned here rather than at the six call sites, so the next server component
 * cannot reintroduce it, and so client and server render a date identically.
 */
type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date only — "29 تموز 2026". */
export function formatDate(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  return d === null
    ? fallback
    : d.toLocaleDateString(LOCALE, {
        timeZone: BAGHDAD_TZ,
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}

/** Date and time — "29 تموز 2026، 2:30 م". */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  return d === null
    ? fallback
    : d.toLocaleString(LOCALE, {
        timeZone: BAGHDAD_TZ,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/** Time only — "2:30 م". */
export function formatTime(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  return d === null
    ? fallback
    : d.toLocaleTimeString(LOCALE, { timeZone: BAGHDAD_TZ, hour: "2-digit", minute: "2-digit" });
}

/** Relative age, e.g. "قبل 5 دقائق". Arabic plurals are not a simple s/plural. */
export function formatRelative(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  if (d === null) return fallback;

  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "الآن";

  const units: [number, string, string, string][] = [
    [60, "دقيقة", "دقيقتين", "دقائق"],
    [3600, "ساعة", "ساعتين", "ساعات"],
    [86400, "يوم", "يومين", "أيام"],
  ];

  for (let i = units.length - 1; i >= 0; i--) {
    const [div, one, two, many] = units[i];
    const n = Math.floor(seconds / div);
    if (n >= 1) {
      // Arabic has singular / dual / plural — "قبل 1 يوم" is wrong.
      if (n === 1) return `قبل ${one}`;
      if (n === 2) return `قبل ${two}`;
      return `قبل ${n.toLocaleString(LOCALE)} ${n <= 10 ? many : one}`;
    }
  }

  return formatDate(d);
}
