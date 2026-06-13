import { useEffect, useState } from "react";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { getDailyRetention, getRetentionTotals } from "@/lib/db";
import type { DailyRetentionRow, RetentionTotals, SummaryFilters } from "@/lib/types";

const EMPTY_DAY = (date: string): DailyRetentionRow => ({
  date,
  product_sold: null,
  retention_tx: null,
  gmv: null,
  aov: null,
  rpu: null,
});

interface UseRetentionResult {
  data: DailyRetentionRow[];
  totals: RetentionTotals | null;
  isLoading: boolean;
}

/**
 * Loads the daily retention breakdown for the given filters and fills in
 * every day in the range, even days with no retention purchases.
 */
export function useRetention(filters: SummaryFilters): UseRetentionResult {
  const [data, setData] = useState<DailyRetentionRow[]>([]);
  const [totals, setTotals] = useState<RetentionTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const [rows, totalsRow] = await Promise.all([
        getDailyRetention(filters),
        getRetentionTotals(filters),
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
