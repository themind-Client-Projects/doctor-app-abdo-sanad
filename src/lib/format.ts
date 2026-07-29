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
    : d.toLocaleDateString(LOCALE, { year: "numeric", month: "long", day: "numeric" });
}

/** Date and time — "29 تموز 2026، 2:30 م". */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  return d === null
    ? fallback
    : d.toLocaleString(LOCALE, {
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
    : d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
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
