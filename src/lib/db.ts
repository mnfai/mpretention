import Database from "@tauri-apps/plugin-sql";
import { appDataDir, join } from "@tauri-apps/api/path";
import { runMigrations } from "./migrations";
import { resolveCustomerBatch } from "./customerResolver";
import type { ExistingCustomer, NewCustomerRecord } from "./customerResolver";
import type {
  Brand,
  CustomerStats,
  DailyRetentionRow,
  GmvMode,
  ImportLogCounts,
  ImportLogEntry,
  Platform,
  ResolvedTransaction,
  RetentionTotals,
  SourceType,
  SummaryFilters,
  SummaryRow,
} from "./types";

/** Chunk size for bulk multi-row INSERT / IN-clause statements. */
const BULK_CHUNK_SIZE = 500;

export const DB_FILENAME = "mpretention.db";
const DB_PATH = `sqlite:${DB_FILENAME}`;

let dbInstance: Database | null = null;

/** Returns the shared database connection, running migrations on first use. */
export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load(DB_PATH);
    await runMigrations(dbInstance);
  }
  return dbInstance;
}

/** Closes the active connection so the underlying file can be replaced. */
export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

/** Absolute path to the SQLite database file on disk. */
export async function getDbFilePath(): Promise<string> {
  const dir = await appDataDir();
  return join(dir, DB_FILENAME);
}

/** Total number of rows in the transactions table. */
export async function getTransactionCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>("SELECT COUNT(*) AS count FROM transactions");
  return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

const TX_COLUMNS = `
  brand, platform, order_id, order_status, is_cancelled, created_at,
  sku, product_name, variation, qty, price_original, price_after_disc,
  gmv_gross, total_payment, warehouse, import_batch_id,
  customer_id, is_retention, buyer_username, phone, recipient, province, regency_city
`;
const TX_PLACEHOLDERS = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

/**
 * Inserts rows as a single multi-row INSERT OR IGNORE statement, so the whole
 * chunk is one atomic SQLite statement (and one IPC round trip) regardless of
 * which pooled connection it runs on. Duplicates (same platform + order_id +
 * sku) are silently skipped.
 */
export async function insertTransactions(
  rows: ResolvedTransaction[],
  importBatchId: number,
): Promise<{ inserted: number; skipped: number }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  const db = await getDb();
  const placeholders = rows.map(() => TX_PLACEHOLDERS).join(", ");
  const params = rows.flatMap((row) => [
    row.brand,
    row.platform,
    row.order_id,
    row.order_status,
    row.is_cancelled,
    row.created_at,
    row.sku,
    row.product_name,
    row.variation,
    row.qty,
    row.price_original,
    row.price_after_disc,
    row.gmv_gross,
    row.total_payment,
    row.warehouse,
    importBatchId,
    row.customer_id,
    row.is_retention,
    row.buyer_username,
    row.phone,
    row.recipient,
    row.province,
    row.regency_city,
  ]);

  const result = await db.execute(
    `INSERT OR IGNORE INTO transactions (${TX_COLUMNS}) VALUES ${placeholders}`,
    params,
  );

  const inserted = result.rowsAffected;
  return { inserted, skipped: rows.length - inserted };
}

/** Exact inserted/cancelled row counts for a finished import batch. */
export async function getBatchCounts(
  importBatchId: number,
): Promise<{ inserted: number; cancelled: number }> {
  const db = await getDb();
  const rows = await db.select<{ inserted: number; cancelled: number | null }[]>(
    "SELECT COUNT(*) AS inserted, SUM(is_cancelled) AS cancelled FROM transactions WHERE import_batch_id = ?",
    [importBatchId],
  );
  return { inserted: rows[0]?.inserted ?? 0, cancelled: rows[0]?.cancelled ?? 0 };
}

// ---------------------------------------------------------------------------
// Customers / retention
// ---------------------------------------------------------------------------

const CUSTOMER_COLUMNS = `
  platform, brand, customer_key, match_tier, buyer_username, phone,
  recipient, province, regency_city, first_order_id, first_purchase_date, total_orders
`;
const CUSTOMER_PLACEHOLDERS = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

/** Builds a unique dedup key for an (order_id, sku) pair. Shared with useImport.ts. */
export function txKey(orderId: string, sku: string): string {
  return `${orderId}${sku}`;
}

