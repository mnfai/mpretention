import { useEffect, useState } from "react";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { getDailySummary, getSummaryTotals } from "@/lib/db";
import type { DailySummaryRow, SummaryFilters, SummaryRow } from "@/lib/types";

const EMPTY_DAY = (date: string): DailySummaryRow => ({
  date,
  product_sold: null,
  total_tx: null,
  gmv: null,
  aov: null,
  rpu: null,
  cancelled_tx: null,
  cancellation_rate: null,
});

interface UseDailySummaryResult {
  data: DailySummaryRow[];
  totals: SummaryRow | null;
  isLoading: boolean;
}

/**
 * Loads the daily summary for the given filters and fills in every day in
 * the range, even days with no transactions.
 */
export function useDailySummary(filters: SummaryFilters): UseDailySummaryResult {
  const [data, setData] = useState<DailySummaryRow[]>([]);
  const [totals, setTotals] = useState<SummaryRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const [rows, totalsRow] = await Promise.all([
        getDailySummary(filters),
        getSummaryTotals(filters),
      ]);
      if (cancelled) return;

      const byDate = new Map(rows.map((row) => [row.date, row]));
      const scaffold = eachDayOfInterval({
        start: parseISO(filters.dateFrom),
        end: parseISO(filters.dateTo),
      }).map((d) => {
        const date = format(d, "yyyy-MM-dd");
        return byDate.get(date) ?? EMPTY_DAY(date);
      });

      setData(scaffold);
      setTotals(totalsRow);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [filters.brand, filters.platform, filters.gmvMode, filters.dateFrom, filters.dateTo]);

  return { data, totals, isLoading };
}
