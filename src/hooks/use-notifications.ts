"use client";

import { useDashboardData } from "./use-dashboard-data";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications(userId: string | null) {
  const { data, isLoading, refetch } = useDashboardData<Notification[]>({
    url: "/api/notifications",
    params: userId ? { userId } : undefined,
    refreshInterval: 30000, // Poll every 30 seconds
  });

  const unreadCount = data?.filter((n) => !n.isRead).length ?? 0;

  const markAsRead = async (notificationId: string) => {
    await fetch(`/api/notifications/${notificationId}/read`, { method: "PATCH" });
    refetch();
  };

  return {
    notifications: data ?? [],
    unreadCount,
    isLoading,
    markAsRead,
    refetch,
  };
}
