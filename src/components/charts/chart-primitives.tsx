"use client";

import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/format";

/**
 * Chart primitives for the dashboards.
 *
 * Written directly against recharts 3 rather than porting the shadcn
 * `chart.tsx`, which targets recharts 2 and does not typecheck here.
 *
 * Two things these handle that a generic wrapper would not:
 *  - RTL. Recharts lays out left-to-right; the axis and tooltip need to be
 *    told, or an Arabic dashboard reads backwards.
 *  - Money as a string. Decimal columns serialize to strings, so values are
 *    coerced before they reach the chart instead of silently plotting NaN.
 */

/** Brand-ish palette. Distinct at a glance, and legible in both themes. */
export const CHART_COLORS = [
  "hsl(160 84% 39%)", // primary emerald
  "hsl(217 91% 60%)", // blue
  "hsl(38 92% 50%)", // amber
  "hsl(280 65% 60%)", // violet
  "hsl(340 75% 55%)", // rose
  "hsl(190 80% 42%)", // cyan
  "hsl(24 90% 55%)", // orange
] as const;

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

type TooltipRow = { name?: string; value?: unknown; color?: string };

function ChartTooltip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string;
  money?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg"
    >
      {label ? <p className="mb-1 font-semibold text-foreground">{label}</p> : null}
      {payload.map((row, i) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          {row.color ? (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: row.color }}
            />
          ) : null}
          <span>{row.name}</span>
          <span className="font-semibold text-foreground">
            {money ? formatCurrency(num(row.value)) : formatNumber(num(row.value))}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ------------------------------- donut ---------------------------------- */

export type DonutSlice = { label: string; value: number | string };

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  money = false,
  height = 220,
}: {
  data: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  money?: boolean;
  height?: number;
}) {
  const rows = data.map((d) => ({ name: d.label, value: num(d.value) }));
  const total = rows.reduce((a, r) => a + r.value, 0);

  if (total === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-muted-foreground"
      >
        لا توجد بيانات بعد
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            strokeWidth={0}
            // Start at the top and sweep counter-clockwise, which reads
            // naturally in an RTL layout.
            startAngle={90}
            endAngle={-270}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip money={money} />} />
        </PieChart>
      </ResponsiveContainer>

      {centerValue ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-foreground">{centerValue}</span>
          {centerLabel ? (
            <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Legend rendered outside the chart so long Arabic labels do not clip. */
export function DonutLegend({
  data,
  money = false,
  showPercent = true,
}: {
  data: DonutSlice[];
  money?: boolean;
  showPercent?: boolean;
}) {
  const total = data.reduce((a, d) => a + num(d.value), 0);
  return (
    <ul className="space-y-2">
      {data.map((d, i) => {
        const v = num(d.value);
        return (
          <li key={d.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="truncate text-muted-foreground">{d.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-foreground">
              {money ? formatCurrency(v) : formatNumber(v)}
              {showPercent && total > 0 ? (
                <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                  {Math.round((v / total) * 100)}%
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------- trend --------------------------------- */

export type TrendPoint = { label: string; value: number | string };

export function TrendChart({
  data,
  money = true,
  height = 260,
}: {
  data: TrendPoint[];
  money?: boolean;
  height?: number;
}) {
  const rows = data.map((d) => ({ name: d.label, value: num(d.value) }));

  if (!rows.some((r) => r.value > 0)) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-muted-foreground"
      >
        لا توجد بيانات بعد
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="name"
            // RTL: the newest day belongs on the left.
            reversed
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) =>
              num(v) >= 1000 ? `${Math.round(num(v) / 1000)}K` : formatNumber(num(v))
            }
          />
          <Tooltip content={<ChartTooltip money={money} />} />
          <Area
            type="monotone"
            dataKey="value"
            name="الإيرادات"
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            fill="url(#trendFill)"
            dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS[0] }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
