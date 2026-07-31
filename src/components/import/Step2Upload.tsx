import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { cn } from "@/lib/utils";
import { estimateImportSeconds } from "@/hooks/useImport";
import type { UploadedFile } from "@/hooks/useImport";
import type { Platform } from "@/lib/types";

interface Step2UploadProps {
  platform: Platform;
  files: UploadedFile[];
  error: string | null;
  isParsing: boolean;
  parsingMessage: string;
  onAddFiles: (paths: string[]) => void;
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

  async function handleBrowse() {
    if (isParsing) return;
    const selected = await open({
      multiple,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (!selected) return;
    onAddFiles(Array.isArray(selected) ? selected : [selected]);
  }

  // Tauri intercepts native OS drag-and-drop, so the HTML5 DataTransfer API
  // never receives files — we get real file paths from this event instead.
  useEffect(() => {
    const unlistenPromise = getCurrentWebview().onDragDropEvent((event) => {
      if (isParsing) return;
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
          if (paths.length > 0) onAddFiles(multiple ? paths : paths.slice(0, 1));
          break;
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [isParsing, multiple, onAddFiles]);

  return (
    <div className="space-y-4">
      <div
        onClick={handleBrowse}
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
