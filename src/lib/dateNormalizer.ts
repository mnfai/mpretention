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

/**
 * Normalizes a raw cell value into "YYYY-MM-DD HH:MM:SS".
 *
 * Existing-DB files store dates as Excel serial numbers (decoded with
 * SSF, which avoids any JS Date/timezone shift). Fresh exports store
 * dates as platform-specific strings.
 */
export function normalizeDate(raw: unknown, platform: Platform): string {
  // Handle null/undefined/empty
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return "1970-01-01 00:00:00"; // fallback for missing dates
  }

  if (typeof raw === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(raw) as SSFDate;
      if (!d || !d.y) return "1970-01-01 00:00:00";
      return `${d.y}-${pad(d.m)}-${pad(d.d)} ${pad(d.H)}:${pad(d.M)}:${pad(Math.round(d.S))}`;
    } catch {
      return "1970-01-01 00:00:00";
    }
  }

  const value = String(raw ?? "").trim();

  if (platform === "Shopee") {
    // "YYYY-MM-DD HH:mm" -> "YYYY-MM-DD HH:mm:00"
    const match = value.match(SHOPEE_EXPORT_FORMAT);
    return match ? `${match[1]}:00` : "1970-01-01 00:00:00";
  }

  // TikTok export: "DD/MM/YYYY HH:mm:ss" -> "YYYY-MM-DD HH:mm:ss"
  const match = value.match(TIKTOK_EXPORT_FORMAT);
  if (match) {
    const [, dd, mm, yyyy, time] = match;
    return `${yyyy}-${mm}-${dd} ${time}`;
  }

  // Last resort: return fallback instead of raw unparseable value
  return "1970-01-01 00:00:00";
}
