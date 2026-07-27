"use client";

import { MoreHorizontal } from "lucide-react";

interface Column {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface CurrentTasksTableProps {
  title: string;
  columns: Column[];
  data: Record<string, unknown>[];
  isLoading?: boolean;
  onRowClick?: (row: Record<string, unknown>) => void;
}

export function CurrentTasksTable({
  title,
  columns,
  data,
  isLoading,
  onRowClick,
}: CurrentTasksTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {data.length} عنصر
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <p>لا توجد مهام حالية</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {columns.map((col) => (
                  <th key={col.key} className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {col.label}
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row, idx) => (
                <tr
                  key={(row.id as string) || idx}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors hover:bg-muted/50 ${onRowClick ? "cursor-pointer" : ""}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-3.5 text-sm text-foreground">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-2">
                    <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors" aria-label="المزيد">
                      <MoreHorizontal size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
