import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  /** Dashboard page is optional and hidden until enabled in Settings. */
  showDashboard: boolean;
  /**
   * Set when stored retention flags may no longer match the data: an import
   * added orders older than ones already stored for that brand+platform, or
   * an import batch was deleted. Cleared by a full customer re-resolution.
   */
  resolutionStale: boolean;
  setShowDashboard: (show: boolean) => void;
  setResolutionStale: (stale: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      showDashboard: false,
      resolutionStale: false,
      setShowDashboard: (showDashboard) => set({ showDashboard }),
      setResolutionStale: (resolutionStale) => set({ resolutionStale }),
    }),
    { name: "mpretention-ui" },
  ),
);

/** Route the app opens on, and where "view results" buttons go. */
export function homePath(showDashboard: boolean): string {
  return showDashboard ? "/dashboard" : "/retention";
}
