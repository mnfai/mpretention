export type Brand = "Amura" | "Reglow";
export type Platform = "Shopee" | "TikTokShop";
export type SourceType = "existing_db" | "export";
export type GmvMode = "gross" | "net";

export type BrandFilter = Brand | "All";
export type PlatformFilter = Platform | "All";

/** A single normalized transaction row, ready for insertion. */
export interface Transaction {
  brand: Brand;
  platform: Platform;
  order_id: string;
  order_status: string;
  is_cancelled: 0 | 1;
  /** ISO-ish format: "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS" */
  created_at: string;
  sku: string;
  product_name: string | null;
  variation: string | null;
  qty: number;
  price_original: number | null;
  price_after_disc: number | null;
  gmv_gross: number;
  total_payment: number | null;
  warehouse: string | null;
  /** Shopee: "Username (Pembeli)". TikTok: "Buyer Username". Null if not present in the file. */
  buyer_username: string | null;
  /** TikTok only: "Phone #". */
  phone: string | null;
  /** TikTok only: "Recipient". */
  recipient: string | null;
  /** TikTok only: "Province". */
  province: string | null;
  /** TikTok only: "Regency and City". */
  regency_city: string | null;
}

/** Match tier used to build a customer_key. Null = Tier 4 (no identity match). */
export type MatchTier = 1 | 2 | 3 | null;

/** A Transaction with customer resolution applied, ready for insertion. */
export interface ResolvedTransaction extends Transaction {
  customer_id: number;
  is_retention: 0 | 1;
}

/** A row in the `customers` table. */
export interface Customer {
  id: number;
  platform: Platform;
  brand: Brand;
  customer_key: string;
  match_tier: MatchTier;
  buyer_username: string | null;
  phone: string | null;
  recipient: string | null;
  province: string | null;
  regency_city: string | null;
  first_order_id: string;
  first_purchase_date: string;
  total_orders: number;
}

export interface ImportLogEntry {
  id: number;
  brand: Brand;
  platform: Platform;
  filename: string;
  imported_at: string;
  row_count: number;
  skipped_count: number;
  cancelled_count: number;
  source_type: SourceType;
  gmv_mode: GmvMode;
}

export interface ImportLogCounts {
  row_count: number;
  skipped_count: number;
  cancelled_count: number;
}

export interface SummaryFilters {
  brand: BrandFilter;
  platform: PlatformFilter;
  gmvMode: GmvMode;
  /** "YYYY-MM-DD" */
  dateFrom: string;
  /** "YYYY-MM-DD" */
  dateTo: string;
}

/** One row of the daily summary table, already aggregated per filters. */
export interface SummaryRow {
  /** "YYYY-MM-DD" */
  date: string;
  product_sold: number;
  total_tx: number;
  gmv: number;
  aov: number | null;
  rpu: number | null;
  cancelled_tx: number;
  cancellation_rate: number | null;
}

/**
 * One calendar day in the dashboard table. Days with no transactions keep
 * `date` but have every metric set to `null`, rendered as "—".
 */
export interface DailySummaryRow {
  /** "YYYY-MM-DD" */
  date: string;
  product_sold: number | null;
  total_tx: number | null;
  gmv: number | null;
  aov: number | null;
  rpu: number | null;
  cancelled_tx: number | null;
  cancellation_rate: number | null;
}

/**
 * One calendar day in the retention table. Days with no retention purchases
 * keep `date` but have every metric set to `null`, rendered as "—".
 */
export interface DailyRetentionRow {
  /** "YYYY-MM-DD" */
  date: string;
  product_sold: number | null;
  retention_tx: number | null;
  gmv: number | null;
  aov: number | null;
  rpu: number | null;
}

/** Aggregated retention metrics across an entire filtered range (for cards/totals). */
export interface RetentionTotals {
  retention_product_sold: number;
  retention_tx: number;
  total_tx: number;
  retention_gmv: number;
  retention_rate: number | null;
  retention_aov: number | null;
  retention_rpu: number | null;
}

/** Customer Data card stats shown on the Settings page. */
export interface CustomerStats {
  totalCustomers: number;
  shopeeCustomers: number;
  tiktokCustomers: number;
  totalRetentionTx: number;
  tier1: number;
  tier2: number;
  tier3: number;
  unresolved: number;
}
