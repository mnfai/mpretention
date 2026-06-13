import { invoke } from "@tauri-apps/api/core";
import { normalizeDate } from "./dateNormalizer";
import type { Brand, Platform, SourceType, Transaction } from "./types";

/** Raw sheet data returned by the `parse_xlsx_backend` Rust command. */
interface ParsedSheet {
  sheetName: string;
  rows: unknown[][];
}

export interface FileProfile {
  platform: Platform;
  sourceType: SourceType;
  /** true => monetary values are in thousands and must be multiplied by 1000 */
  isThousands: boolean;
  headers: string[];
}

export interface ParsedFile {
  profile: FileProfile;
  transactions: Transaction[];
  /** Total data rows read from the sheet (excluding the header row). */
  totalDataRows: number;
  /** Rows skipped due to a missing/invalid order id. */
  skippedRows: number;
}

interface ColumnMap {
  order_id: string;
  order_status: string;
  created_at: string;
  sku: string;
  product_name: string;
  variation: string;
  qty: string;
  price_original: string;
  price_after_disc: string | null;
  gmv_gross: string;
  total_payment: string;
  warehouse: string;
  buyer_username: string | null;
  phone: string | null;
  recipient: string | null;
  province: string | null;
  regency_city: string | null;
}

const SHOPEE_BASE_MAP: Omit<ColumnMap, "gmv_gross"> = {
  order_id: "No. Pesanan",
  order_status: "Status Pesanan",
  created_at: "Waktu Pesanan Dibuat",
  sku: "Nomor Referensi SKU",
  product_name: "Nama Produk",
  variation: "Nama Variasi",
  qty: "Jumlah",
  price_original: "Harga Awal",
  price_after_disc: "Harga Setelah Diskon",
  total_payment: "Total Pembayaran",
  warehouse: "Nama Gudang",
  buyer_username: "Username (Pembeli)",
  phone: null,
  recipient: null,
  province: null,
  regency_city: null,
};

const TIKTOK_MAP: ColumnMap = {
  order_id: "Order ID",
  order_status: "Order Status",
  created_at: "Created Time",
  sku: "Seller SKU",
  product_name: "Product Name",
  variation: "Variation",
  qty: "Quantity",
  price_original: "SKU Unit Original Price",
  price_after_disc: null,
  gmv_gross: "SKU Subtotal After Discount",
  total_payment: "Order Amount",
  warehouse: "Warehouse Name",
  buyer_username: "Buyer Username",
  phone: "Phone #",
  recipient: "Recipient",
  province: "Province",
  regency_city: "Regency and City",
};

const SHOPEE_GMV_EXISTING = "Total Harga Produk";
const SHOPEE_GMV_EXPORT = "Subtotal Pesanan";

function getColumnMap(profile: FileProfile): ColumnMap {
  if (profile.platform === "TikTokShop") return TIKTOK_MAP;
  const gmvCol = profile.sourceType === "existing_db" ? SHOPEE_GMV_EXISTING : SHOPEE_GMV_EXPORT;
  return { ...SHOPEE_BASE_MAP, gmv_gross: gmvCol };
}

/** File header -> internal field pairs for the detected profile, for UI display. */
export function getColumnMapping(profile: FileProfile): { field: string; header: string }[] {
  const map = getColumnMap(profile);
  return Object.entries(map)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([field, header]) => ({ field, header }));
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Detects platform, source type and monetary value scale from the sheet's
 * name, headers and first rows of data.
 */
