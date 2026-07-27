import { create } from "zustand";
import type { KPICard, Alert, ActivityItem, EarningsSummary } from "@/types/dashboard";

interface DashboardState {
  kpis: KPICard[];
  alerts: Alert[];
  activities: ActivityItem[];
  earnings: EarningsSummary | null;
  isLoading: boolean;

  setKPIs: (kpis: KPICard[]) => void;
  setAlerts: (alerts: Alert[]) => void;
  setActivities: (activities: ActivityItem[]) => void;
  setEarnings: (earnings: EarningsSummary) => void;
  setLoading: (loading: boolean) => void;
  dismissAlert: (id: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  kpis: [],
  alerts: [],
  activities: [],
  earnings: null,
  isLoading: true,

  setKPIs: (kpis) => set({ kpis }),
  setAlerts: (alerts) => set({ alerts }),
  setActivities: (activities) => set({ activities }),
  setEarnings: (earnings) => set({ earnings }),
  setLoading: (isLoading) => set({ isLoading }),
  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    })),
}));
