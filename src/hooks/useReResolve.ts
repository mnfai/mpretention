import { create } from "zustand";
import { reResolveAllCustomers } from "@/lib/db";
import { useUiStore } from "@/store/uiStore";
import type { CustomerStats } from "@/lib/types";

interface ReResolveState {
  isResolving: boolean;
  progress: { current: number; total: number };
  error: string | null;
  /** Runs the full re-resolution; no-op while one is already running. */
  run: () => Promise<CustomerStats | null>;
}

/**
 * Shared Re-run Customer Resolution state, so the Import page and Settings
 * show the same progress and can't start two runs at once.
 */
export const useReResolve = create<ReResolveState>()((set, get) => ({
  isResolving: false,
  progress: { current: 0, total: 0 },
  error: null,
  run: async () => {
    if (get().isResolving) return null;
    set({ isResolving: true, progress: { current: 0, total: 0 }, error: null });
    try {
      const stats = await reResolveAllCustomers((current, total) => set({ progress: { current, total } }));
      useUiStore.getState().setResolutionStale(false);
      return stats;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return null;
    } finally {
      set({ isResolving: false });
    }
  },
}));