/** (order_id, sku) pairs already present for a brand+platform, for duplicate pre-filtering. */
export async function getExistingTxKeys(platform: Platform, brand: Brand): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.select<{ order_id: string; sku: string }[]>(
    "SELECT order_id, sku FROM transactions WHERE platform = ? AND brand = ?",
    [platform, brand],
  );
  return new Set(rows.map((r) => txKey(r.order_id, r.sku)));
}

/** Every customer already known for this brand+platform (for in-memory matching). */
export async function getCustomersForBrandPlatform(
  brand: Brand,
  platform: Platform,
): Promise<ExistingCustomer[]> {
  const db = await getDb();
  return db.select<ExistingCustomer[]>(
    "SELECT id, customer_key FROM customers WHERE brand = ? AND platform = ?",
    [brand, platform],
  );
}

/** Bulk-inserts brand-new customers via chunked multi-row INSERT OR IGNORE. */
export async function insertCustomers(
  records: NewCustomerRecord[],
  brand: Brand,
  platform: Platform,
): Promise<void> {
  if (records.length === 0) return;
  const db = await getDb();

  for (let i = 0; i < records.length; i += BULK_CHUNK_SIZE) {
    const chunk = records.slice(i, i + BULK_CHUNK_SIZE);
    const placeholders = chunk.map(() => CUSTOMER_PLACEHOLDERS).join(", ");
    const params = chunk.flatMap((r) => [
      platform,
      brand,
      r.customer_key,
      r.match_tier,
      r.buyer_username,
      r.phone,
      r.recipient,
      r.province,
      r.regency_city,
      r.first_order_id,
      r.first_purchase_date,
      r.total_orders,
    ]);
    await db.execute(`INSERT OR IGNORE INTO customers (${CUSTOMER_COLUMNS}) VALUES ${placeholders}`, params);
  }
}

