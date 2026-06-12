import { create } from "zustand";
import { persist } from "zustand/middleware";
import { format, startOfMonth } from "date-fns";
import type { BrandFilter, PlatformFilter, GmvMode } from "@/lib/types";

const ISO_DATE = "yyyy-MM-dd";

interface FilterState {
  brand: BrandFilter;
  platform: PlatformFilter;
  gmvMode: GmvMode;
  /** "YYYY-MM-DD" */
  dateFrom: string;
  /** "YYYY-MM-DD" */
  dateTo: string;
  setBrand: (brand: BrandFilter) => void;
  setPlatform: (platform: PlatformFilter) => void;
  setGmvMode: (mode: GmvMode) => void;
  setDateRange: (from: string, to: string) => void;
}

const today = new Date();

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      brand: "All",
      platform: "All",
      gmvMode: "gross",
      dateFrom: format(startOfMonth(today), ISO_DATE),
      dateTo: format(today, ISO_DATE),
      setBrand: (brand) => set({ brand }),
      setPlatform: (platform) => set({ platform }),
      setGmvMode: (gmvMode) => set({ gmvMode }),
      setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
    }),
    {
      name: "mpretention-filters",
      partialize: (state) => ({ gmvMode: state.gmvMode }),
    },
  ),
);
