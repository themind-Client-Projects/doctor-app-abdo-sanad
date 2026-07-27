"use client";

import { useState, useEffect, useCallback } from "react";

interface UseDashboardDataOptions<T> {
  url: string;
  params?: Record<string, string>;
  refreshInterval?: number; // ms — for polling (no real-time, per user decision)
}

interface UseDashboardDataReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboardData<T>({
  url,
  params,
  refreshInterval,
}: UseDashboardDataOptions<T>): UseDashboardDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = params
    ? "?" + new URLSearchParams(params).toString()
    : "";

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${url}${queryString}`);
      if (!response.ok) throw new Error("فشل في تحميل البيانات");
      const result = await response.json();
      setData(result.data ?? result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setIsLoading(false);
    }
  }, [url, queryString]);

  useEffect(() => {
    fetchData();

    // Polling instead of real-time (per user decision)
    if (refreshInterval) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  return { data, isLoading, error, refetch: fetchData };
}
