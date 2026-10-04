import * as XLSX from "xlsx";
import type { Platform } from "./types";

interface SSFDate {
  y: number;
  m: number;
  d: number;
  H: number;
  M: number;
  S: number;
}

const pad = (n: number): string => String(n).padStart(2, "0");

const SHOPEE_EXPORT_FORMAT = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})$/;
const TIKTOK_EXPORT_FORMAT = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/;

export interface NormalizeDateOptions {
  /**
   * Swap day and month of numeric (Excel serial) dates. Legacy TikTok
   * spreadsheets were saved under a US locale: every "DD/MM/YYYY" text with
   * a day of 1–12 was silently converted to an Excel date as if it were
   * "MM/DD/YYYY" (11 Jan became 1 Nov), while days 13–31 stayed text.
   */
  swapNumericDayMonth?: boolean;
}

/** True for a TikTok "DD/MM/YYYY HH:mm:ss" text date. */
export function isTikTokTextDate(raw: unknown): boolean {
  return typeof raw === "string" && TIKTOK_EXPORT_FORMAT.test(raw.trim());
}

/**
 * Normalizes a raw cell value into "YYYY-MM-DD HH:MM:SS", or null when the
 * value is missing or not a recognised date (the caller skips that row).
 *
 * Existing-DB files store dates as Excel serial numbers (decoded with
 * SSF, which avoids any JS Date/timezone shift). Fresh exports store
 * dates as platform-specific strings.
 */
export function normalizeDate(
  raw: unknown,
  platform: Platform,
  options: NormalizeDateOptions = {},
): string | null {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;

  if (typeof raw === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(raw) as SSFDate;
      if (!d || !d.y) return null;
      const swap = options.swapNumericDayMonth && d.d <= 12;
      const month = swap ? d.d : d.m;
      const day = swap ? d.m : d.d;
      return `${d.y}-${pad(month)}-${pad(day)} ${pad(d.H)}:${pad(d.M)}:${pad(Math.round(d.S))}`;
    } catch {
      return null;
    }
  }

  const value = String(raw).trim();

  if (platform === "Shopee") {
    // "YYYY-MM-DD HH:mm" -> "YYYY-MM-DD HH:mm:00"
    const match = value.match(SHOPEE_EXPORT_FORMAT);
    return match ? `${match[1]}:00` : null;
  }

  // TikTok export: "DD/MM/YYYY HH:mm:ss" -> "YYYY-MM-DD HH:mm:ss"
  const match = value.match(TIKTOK_EXPORT_FORMAT);
  if (match) {
    const [, dd, mm, yyyy, time] = match;
    return `${yyyy}-${mm}-${dd} ${time}`;
  }

  return null;
}
