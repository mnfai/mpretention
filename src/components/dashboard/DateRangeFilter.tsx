import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Button } from "@/components/selia/button";
import { cn } from "@/lib/utils";

const ISO_DATE = "yyyy-MM-dd";
const DISPLAY_DATE = "d MMM yyyy";
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
}

function thisMonthRange(): [string, string] {
  const today = new Date();
  return [format(startOfMonth(today), ISO_DATE), format(today, ISO_DATE)];
}

function lastMonthRange(): [string, string] {
  const lastMonth = subMonths(new Date(), 1);
  return [format(startOfMonth(lastMonth), ISO_DATE), format(endOfMonth(lastMonth), ISO_DATE)];
}

/**
 * Date-range picker with its own day grid (no native <input type="date">),
 * so selecting a day always closes the picker immediately - the native
 * picker in most webviews needs an explicit Esc to dismiss, which is the
 * whole reason this exists.
 */
export function DateRangeFilter({ dateFrom, dateTo, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [pickingTo, setPickingTo] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => parseISO(dateFrom));

  const [thisMonthFrom, thisMonthTo] = thisMonthRange();
  const [lastMonthFrom, lastMonthTo] = lastMonthRange();
  const isThisMonth = dateFrom === thisMonthFrom && dateTo === thisMonthTo;
  const isLastMonth = dateFrom === lastMonthFrom && dateTo === lastMonthTo;

  function applyPreset(from: string, to: string) {
    onChange(from, to);
    setCustomOpen(false);
    setOpen(false);
  }

  function openCustom() {
    setDraftFrom(dateFrom);
    setPickingTo(false);
    setVisibleMonth(parseISO(dateFrom));
    setCustomOpen(true);
  }

  function pickDay(day: Date) {
    const iso = format(day, ISO_DATE);
    if (!pickingTo) {
      setDraftFrom(iso);
      setPickingTo(true);
      return;
    }
    const from = isBefore(day, parseISO(draftFrom)) ? iso : draftFrom;
    const to = isBefore(day, parseISO(draftFrom)) ? draftFrom : iso;
    onChange(from, to);
    setCustomOpen(false);
    setPickingTo(false);
    setOpen(false);
  }

  const label = isSameDay(new Date(dateFrom), new Date(dateTo))
    ? format(new Date(dateFrom), DISPLAY_DATE)
    : `${format(new Date(dateFrom), DISPLAY_DATE)} – ${format(new Date(dateTo), DISPLAY_DATE)}`;

  const gridStart = startOfWeek(startOfMonth(visibleMonth));
  const gridEnd = endOfWeek(endOfMonth(visibleMonth));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const rangeStart = parseISO(draftFrom);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const startInCustom = !isThisMonth && !isLastMonth;
          if (startInCustom) openCustom();
          else setCustomOpen(false);
        }
      }}
    >
      <Popover.Trigger
        render={
          <Button variant="outline" size="sm">
            {label}
          </Button>
        }
      />
      <Popover.Portal>
        <Popover.Backdrop />
        <Popover.Positioner side="bottom" align="start" sideOffset={6}>
          <Popover.Popup className="w-72 rounded bg-popover p-1 ring ring-popover-border shadow-popover outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-90 data-[starting-style]:opacity-0 data-[starting-style]:scale-90 transition-[transform,scale,opacity]">
            <PresetItem active={isThisMonth} onClick={() => applyPreset(thisMonthFrom, thisMonthTo)}>
              Bulan Ini
            </PresetItem>
            <PresetItem active={isLastMonth} onClick={() => applyPreset(lastMonthFrom, lastMonthTo)}>
              Bulan Lalu
            </PresetItem>
            <PresetItem active={customOpen} onClick={openCustom}>
              Custom
            </PresetItem>

            {customOpen && (
              <div className="mt-1 border-t border-popover-separator p-2 pt-2.5">
                <div className="mb-2 text-xs text-muted">
                  {pickingTo ? (
                    <>
                      From <span className="font-medium text-foreground">{format(rangeStart, DISPLAY_DATE)}</span> —
                      pick end date
                    </>
                  ) : (
                    "Pick start date"
                  )}
                </div>

                <div className="mb-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setVisibleMonth((m) => subMonths(m, 1))}
                    className="rounded-sm px-2 py-1 text-sm text-muted hover:bg-popover-accent hover:text-foreground"
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                  <div className="text-sm font-medium">{format(visibleMonth, "MMMM yyyy")}</div>
                  <button
                    type="button"
                    onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
                    className="rounded-sm px-2 py-1 text-sm text-muted hover:bg-popover-accent hover:text-foreground"
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-y-0.5 text-center">
                  {WEEKDAY_LABELS.map((w) => (
                    <div key={w} className="py-1 text-xs text-dimmed">
                      {w}
                    </div>
                  ))}
                  {days.map((day) => {
                    const inMonth = isSameMonth(day, visibleMonth);
                    const isStart = pickingTo && isSameDay(day, rangeStart);
                    const inRange = pickingTo && isAfter(day, rangeStart);
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => pickDay(day)}
                        className={cn(
                          "aspect-square rounded-sm text-sm transition-colors",
                          inMonth ? "text-foreground" : "text-dimmed/50",
                          isStart
                            ? "bg-primary text-primary-foreground"
                            : inRange
                              ? "bg-popover-accent"
                              : "hover:bg-popover-accent",
                        )}
                      >
                        {format(day, "d")}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function PresetItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-sm px-3 py-2 text-left text-sm transition-colors",
        active ? "bg-popover-accent text-foreground" : "text-popover-foreground hover:bg-popover-accent",
      )}
    >
      {children}
    </button>
  );
}
