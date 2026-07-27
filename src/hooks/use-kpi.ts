"use client";

import { useDashboardData } from "./use-dashboard-data";
import type { KPICardData } from "@/components/dashboard/kpi-cards";

interface KPISummaryResponse {
  role: string;
  kpis: KPICardData[];
}

/**
 * Hook to fetch role-specific KPI data from /api/dashboard/summary
 * Polls every 60 seconds by default
 */
export function useKPIs(role: string, partnerId?: string | null) {
  const params: Record<string, string> = { role };
  if (partnerId) params.partnerId = partnerId;

  const { data, isLoading, error, refetch } = useDashboardData<KPISummaryResponse>({
    url: "/api/dashboard/summary",
    params,
    refreshInterval: 60000, // 1 minute polling
  });

  return {
    kpis: data?.kpis ?? [],
    isLoading,
    error,
    refetch,
  };
}
