import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/selia/button";
import { Progress } from "@/components/selia/progress";
import { cn } from "@/lib/utils";
import type { GroupResult, ImportProgress } from "@/hooks/useImport";
import { BRAND_STYLE } from "./brandStyles";
import { ReResolvePanel } from "./ReResolvePanel";

interface Step3ResultProps {
  isImporting: boolean;
  progress: ImportProgress;
  results: GroupResult[] | null;
  importError: string | null;
  viewLabel: string;
  onImportMore: () => void;
  onView: () => void;
}

export function Step3Result({
  isImporting,
  progress,
  results,
  importError,
  viewLabel,
  onImportMore,
  onView,
}: Step3ResultProps) {
  if (isImporting || !results) {
    const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div className="space-y-4 py-8">
        <Progress value={percent} />
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            {progress.groupLabel && <span className="font-medium text-foreground">{progress.groupLabel}: </span>}
            row {progress.current.toLocaleString("id-ID")} of {progress.total.toLocaleString("id-ID")}...
          </span>
          <span className="font-semibold text-primary">{percent}%</span>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{progress.inserted.toLocaleString("id-ID")}</p>
            <p className="text-xs text-muted">Imported or updated</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-warning">{progress.skipped.toLocaleString("id-ID")}</p>
            <p className="text-xs text-muted">Skipped</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-danger">{progress.cancelled.toLocaleString("id-ID")}</p>
            <p className="text-xs text-muted">Cancelled orders</p>
          </div>
        </div>
      </div>
    );
  }

  const failed = importError !== null || results.some((r) => r.error);

  return (
    <div className="space-y-5 py-2">
      <div className="space-y-2 text-center">
        {failed ? (
          <AlertCircle className="mx-auto size-12 text-danger" />
        ) : (
          <CheckCircle2 className="mx-auto size-12 text-success" />
        )}
        <div className={cn("text-lg font-semibold", failed && "text-danger")}>
          {failed ? "Import finished with errors" : "Import Complete"}
        </div>
        {importError && <div className="text-sm text-danger">{importError}</div>}
      </div>

      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.key} className={cn("rounded-lg px-4 py-3 ring", BRAND_STYLE[r.brand].soft)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={cn("rounded-md px-2 py-0.5 text-sm font-bold uppercase", BRAND_STYLE[r.brand].solid)}>
                  {r.brand}
                </span>
                <span className="text-sm font-medium">{r.platform}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">{r.rowsImported.toLocaleString("id-ID")}</span> new rows ·{" "}
                <span className="text-muted">{r.duplicatesSkipped.toLocaleString("id-ID")} already stored or skipped</span> ·{" "}
                <span className="text-muted">{r.cancelledFlagged.toLocaleString("id-ID")} cancelled</span>
              </div>
            </div>
            <div className="mt-1 truncate text-xs text-muted">{r.filenames.join(", ")}</div>
            {r.error && <div className="mt-1 text-xs text-danger">{r.error}</div>}
          </li>
        ))}
      </ul>

      <ReResolvePanel />

      <div className="flex justify-center gap-3">
        <Button variant="primary" onClick={onView}>
          {viewLabel}
        </Button>
        <Button variant="outline" onClick={onImportMore}>
          Import More
        </Button>
      </div>
    </div>
  );
}
