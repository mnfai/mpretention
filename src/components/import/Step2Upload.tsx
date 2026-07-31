import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { estimateImportSeconds } from "@/hooks/useImport";
import type { UploadedFile } from "@/hooks/useImport";
import type { Platform } from "@/lib/types";

const XLSX_FILTER = [{ name: "Excel", extensions: ["xlsx"] }];

function pathToFileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

interface Step2UploadProps {
  platform: Platform;
  files: UploadedFile[];
  error: string | null;
  isParsing: boolean;
  parsingMessage: string;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (index: number) => void;
}

function formatEstimate(seconds: number): string {
  return seconds < 60 ? `~${seconds}s` : `~${Math.ceil(seconds / 60)}min`;
}

export function Step2Upload({
  platform,
  files,
  error,
  isParsing,
  parsingMessage,
  onAddFiles,
  onRemoveFile,
}: Step2UploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const multiple = platform === "Shopee";
  const totalRows = files.reduce((sum, f) => sum + f.parsed.transactions.length, 0);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (isParsing) return;
    if (e.dataTransfer.files.length > 0) onAddFiles(e.dataTransfer.files);
  }

  async function handleBrowse() {
    if (isParsing) return;
    const selected = await open({ multiple, filters: XLSX_FILTER });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    const picked = await Promise.all(
      paths.map(async (path) => {
        const data = await readFile(path);
        return new File([data], pathToFileName(path));
      }),
    );
    onAddFiles(picked);
  }

  return (
    <div className="space-y-4">
      <div
        onClick={handleBrowse}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isParsing) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors",
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
            <div className="text-sm font-medium">
              Drag & drop {multiple ? "files" : "a file"} here, or click to browse
            </div>
            <div className="text-xs text-muted">
              {platform} export — {multiple ? "multiple .xlsx files accepted" : "single .xlsx file"}
            </div>
          </>
        )}
      </div>

      {error && <div className="rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">{error}</div>}

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
          {files.map((f, i) => (
            <li
              key={`${f.file.name}-${i}`}
              className="flex items-center justify-between rounded-lg ring ring-border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="size-5 text-muted" />
                <div>
                  <div className="text-sm font-medium">{f.file.name}</div>
                  <div className="text-xs text-muted">{f.parsed.transactions.length.toLocaleString("id-ID")} rows</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFile(i)}
                className="text-muted hover:text-danger"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