export function detectFileProfile(
  headers: string[],
  dataRows: Record<string, unknown>[],
  sheetName: string,
): FileProfile {
  const isShopee = headers.includes("No. Pesanan");
  const isTikTok = headers.includes("Order ID") && headers.includes("Seller SKU");

  if (!isShopee && !isTikTok) {
    throw new Error("Unrecognized file: expected Shopee or TikTokShop columns.");
  }

  const platform: Platform = isShopee ? "Shopee" : "TikTokShop";

  let gmvColumn: string;
  let sourceType: SourceType;

  if (isShopee) {
    const hasExistingCol = headers.includes(SHOPEE_GMV_EXISTING);
    gmvColumn = hasExistingCol ? SHOPEE_GMV_EXISTING : SHOPEE_GMV_EXPORT;
    sourceType = hasExistingCol ? "existing_db" : "export";
  } else {
    gmvColumn = TIKTOK_MAP.gmv_gross;
    // TikTok source type is determined by sheet name, independent of value
    // scale: "OrderSKUList" is a fresh Seller Center export, anything else
    // (e.g. "Sheet1") is an existing-database export.
    sourceType = sheetName === "OrderSKUList" ? "export" : "existing_db";
  }

  const sampleValues = dataRows
    .slice(0, 20)
    .map((row) => Number(row[gmvColumn]))
    .filter((v) => v > 0);
  // Value-scale detection stays median-based so it adapts automatically if a
  // platform's export format changes (e.g. TikTok's OrderSKUList export
  // switched from thousands to full Rupiah as of mid-2026).
  const isThousands = median(sampleValues) < 1000;

  return { platform, sourceType, isThousands, headers };
}

function isCancelledRow(platform: Platform, status: string): 0 | 1 {
  if (platform === "Shopee") {
    return status.toLowerCase().includes("batal") ? 1 : 0;
  }
  return status === "Dibatalkan" ? 1 : 0;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

function parseQty(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : 1;
}

function parseMoney(value: unknown, isThousands: boolean): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return isThousands ? n * 1000 : n;
}

/**
 * Reads an .xlsx file via the Rust backend (calamine), detects its profile
 * and normalizes every valid row into a Transaction ready for insertion via
 * db.ts. Parsing happens entirely outside the WebView so large (8MB+) files
 * no longer hang or OOM the JS heap.
 */
export async function parseImportFile(path: string, brand: Brand): Promise<ParsedFile> {
  const { sheetName, rows } = await invoke<ParsedSheet>("parse_xlsx_backend", { path });

  const headerRow = rows[0] ?? [];
  const headers = headerRow.map((h) => String(h ?? ""));
  const dataRows: Record<string, unknown>[] = rows.slice(1).map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] ?? null;
    });
    return obj;
  });

  const profile = detectFileProfile(headers, dataRows, sheetName);
  const columnMap = getColumnMap(profile);

  const transactions: Transaction[] = [];
  let skippedRows = 0;

  for (const row of dataRows) {
    const rawOrderId = row[columnMap.order_id];
    const orderId = rawOrderId === null || rawOrderId === undefined ? "" : String(rawOrderId).trim();

    if (orderId === "") {
      skippedRows++;
      continue;
    }
    if (profile.platform === "TikTokShop" && orderId.length < 5) {
      skippedRows++;
      continue;
    }

    const orderStatus = String(row[columnMap.order_status] ?? "");

    transactions.push({
      brand,
      platform: profile.platform,
      order_id: orderId,
      order_status: orderStatus,
      is_cancelled: isCancelledRow(profile.platform, orderStatus),
      created_at: normalizeDate(row[columnMap.created_at], profile.platform),
      sku: String(row[columnMap.sku] ?? ""),
      product_name: nullableString(row[columnMap.product_name]),
      variation: nullableString(row[columnMap.variation]),
      qty: parseQty(row[columnMap.qty]),
      price_original: parseMoney(row[columnMap.price_original], profile.isThousands),
      price_after_disc: columnMap.price_after_disc
        ? parseMoney(row[columnMap.price_after_disc], profile.isThousands)
        : null,
      gmv_gross: parseMoney(row[columnMap.gmv_gross], profile.isThousands) ?? 0,
      total_payment: parseMoney(row[columnMap.total_payment], profile.isThousands),
      warehouse: nullableString(row[columnMap.warehouse]),
      buyer_username: columnMap.buyer_username ? nullableString(row[columnMap.buyer_username]) : null,
      phone: columnMap.phone ? nullableString(row[columnMap.phone]) : null,
      recipient: columnMap.recipient ? nullableString(row[columnMap.recipient]) : null,
      province: columnMap.province ? nullableString(row[columnMap.province]) : null,
      regency_city: columnMap.regency_city ? nullableString(row[columnMap.regency_city]) : null,
    });
  }

  return {
    profile,
    transactions,
    totalDataRows: dataRows.length,
    skippedRows,
  };
}
