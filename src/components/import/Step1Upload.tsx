import { useEffect, useRef, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Badge } from "@/components/selia/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import { estimateImportSeconds } from "@/hooks/useImport";
import type { UploadedFile } from "@/hooks/useImport";
import type { Brand } from "@/lib/types";
import { BRAND_STYLE, PLATFORM_BADGE_CLASS } from "./brandStyles";

interface Step1UploadProps {
  files: UploadedFile[];
  errors: string[];
  isParsing: boolean;
  parsingMessage: string;
  onAddFiles: (paths: string[]) => void;
  onRemoveFile: (path: string) => void;
  onAssignBrand: (path: string, brand: Brand) => void;
}

function formatEstimate(seconds: number): string {
  return seconds < 60 ? `~${seconds}s` : `~${Math.ceil(seconds / 60)}min`;
}

/** Short notes on rows the parser left out or corrected, shown under each file. */
export function fileNotes(f: UploadedFile): string[] {
  const { skippedBreakdown: s, swappedDates } = f.parsed;
  const notes: string[] = [];
  if (swappedDates > 0)
    notes.push(`${swappedDates.toLocaleString("id-ID")} dates had day/month swapped by Excel and were corrected`);
  if (s.futureDate > 0) notes.push(`${s.futureDate.toLocaleString("id-ID")} rows dated in the future skipped`);
  if (s.invalidDate > 0) notes.push(`${s.invalidDate.toLocaleString("id-ID")} rows without a readable date skipped`);
  if (s.invalidOrderId > 0) notes.push(`${s.invalidOrderId.toLocaleString("id-ID")} rows without a valid order ID skipped`);
  return notes;
}

function BrandPicker({ file, onAssign }: { file: UploadedFile; onAssign: (brand: Brand) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
        <AlertTriangle className="size-3.5" /> Brand not recognised, choose:
      </span>
      {(["Amura", "Reglow"] as Brand[]).map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => onAssign(b)}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-semibold ring transition-colors",
            file.brand === b ? BRAND_STYLE[b].solid : `ring-border ${BRAND_STYLE[b].text} hover:bg-accent`,
          )}
        >
          {b}
        </button>
      ))}
    </div>
  );
}

export function Step1Upload({
  files,
  errors,
  isParsing,
  parsingMessage,
  onAddFiles,
  onRemoveFile,
  onAssignBrand,
}: Step1UploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const totalRows = files.reduce((sum, f) => sum + f.parsed.transactions.length, 0);

  // The drag-drop listener is registered once; refs keep it reading current values.
  const isParsingRef = useRef(isParsing);
  const onAddFilesRef = useRef(onAddFiles);
  isParsingRef.current = isParsing;
  onAddFilesRef.current = onAddFiles;

  async function handleBrowse() {
    if (isParsing) return;
    const selected = await open({
      multiple: true,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (!selected) return;
    onAddFiles(Array.isArray(selected) ? selected : [selected]);
  }

  // Tauri intercepts native OS drag-and-drop, so the HTML5 DataTransfer API
  // never receives files — we get real file paths from this event instead.
  useEffect(() => {
    const unlistenPromise = getCurrentWebview().onDragDropEvent((event) => {
      if (isParsingRef.current) return;
      switch (event.payload.type) {
        case "enter":
        case "over":
          setIsDragOver(true);
          break;
        case "leave":
          setIsDragOver(false);
          break;
        case "drop": {
          setIsDragOver(false);
          const paths = event.payload.paths.filter((p) => p.toLowerCase().endsWith(".xlsx"));
          if (paths.length > 0) onAddFilesRef.current(paths);
          break;
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <div className="space-y-4">
      <div
        onClick={handleBrowse}
        className={cn(
          "flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors",
          isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-dimmed",
          isParsing && "cursor-not-allowed",
        )}
      >
        {isParsing ? (
          <>
            <Loader2 className="size-8 animate-spin text-primary" />
            <div className="text-sm font-medium">{parsingMessage || "Reading file..."}</div>
            <div className="text-xs text-muted">This may take a moment for large files</div>
          </>
        ) : (
          <>
            <UploadCloud className="size-8 text-muted" />
            <div className="text-sm font-medium">Drag & drop files here, or click to browse</div>
            <div className="text-xs text-muted">
              Shopee and TikTok Shop exports, Amura and Reglow together. Brand and platform are read from each file.
            </div>
          </>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && !isParsing && (
        <div className="rounded-lg bg-table-head px-4 py-3">
          <div className="text-sm font-medium">
            {files.length} file{files.length > 1 ? "s" : ""} selected
          </div>
          <div className="text-xs text-muted">
            {totalRows.toLocaleString("id-ID")} rows detected · {formatEstimate(estimateImportSeconds(totalRows))} to
            import
          </div>
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => {
            const notes = fileNotes(f);
            const range = f.parsed.dateRange;
            return (
              <li
                key={f.path}
                className={cn(
                  "flex items-start justify-between gap-4 rounded-lg px-4 py-3 ring",
                  f.brand ? BRAND_STYLE[f.brand].soft : "bg-amber-400/10 ring-amber-500/50",
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  {f.brand && f.detection.status === "detected" ? (
                    <span
                      className={cn(
                        "flex h-10 w-24 shrink-0 items-center justify-center rounded-lg text-base font-bold uppercase tracking-wide",
                        BRAND_STYLE[f.brand].solid,
                      )}
                      title={`${Math.round(f.detection.dominance * 100)}% of ${f.detection.brandedRows.toLocaleString("id-ID")} branded rows`}
                    >
                      {f.brand}
                    </span>
                  ) : (
                    <FileSpreadsheet className="mt-1 size-5 shrink-0 text-muted" />
                  )}
                  <div className="min-w-0 space-y-1">
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge size="sm" className={PLATFORM_BADGE_CLASS[f.parsed.profile.platform]}>
                        {f.parsed.profile.platform}
                      </Badge>
                      <span>{f.parsed.transactions.length.toLocaleString("id-ID")} rows</span>
                      {range && (
                        <span>
                          {formatDate(range.from)} – {formatDate(range.to)}
                        </span>
                      )}
                    </div>
                    {f.detection.status === "unknown" && (
                      <BrandPicker file={f} onAssign={(b) => onAssignBrand(f.path, b)} />
                    )}
                    {notes.map((n) => (
                      <div key={n} className="text-xs text-amber-600">
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFile(f.path)}
                  className="mt-1 text-muted hover:text-danger"
                  title="Remove file"
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
