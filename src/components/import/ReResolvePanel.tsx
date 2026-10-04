import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/selia/button";
import { Progress } from "@/components/selia/progress";
import { cn } from "@/lib/utils";
import { useReResolve } from "@/hooks/useReResolve";
import { useUiStore } from "@/store/uiStore";

/**
 * Re-run Customer Resolution, available right where data is imported. Turns
 * amber and explains why when the stored retention flags are known to be stale.
 */
export function ReResolvePanel({ className }: { className?: string }) {
  const { isResolving, progress, error, run } = useReResolve();
  const stale = useUiStore((s) => s.resolutionStale);
  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl px-4 py-3 ring",
        stale ? "bg-amber-400/10 ring-amber-500/40" : "ring-border",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {stale ? (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          ) : (
            <RefreshCw className="mt-0.5 size-5 shrink-0 text-muted" />
          )}
          <div>
            <div className="text-sm font-medium">Re-run Customer Resolution</div>
            <div className="text-xs text-muted">
              {stale
                ? "Recommended now: older orders were imported after newer ones, or an import was deleted, so some repeat-order flags are out of date."
                : "Rebuilds customers and repeat-order flags from all transactions in date order. Run it after importing older data."}
            </div>
          </div>
        </div>
        <Button variant={stale ? "primary" : "outline"} onClick={() => run()} disabled={isResolving}>
          {isResolving ? "Resolving…" : "Re-run"}
        </Button>
      </div>
      {isResolving && (
        <div className="space-y-1">
          <Progress value={percent} />
          <div className="text-xs text-muted">
            {progress.current.toLocaleString("id-ID")} of {progress.total.toLocaleString("id-ID")} transactions
          </div>
        </div>
      )}
      {error && <div className="text-xs text-danger">Re-run failed: {error}</div>}
    </div>
  );
}
