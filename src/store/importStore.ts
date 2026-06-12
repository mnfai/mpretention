import { create } from "zustand";
import type { Brand, Platform } from "@/lib/types";
import type { ParsedFile } from "@/lib/importer";

export type ImportStep = 1 | 2 | 3 | 4;

export interface UploadedFile {
  file: File;
  parsed: ParsedFile;
}

export interface ImportResult {
  rowsImported: number;
  duplicatesSkipped: number;
  cancelledFlagged: number;
}

export interface ImportProgress {
  current: number;
  total: number;
  inserted: number;
  skipped: number;
  cancelled: number;
}

const EMPTY_PROGRESS: ImportProgress = { current: 0, total: 0, inserted: 0, skipped: 0, cancelled: 0 };

interface ImportStoreState {
  step: ImportStep;
  brand: Brand | null;
  platform: Platform | null;
  files: UploadedFile[];
  error: string | null;
  isParsing: boolean;
  parsingMessage: string;
  isImporting: boolean;
  progress: ImportProgress;
  result: ImportResult | null;
  importError: string | null;
  setStep: (step: ImportStep) => void;
  setBrand: (brand: Brand | null) => void;
  setPlatform: (platform: Platform | null) => void;
  setFiles: (files: UploadedFile[] | ((prev: UploadedFile[]) => UploadedFile[])) => void;
  setError: (error: string | null) => void;
  setParsing: (isParsing: boolean, message?: string) => void;
  setIsImporting: (isImporting: boolean) => void;
  setProgress: (progress: ImportProgress) => void;
  setResult: (result: ImportResult | null) => void;
  setImportError: (importError: string | null) => void;
  reset: () => void;
}

/**
 * Non-persisted singleton store: wizard state survives route navigation
 * (Sidebar links, etc.) but resets on full app reload, unlike filterStore.
 */
export const useImportStore = create<ImportStoreState>()((set) => ({
  step: 1,
  brand: null,
  platform: null,
  files: [],
  error: null,
  isParsing: false,
  parsingMessage: "",
  isImporting: false,
  progress: EMPTY_PROGRESS,
  result: null,
  importError: null,
  setStep: (step) => set({ step }),
  setBrand: (brand) => set({ brand }),
  setPlatform: (platform) => set({ platform }),
  setFiles: (files) =>
    set((state) => ({ files: typeof files === "function" ? files(state.files) : files })),
  setError: (error) => set({ error }),
  setParsing: (isParsing, message = "") => set({ isParsing, parsingMessage: message }),
  setIsImporting: (isImporting) => set({ isImporting }),
  setProgress: (progress) => set({ progress }),
  setResult: (result) => set({ result }),
  setImportError: (importError) => set({ importError }),
  reset: () =>
    set({
      step: 1,
      brand: null,
      platform: null,
      files: [],
      error: null,
      isParsing: false,
      parsingMessage: "",
      isImporting: false,
      progress: EMPTY_PROGRESS,
      result: null,
      importError: null,
    }),
}));
