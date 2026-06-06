import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LocationState {
  selectedCity: string | null;
  isCitySelectorOpen: boolean;
  setCity: (city: string) => void;
  openCitySelector: () => void;
  closeCitySelector: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      selectedCity: null,
      isCitySelectorOpen: false,
      setCity: (city) => set({ selectedCity: city, isCitySelectorOpen: false }),
      openCitySelector: () => set({ isCitySelectorOpen: true }),
      closeCitySelector: () => set({ isCitySelectorOpen: false }),
    }),
    {
      name: 'patient-location-storage',
    }
  )
);
