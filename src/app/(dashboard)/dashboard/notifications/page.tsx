"use client";

import { useCallback, useMemo } from "react";
import { Bell, Check } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { apiFetch, useMutation } from "@/hooks/use-mutation";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader, Pill } from "@/components/data/crud-kit";
import { formatDateTime } from "@/lib/format";

// ─────────────────────────────────────────────────────────────
// الإشعارات — linked from every partner role's menu, and the page did not exist.
//
// `/api/notifications` has always been scoped to the signed-in user, so no new
// endpoint was needed; the route file simply was never written and every one of
// the six menus pointed at a 404.
// ─────────────────────────────────────────────────────────────

type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  isRead: boolean;
  createdAt: string;
};

export default function DashboardNotificationsPage() {
  const { data, isLoading, error, refetch } = useDashboardData<Notification[]>({
    url: "/api/notifications",
    params: { limit: "100" },
    refreshInterval: 60_000,
  });

  const refresh = useCallback(() => void refetch(), [refetch]);

  const { mutate: markRead, isPending } = useMutation(
    async (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" }),
    { successMessage: null, onSuccess: refresh }
  );

  const unread = useMemo(() => (data ?? []).filter((n) => !n.isRead).length, [data]);

  const columns: Column<Notification>[] = useMemo(
    () => [
      {
        key: "title",
        header: "الإشعار",
        render: (r) => (
          <div className="min-w-0">
            <p
              className={`truncate ${r.isRead ? "text-muted-foreground" : "font-semibold text-foreground"}`}
            >
              {r.title}
            </p>
            {r.body ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">{r.body}</p>
            ) : null}
          </div>
        ),
        sortValue: (r) => r.title,
      },
      {
        key: "isRead",
        header: "الحالة",
        render: (r) =>
          r.isRead ? <Pill>مقروء</Pill> : <Pill tone="info">جديد</Pill>,
      },
      {
        key: "createdAt",
        header: "الوقت",
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="الإشعارات"
        subtitle={unread > 0 ? `${unread} إشعار غير مقروء` : "لا إشعارات غير مقروءة"}
        icon={Bell}
      />

      <DataTable
        rows={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        searchable={(r) => `${r.title} ${r.body ?? ""}`}
        searchPlaceholder="بحث في الإشعارات..."
        filters={[
          {
            key: "isRead",
            label: "الكل",
            options: [
              { value: "unread", label: "غير مقروءة" },
              { value: "read", label: "مقروءة" },
            ],
            match: (r, v) => (v === "unread" ? !r.isRead : r.isRead),
          },
        ]}
        emptyMessage="لا إشعارات بعد"
        actions={(r) =>
          r.isRead ? null : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => void markRead(r.id)}
              aria-label={`تعليم كمقروء: ${r.title}`}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
            >
              <Check size={12} aria-hidden />
              تعليم كمقروء
            </button>
          )
        }
      />
    </div>
  );
}
