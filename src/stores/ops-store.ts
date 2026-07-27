import { create } from "zustand";

interface OpsState {
  selectedOrderId: string | null;
  filterStatus: string | null;
  filterPriority: string | null;
  employeeAvailability: "AVAILABLE" | "BUSY" | "ON_BREAK";

  setSelectedOrder: (id: string | null) => void;
  setFilterStatus: (status: string | null) => void;
  setFilterPriority: (priority: string | null) => void;
  setAvailability: (a: "AVAILABLE" | "BUSY" | "ON_BREAK") => void;
}

export const useOpsStore = create<OpsState>((set) => ({
  selectedOrderId: null,
  filterStatus: null,
  filterPriority: null,
  employeeAvailability: "AVAILABLE",

  setSelectedOrder: (selectedOrderId) => set({ selectedOrderId }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
  setFilterPriority: (filterPriority) => set({ filterPriority }),
  setAvailability: (employeeAvailability) => set({ employeeAvailability }),
}));
