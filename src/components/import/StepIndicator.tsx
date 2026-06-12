import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImportStep } from "@/hooks/useImport";

const STEPS: { step: ImportStep; label: string }[] = [
  { step: 1, label: "Brand & Platform" },
  { step: 2, label: "Upload Files" },
  { step: 3, label: "Mapping Preview" },
  { step: 4, label: "Import" },
];

interface StepIndicatorProps {
  step: ImportStep;
  /** Jump back to a completed step. Future steps are never clickable. */
  onStepClick?: (step: ImportStep) => void;
}

export function StepIndicator({ step, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center">
      {STEPS.map(({ step: s, label }, i) => {
        const completed = s < step;
        const clickable = completed && !!onStepClick;
        return (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(s)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm font-semibold ring-2 transition-colors",
                  completed
                    ? "bg-primary text-primary-foreground ring-primary"
                    : s === step
                      ? "bg-background text-primary ring-primary"
                      : "bg-background text-muted ring-border",
                  clickable ? "cursor-pointer hover:opacity-80" : "cursor-default",
                )}
              >
                {completed ? <Check className="size-4" /> : s}
              </button>
              <span className={cn("text-xs font-medium", s <= step ? "text-foreground" : "text-muted")}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-2 h-px flex-1", s < step ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