/** Looks up customer ids for a set of customer_keys (chunked IN-clause). */
export async function getCustomerIdsByKeys(
  brand: Brand,
  platform: Platform,
  keys: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (keys.length === 0) return result;
  const db = await getDb();

  for (let i = 0; i < keys.length; i += BULK_CHUNK_SIZE) {
    const chunk = keys.slice(i, i + BULK_CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await db.select<{ id: number; customer_key: string }[]>(
      `SELECT id, customer_key FROM customers WHERE brand = ? AND platform = ? AND customer_key IN (${placeholders})`,
      [brand, platform, ...chunk],
    );
    for (const row of rows) result.set(row.customer_key, row.id);
  }
  return result;
}

/** Adds `increment` repeat orders to each existing customer's total_orders. */
export async function incrementCustomerOrders(
  updates: { id: number; increment: number }[],
): Promise<void> {
  if (updates.length === 0) return;
  const db = await getDb();
  for (const u of updates) {
    await db.execute("UPDATE customers SET total_orders = total_orders + ? WHERE id = ?", [u.increment, u.id]);
  }
}

interface RawRetentionRow {
  date: string;
  product_sold: number | null;
  retention_tx: number | null;
  gmv: number | null;
}

function toRetentionRow(date: string, raw: RawRetentionRow): DailyRetentionRow {
  const productSold = raw.product_sold ?? 0;
  const retentionTx = raw.retention_tx ?? 0;
  const gmv = raw.gmv ?? 0;

  if (retentionTx === 0 && productSold === 0 && gmv === 0) {
    return { date, product_sold: null, retention_tx: null, gmv: null, aov: null, rpu: null };
  }

  return {
    date,
    product_sold: productSold,
    retention_tx: retentionTx,
    gmv,
    aov: retentionTx > 0 ? Math.round((gmv / retentionTx) * 100) / 100 : null,
    rpu: productSold > 0 ? Math.round((gmv / productSold) * 100) / 100 : null,
  };
}

/** One aggregated retention row per calendar day with retention activity, within the given filters. */
export async function getDailyRetention(filters: SummaryFilters): Promise<DailyRetentionRow[]> {
  const db = await getDb();
  const gmvCol = filters.gmvMode === "gross" ? "retention_gmv" : "retention_gmv_net";

  const rows = await db.select<RawRetentionRow[]>(
    `SELECT
        year || '-' || month || '-' || day AS date,
        SUM(retention_product_sold) AS product_sold,
        SUM(retention_tx) AS retention_tx,
        SUM(${gmvCol}) AS gmv
     FROM daily_retention
     WHERE (? = 'All' OR brand = ?)
       AND (? = 'All' OR platform = ?)
       AND (year || '-' || month || '-' || day) BETWEEN ? AND ?
     GROUP BY date
     ORDER BY date`,
    [filters.brand, filters.brand, filters.platform, filters.platform, filters.dateFrom, filters.dateTo],
  );

  return rows.map((row) => toRetentionRow(row.date, row));
}

interface RawRetentionTotals {
  retention_product_sold: number | null;
  retention_tx: number | null;
  total_tx: number | null;
  retention_gmv: number | null;
}

/** Aggregated retention metrics across the entire filtered range (for cards). */
export async function getRetentionTotals(filters: SummaryFilters): Promise<RetentionTotals | null> {
  const db = await getDb();
  const gmvCol = filters.gmvMode === "gross" ? "retention_gmv" : "retention_gmv_net";

  const rows = await db.select<RawRetentionTotals[]>(
    `SELECT
        SUM(retention_product_sold) AS retention_product_sold,
        SUM(retention_tx) AS retention_tx,
        SUM(total_tx) AS total_tx,
        SUM(${gmvCol}) AS retention_gmv
     FROM daily_retention
     WHERE (? = 'All' OR brand = ?)
       AND (? = 'All' OR platform = ?)
       AND (year || '-' || month || '-' || day) BETWEEN ? AND ?`,
    [filters.brand, filters.brand, filters.platform, filters.platform, filters.dateFrom, filters.dateTo],
  );

  const raw = rows[0];
  if (!raw || raw.total_tx === null) return null;

  const retentionTx = raw.retention_tx ?? 0;
  const totalTx = raw.total_tx ?? 0;
  const retentionGmv = raw.retention_gmv ?? 0;
  const retentionProductSold = raw.retention_product_sold ?? 0;

  return {
    retention_product_sold: retentionProductSold,
    retention_tx: retentionTx,
    total_tx: totalTx,
    retention_gmv: retentionGmv,
    retention_rate: totalTx > 0 ? Math.round((retentionTx * 10000) / totalTx) / 100 : null,
    retention_aov: retentionTx > 0 ? Math.round((retentionGmv / retentionTx) * 100) / 100 : null,
    retention_rpu: retentionProductSold > 0 ? Math.round((retentionGmv / retentionProductSold) * 100) / 100 : null,
  };
}

/** Customer counts by platform and match tier, for the Settings Customer Data card. */
export async function getCustomerStats(): Promise<CustomerStats> {
  const db = await getDb();

  const [totals] = await db.select<{ total: number; shopee: number; tiktok: number }[]>(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN platform = 'Shopee' THEN 1 ELSE 0 END) AS shopee,
        SUM(CASE WHEN platform = 'TikTokShop' THEN 1 ELSE 0 END) AS tiktok
     FROM customers`,
  );

  const tiers = await db.select<{ match_tier: number | null; count: number }[]>(
    `SELECT match_tier, COUNT(*) AS count FROM customers GROUP BY match_tier`,
  );

  const [retention] = await db.select<{ retention_tx: number | null }[]>(
    `SELECT COUNT(DISTINCT order_id) AS retention_tx FROM transactions WHERE is_retention = 1 AND is_cancelled = 0`,
  );

  const tierCounts = { tier1: 0, tier2: 0, tier3: 0, unresolved: 0 };
  for (const row of tiers) {
    if (row.match_tier === 1) tierCounts.tier1 = row.count;
    else if (row.match_tier === 2) tierCounts.tier2 = row.count;
    else if (row.match_tier === 3) tierCounts.tier3 = row.count;
    else tierCounts.unresolved = row.count;
  }

  return {
    totalCustomers: totals?.total ?? 0,
    shopeeCustomers: totals?.shopee ?? 0,
    tiktokCustomers: totals?.tiktok ?? 0,
    totalRetentionTx: retention?.retention_tx ?? 0,
    ...tierCounts,
  };
}

interface ResolvableTxRow {
  id: number;
  platform: Platform;
  brand: Brand;
  order_id: string;
  created_at: string;
  buyer_username: string | null;
  phone: string | null;
  recipient: string | null;
  province: string | null;
  regency_city: string | null;
}

/**
 * Rebuilds the entire `customers` table and every transaction's
 * `customer_id` / `is_retention` from scratch, processing each
 * (brand, platform) group independently in chronological order.
 *
 * Avoids TEMP TABLEs (connection-local, unsafe with sqlx's pooled
 * connections) by driving the bulk transaction update through a
 * `WITH ... AS (VALUES ...)` CTE per chunk.
 */
export async function reResolveAllCustomers(
  onProgress?: (current: number, total: number) => void,
): Promise<CustomerStats> {
  const db = await getDb();

  await db.execute("DELETE FROM customers");
  await db.execute("DELETE FROM sqlite_sequence WHERE name = 'customers'");
  await db.execute("UPDATE transactions SET customer_id = NULL, is_retention = 0");

  const groups = await db.select<{ platform: Platform; brand: Brand }[]>(
    "SELECT DISTINCT platform, brand FROM transactions",
  );

  const allUpdates: { id: number; customer_id: number; is_retention: 0 | 1 }[] = [];
  let nextCustomerId = 1;

  for (const { platform, brand } of groups) {
    const rows = await db.select<ResolvableTxRow[]>(
      `SELECT id, platform, brand, order_id, created_at, buyer_username, phone, recipient, province, regency_city
       FROM transactions
       WHERE platform = ? AND brand = ?
       ORDER BY created_at ASC, id ASC`,
      [platform, brand],
    );

    const { resolved, newCustomers } = resolveCustomerBatch(rows, platform, []);

    // newCustomers is in first-seen (chronological) order; with an empty
    // customers table and a reset sqlite_sequence, the Nth inserted row gets
    // id = N, so ids can be assigned sequentially without re-querying.
    const idByKey = new Map<string, number>();
    for (const record of newCustomers) {
      idByKey.set(record.customer_key, nextCustomerId++);
    }
    await insertCustomers(newCustomers, brand, platform);

    for (let i = 0; i < rows.length; i++) {
      const customerId = idByKey.get(resolved[i].customer_key);
      if (customerId === undefined) {
        throw new Error(`Customer resolution produced no id for key ${resolved[i].customer_key}`);
      }
      allUpdates.push({ id: rows[i].id, customer_id: customerId, is_retention: resolved[i].is_retention });
    }
  }

  const total = allUpdates.length;
  const UPDATE_CHUNK_SIZE = 300;
  onProgress?.(0, total);
  for (let i = 0; i < allUpdates.length; i += UPDATE_CHUNK_SIZE) {
    const chunk = allUpdates.slice(i, i + UPDATE_CHUNK_SIZE);
    const values = chunk.map(() => "(?, ?, ?)").join(", ");
    const params = chunk.flatMap((u) => [u.id, u.customer_id, u.is_retention]);
    await db.execute(
      `WITH v(id, customer_id, is_retention) AS (VALUES ${values})
       UPDATE transactions
       SET customer_id = (SELECT customer_id FROM v WHERE v.id = transactions.id),
           is_retention = (SELECT is_retention FROM v WHERE v.id = transactions.id)
       WHERE id IN (SELECT id FROM v)`,
      params,
    );
    onProgress?.(Math.min(i + UPDATE_CHUNK_SIZE, total), total);
  }

  return getCustomerStats();
}

// ---------------------------------------------------------------------------
// Import log
// ---------------------------------------------------------------------------

/** Creates a placeholder import_log row and returns its id (the batch id). */
export async function createImportLog(entry: {
  brand: string;
  platform: string;
  filename: string;
  source_type: SourceType;
  gmv_mode: GmvMode;
}): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO import_log (
      brand, platform, filename, imported_at, row_count, skipped_count,
      cancelled_count, source_type, gmv_mode
    ) VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?)`,
    [
      entry.brand,
      entry.platform,
      entry.filename,
      new Date().toISOString(),
      entry.source_type,
      entry.gmv_mode,
    ],
  );
  return result.lastInsertId as number;
}

