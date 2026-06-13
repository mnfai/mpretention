import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/selia/button";
import { Progress } from "@/components/selia/progress";
import type { Brand, Platform } from "@/lib/types";
import type { ImportProgress, ImportResult } from "@/hooks/useImport";

interface Step4ResultProps {
  brand: Brand;
  platform: Platform;
  isImporting: boolean;
  progress: ImportProgress;
  result: ImportResult | null;
  importError: string | null;
  onImportMore: () => void;
  onViewDashboard: () => void;
}

export function Step4Result({
  brand,
  platform,
  isImporting,
  progress,
  result,
  importError,
  onImportMore,
  onViewDashboard,
}: Step4ResultProps) {
  if (isImporting || (!result && !importError)) {
    const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div className="space-y-4 py-8">
        <Progress value={percent} />
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Processing row {progress.current.toLocaleString("id-ID")} of {progress.total.toLocaleString("id-ID")}...
          </span>
          <span className="font-semibold text-primary">{percent}%</span>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{progress.inserted.toLocaleString("id-ID")}</p>
            <p className="text-xs text-muted">Imported</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-warning">{progress.skipped.toLocaleString("id-ID")}</p>
            <p className="text-xs text-muted">Skipped (duplicate)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-danger">{progress.cancelled.toLocaleString("id-ID")}</p>
            <p className="text-xs text-muted">Cancelled orders</p>
          </div>
        </div>
      </div>
    );
  }

  if (importError) {
    return (
      <div className="space-y-4 py-4 text-center">
        <AlertCircle className="mx-auto size-12 text-danger" />
        <div className="text-lg font-semibold text-danger">Import Error</div>
        <div className="text-sm text-danger">{importError}</div>
        {result && (
          <div className="space-y-1 text-sm">
            <div>{result.rowsImported.toLocaleString("id-ID")} rows imported before the error</div>
            <div className="text-muted">{result.duplicatesSkipped.toLocaleString("id-ID")} duplicates skipped</div>
            <div className="text-muted">{result.cancelledFlagged.toLocaleString("id-ID")} cancelled orders flagged</div>
          </div>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <Button variant="primary" onClick={onImportMore}>
            Try Again
          </Button>
          {result && (
            <Button variant="outline" onClick={onViewDashboard}>
              View Dashboard
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-4 py-4 text-center">
      <CheckCircle2 className="mx-auto size-12 text-success" />
      <div className="text-lg font-semibold">Import Complete</div>
      <div className="space-y-1 text-sm">
        <div>{result.rowsImported.toLocaleString("id-ID")} rows imported</div>
        <div className="text-muted">{result.duplicatesSkipped.toLocaleString("id-ID")} duplicates skipped</div>
        <div className="text-muted">{result.cancelledFlagged.toLocaleString("id-ID")} cancelled orders flagged</div>
      </div>
      <div className="text-sm text-muted">
        Brand: {brand} | Platform: {platform}
      </div>
      <div className="flex justify-center gap-3 pt-2">
        <Button variant="primary" onClick={onViewDashboard}>
          View Dashboard
        </Button>
        <Button variant="outline" onClick={onImportMore}>
          Import More
        </Button>
      </div>
    </div>
  );
}
