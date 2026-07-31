import { format } from "date-fns";
import { id } from "date-fns/locale";

/** Indonesian Rupiah format: "Rp 54.545.870" (dot thousands separator, no decimals). */
export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}

/** Plain integer with Indonesian thousands separator, e.g. "1.234". */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return value.toLocaleString("id-ID");
}

/** Percentage with 2 decimals, e.g. "3.24%". */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return value.toFixed(2) + "%";
}

/** Full date, e.g. "01 Jun 2026". Accepts "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS". */
export function formatDate(dateStr: string): string {
  return format(new Date(dateStr.replace(" ", "T")), "dd MMM yyyy", { locale: id });
}

/** Zero-padded day number for table rows: "01", "02", ... "31". */
export function formatDay(day: string | number): string {
  return String(day).padStart(2, "0");
}