/** Updates an import_log row with final filename and row counts. */
export async function finalizeImportLog(
  id: number,
  filename: string,
  counts: ImportLogCounts,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE import_log
     SET filename = ?, row_count = ?, skipped_count = ?, cancelled_count = ?
     WHERE id = ?`,
    [filename, counts.row_count, counts.skipped_count, counts.cancelled_count, id],
  );
}

/** All import log entries, most recent first. */
export async function getImportLogs(): Promise<ImportLogEntry[]> {
  const db = await getDb();
  return db.select<ImportLogEntry[]>(
    "SELECT * FROM import_log ORDER BY imported_at DESC",
  );
}

/** Deletes every transaction from a batch plus its import_log entry. */
export async function deleteImportBatch(batchId: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM transactions WHERE import_batch_id = ?", [batchId]);
  await db.execute("DELETE FROM import_log WHERE id = ?", [batchId]);
}

// ---------------------------------------------------------------------------
// Daily summary
// ---------------------------------------------------------------------------

interface RawSummaryRow {
  date: string;
  product_sold: number | null;
  total_tx: number | null;
  gmv: number | null;
  cancelled_tx: number | null;
}

function gmvColumn(gmvMode: GmvMode): "gmv_gross" | "gmv_net" {
  return gmvMode === "gross" ? "gmv_gross" : "gmv_net";
}

function toSummaryRow(date: string, raw: RawSummaryRow): SummaryRow {
  const productSold = raw.product_sold ?? 0;
  const totalTx = raw.total_tx ?? 0;
  const gmv = raw.gmv ?? 0;
  const cancelledTx = raw.cancelled_tx ?? 0;
  const totalOrders = totalTx + cancelledTx;

  return {
    date,
    product_sold: productSold,
    total_tx: totalTx,
    gmv,
    cancelled_tx: cancelledTx,
    aov: totalTx > 0 ? Math.round((gmv / totalTx) * 100) / 100 : null,
    rpu: productSold > 0 ? Math.round((gmv / productSold) * 100) / 100 : null,
    cancellation_rate:
      totalOrders > 0 ? Math.round(((cancelledTx * 100) / totalOrders) * 100) / 100 : null,
  };
}

/** One aggregated row per calendar day with data, within the given filters. */
export async function getDailySummary(filters: SummaryFilters): Promise<SummaryRow[]> {
  const db = await getDb();
  const gmvCol = gmvColumn(filters.gmvMode);

  const rows = await db.select<RawSummaryRow[]>(
    `SELECT
        year || '-' || month || '-' || day AS date,
        SUM(product_sold) AS product_sold,
        SUM(total_tx) AS total_tx,
        SUM(${gmvCol}) AS gmv,
        SUM(cancelled_tx) AS cancelled_tx
     FROM daily_summary
     WHERE (? = 'All' OR brand = ?)
       AND (? = 'All' OR platform = ?)
       AND (year || '-' || month || '-' || day) BETWEEN ? AND ?
     GROUP BY date
     ORDER BY date`,
    [filters.brand, filters.brand, filters.platform, filters.platform, filters.dateFrom, filters.dateTo],
  );

  return rows.map((row) => toSummaryRow(row.date, row));
}

/** A single row aggregated across the entire filtered range (for cards/totals). */
export async function getSummaryTotals(filters: SummaryFilters): Promise<SummaryRow | null> {
  const db = await getDb();
  const gmvCol = gmvColumn(filters.gmvMode);

  const rows = await db.select<RawSummaryRow[]>(
    `SELECT
        SUM(product_sold) AS product_sold,
        SUM(total_tx) AS total_tx,
        SUM(${gmvCol}) AS gmv,
        SUM(cancelled_tx) AS cancelled_tx
     FROM daily_summary
     WHERE (? = 'All' OR brand = ?)
       AND (? = 'All' OR platform = ?)
       AND (year || '-' || month || '-' || day) BETWEEN ? AND ?`,
    [filters.brand, filters.brand, filters.platform, filters.platform, filters.dateFrom, filters.dateTo],
  );

  const raw = rows[0];
  if (!raw || raw.total_tx === null) return null;
  return toSummaryRow("", raw);
}

// ---------------------------------------------------------------------------
// Danger zone
// ---------------------------------------------------------------------------

/** Wipes all transactions and import history, resetting autoincrement ids. */
export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM transactions");
  await db.execute("DELETE FROM import_log");
  await db.execute("DELETE FROM sqlite_sequence WHERE name IN ('transactions', 'import_log')");
}
