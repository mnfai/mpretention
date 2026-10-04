import { create } from "zustand";
import type { Brand, Platform, SourceType } from "@/lib/types";
import type { BrandDetection, ParsedFile } from "@/lib/importer";

export type ImportStep = 1 | 2 | 3;

export interface UploadedFile {
  /** Absolute path; also the identity used to ignore a file added twice. */
  path: string;
  name: string;
  parsed: ParsedFile;
  detection: BrandDetection;
  /** Detected brand, or the one picked by hand when detection was inconclusive. */
  brand: Brand | null;
}

/** Files imported together: one import_log batch per brand + platform + source type. */
export interface ImportGroup {
  key: string;
  brand: Brand;
  platform: Platform;
  sourceType: SourceType;
  files: UploadedFile[];
}

export interface GroupResult {
  key: string;
  brand: Brand;
  platform: Platform;
  filenames: string[];
  rowsImported: number;
  duplicatesSkipped: number;
  cancelledFlagged: number;
  /** New orders older than the latest one already stored: retention flags need a re-run. */
  olderThanExisting: boolean;
  error: string | null;
}

export interface ImportProgress {
  current: number;
  total: number;
  inserted: number;
  skipped: number;
  cancelled: number;
  /** Label of the group being imported, e.g. "Amura · Shopee". */
  groupLabel: string;
}

const EMPTY_PROGRESS: ImportProgress = {
  current: 0,
  total: 0,
  inserted: 0,
  skipped: 0,
  cancelled: 0,
  groupLabel: "",
};

/** Groups files that have a brand by brand + platform + source type, Amura first. */
export function groupFiles(files: UploadedFile[]): ImportGroup[] {
  const groups = new Map<string, ImportGroup>();
  for (const f of files) {
    if (!f.brand) continue;
    const { platform, sourceType } = f.parsed.profile;
    const key = `${f.brand}|${platform}|${sourceType}`;
    const group = groups.get(key);
    if (group) group.files.push(f);
    else groups.set(key, { key, brand: f.brand, platform, sourceType, files: [f] });
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

interface ImportStoreState {
  step: ImportStep;
  files: UploadedFile[];
  errors: string[];
  isParsing: boolean;
  parsingMessage: string;
  isImporting: boolean;
  progress: ImportProgress;
  results: GroupResult[] | null;
  importError: string | null;
  setStep: (step: ImportStep) => void;
  setFiles: (files: UploadedFile[] | ((prev: UploadedFile[]) => UploadedFile[])) => void;
  setErrors: (errors: string[]) => void;
  setParsing: (isParsing: boolean, message?: string) => void;
  setIsImporting: (isImporting: boolean) => void;
  setProgress: (progress: ImportProgress) => void;
  setResults: (results: GroupResult[] | null) => void;
  setImportError: (importError: string | null) => void;
  reset: () => void;
}

/**
 * Non-persisted singleton store: wizard state survives route navigation
 * (Sidebar links, etc.) but resets on full app reload, unlike filterStore.
 */
export const useImportStore = create<ImportStoreState>()((set) => ({
  step: 1,
  files: [],
  errors: [],
  isParsing: false,
  parsingMessage: "",
  isImporting: false,
  progress: EMPTY_PROGRESS,
  results: null,
  importError: null,
  setStep: (step) => set({ step }),
  setFiles: (files) =>
    set((state) => ({ files: typeof files === "function" ? files(state.files) : files })),
  setErrors: (errors) => set({ errors }),
  setParsing: (isParsing, message = "") => set({ isParsing, parsingMessage: message }),
  setIsImporting: (isImporting) => set({ isImporting }),
  setProgress: (progress) => set({ progress }),
  setResults: (results) => set({ results }),
  setImportError: (importError) => set({ importError }),
  reset: () =>
    set({
      step: 1,
      files: [],
      errors: [],
      isParsing: false,
      parsingMessage: "",
      isImporting: false,
      progress: EMPTY_PROGRESS,
      results: null,
      importError: null,
    }),
}));
