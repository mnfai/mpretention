import type Database from "@tauri-apps/plugin-sql";

/**
 * Creates all tables, indexes and views if they don't already exist.
 * Safe to run on every app startup.
 */
export async function runMigrations(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        brand            TEXT NOT NULL,
        platform         TEXT NOT NULL,
        order_id         TEXT NOT NULL,
        order_status     TEXT NOT NULL,
        is_cancelled     INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT NOT NULL,
        sku              TEXT NOT NULL,
        product_name     TEXT,
        variation        TEXT,
        qty              INTEGER NOT NULL DEFAULT 1,
        price_original   REAL,
        price_after_disc REAL,
        gmv_gross        REAL NOT NULL,
        total_payment    REAL,
        warehouse        TEXT,
        import_batch_id  INTEGER
    )
  `);

  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_tx
    ON transactions(platform, order_id, sku)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS import_log (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        brand           TEXT NOT NULL,
        platform        TEXT NOT NULL,
        filename        TEXT NOT NULL,
        imported_at     TEXT NOT NULL,
        row_count       INTEGER,
        skipped_count   INTEGER,
        cancelled_count INTEGER,
        source_type     TEXT NOT NULL DEFAULT 'export',
        gmv_mode        TEXT NOT NULL DEFAULT 'gross'
    )
  `);

  await db.execute(`
    CREATE VIEW IF NOT EXISTS daily_summary AS
    SELECT
        strftime('%Y', created_at) AS year,
        strftime('%m', created_at) AS month,
        strftime('%d', created_at) AS day,
        brand,
        platform,
        SUM(CASE WHEN is_cancelled=0 THEN qty ELSE 0 END) AS product_sold,
        COUNT(DISTINCT CASE WHEN is_cancelled=0 THEN order_id END) AS total_tx,
        SUM(CASE WHEN is_cancelled=0 THEN gmv_gross ELSE 0 END) AS gmv_gross,
        SUM(CASE WHEN is_cancelled=0 THEN total_payment ELSE 0 END) AS gmv_net,
        ROUND(
            SUM(CASE WHEN is_cancelled=0 THEN gmv_gross ELSE 0 END)
            / NULLIF(COUNT(DISTINCT CASE WHEN is_cancelled=0 THEN order_id END), 0),
        2) AS aov,
        ROUND(
            SUM(CASE WHEN is_cancelled=0 THEN gmv_gross ELSE 0 END)
            / NULLIF(SUM(CASE WHEN is_cancelled=0 THEN qty ELSE 0 END), 0),
        2) AS rpu,
        COUNT(DISTINCT CASE WHEN is_cancelled=1 THEN order_id END) AS cancelled_tx,
        ROUND(
            COUNT(DISTINCT CASE WHEN is_cancelled=1 THEN order_id END) * 100.0
            / NULLIF(COUNT(DISTINCT order_id), 0),
        2) AS cancellation_rate
    FROM transactions
    GROUP BY year, month, day, brand, platform
  `);

  await runMigration002(db);
  await runMigration003(db);
}

/** Migration 002: retention support (customers table, identity columns, daily_retention view). */
async function runMigration002(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        platform            TEXT NOT NULL,
        brand               TEXT NOT NULL,
        customer_key        TEXT NOT NULL,
        match_tier          INTEGER,
        buyer_username      TEXT,
        phone               TEXT,
        recipient           TEXT,
        province            TEXT,
        regency_city        TEXT,
        first_order_id      TEXT NOT NULL,
        first_purchase_date TEXT NOT NULL,
        total_orders        INTEGER NOT NULL DEFAULT 1,
        UNIQUE(platform, brand, customer_key)
    )
  `);

  const txColumns = await db.select<{ name: string }[]>("PRAGMA table_info(transactions)");
  const existingCols = new Set(txColumns.map((c) => c.name));
  const NEW_TX_COLUMNS: [string, string][] = [
    ["customer_id", "INTEGER"],
    ["is_retention", "INTEGER NOT NULL DEFAULT 0"],
    ["buyer_username", "TEXT"],
    ["phone", "TEXT"],
    ["recipient", "TEXT"],
    ["province", "TEXT"],
    ["regency_city", "TEXT"],
  ];
  for (const [name, def] of NEW_TX_COLUMNS) {
    if (!existingCols.has(name)) {
      await db.execute(`ALTER TABLE transactions ADD COLUMN ${name} ${def}`);
    }
  }

  await db.execute(`
    CREATE VIEW IF NOT EXISTS daily_retention AS
    SELECT
        strftime('%Y', t.created_at) AS year,
        strftime('%m', t.created_at) AS month,
        strftime('%d', t.created_at) AS day,
        t.brand,
        t.platform,
        SUM(CASE WHEN t.is_retention=1 AND t.is_cancelled=0 THEN t.qty ELSE 0 END) AS retention_product_sold,
        COUNT(DISTINCT CASE WHEN t.is_retention=1 AND t.is_cancelled=0 THEN t.order_id END) AS retention_tx,
        COUNT(DISTINCT CASE WHEN t.is_cancelled=0 THEN t.order_id END) AS total_tx,
        ROUND(
            COUNT(DISTINCT CASE WHEN t.is_retention=1 AND t.is_cancelled=0 THEN t.order_id END) * 100.0
            / NULLIF(COUNT(DISTINCT CASE WHEN t.is_cancelled=0 THEN t.order_id END), 0)
        , 2) AS retention_rate,
        SUM(CASE WHEN t.is_retention=1 AND t.is_cancelled=0 THEN t.gmv_gross ELSE 0 END) AS retention_gmv,
        SUM(CASE WHEN t.is_retention=1 AND t.is_cancelled=0 THEN t.total_payment ELSE 0 END) AS retention_gmv_net,
        ROUND(
            SUM(CASE WHEN t.is_retention=1 AND t.is_cancelled=0 THEN t.gmv_gross ELSE 0 END)
            / NULLIF(COUNT(DISTINCT CASE WHEN t.is_retention=1 AND t.is_cancelled=0 THEN t.order_id END), 0)
        , 2) AS retention_aov,
        ROUND(
            SUM(CASE WHEN t.is_retention=1 AND t.is_cancelled=0 THEN t.gmv_gross ELSE 0 END)
            / NULLIF(SUM(CASE WHEN t.is_retention=1 AND t.is_cancelled=0 THEN t.qty ELSE 0 END), 0)
        , 2) AS retention_rpu
    FROM transactions t
    GROUP BY year, month, day, t.brand, t.platform
  `);
}

/**
 * Per-order source for the summary views. Shopee "Total Pembayaran" and TikTok
 * "Order Amount" are order-level values repeated on every SKU line of an
 * order, so summing them per line counted a 3-SKU order's payment 3 times
 * and made Net GMV larger than Gross. Each order (split by cancelled flag, in
 * case only some lines were cancelled) is collapsed to one row first.
 */
const ORDER_LEVEL_SOURCE = `
    SELECT
        brand,
        platform,
        order_id,
        is_cancelled,
        MIN(created_at)     AS created_at,
        SUM(qty)            AS qty,
        SUM(gmv_gross)      AS gmv_gross,
        MAX(total_payment)  AS total_payment,
        MAX(is_retention)   AS is_retention
    FROM transactions
    GROUP BY platform, order_id, is_cancelled
`;

/** Bumped whenever the summary views change; tracked in PRAGMA user_version. */
const VIEWS_VERSION = 3;

/** Migration 003: count Net GMV (order-level payment) once per order instead of once per SKU line. */
async function runMigration003(db: Database): Promise<void> {
  const [row] = await db.select<{ user_version: number }[]>("PRAGMA user_version");
  if ((row?.user_version ?? 0) >= VIEWS_VERSION) return;

  await db.execute("DROP VIEW IF EXISTS daily_summary");
  await db.execute(`
    CREATE VIEW daily_summary AS
    SELECT
        strftime('%Y', created_at) AS year,
        strftime('%m', created_at) AS month,
        strftime('%d', created_at) AS day,
        brand,
        platform,
        SUM(CASE WHEN is_cancelled=0 THEN qty ELSE 0 END) AS product_sold,
        COUNT(CASE WHEN is_cancelled=0 THEN 1 END) AS total_tx,
        SUM(CASE WHEN is_cancelled=0 THEN gmv_gross ELSE 0 END) AS gmv_gross,
        SUM(CASE WHEN is_cancelled=0 THEN total_payment ELSE 0 END) AS gmv_net,
        ROUND(
            SUM(CASE WHEN is_cancelled=0 THEN gmv_gross ELSE 0 END)
            / NULLIF(COUNT(CASE WHEN is_cancelled=0 THEN 1 END), 0),
        2) AS aov,
        ROUND(
            SUM(CASE WHEN is_cancelled=0 THEN gmv_gross ELSE 0 END)
            / NULLIF(SUM(CASE WHEN is_cancelled=0 THEN qty ELSE 0 END), 0),
        2) AS rpu,
        COUNT(CASE WHEN is_cancelled=1 THEN 1 END) AS cancelled_tx,
        ROUND(
            COUNT(CASE WHEN is_cancelled=1 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
        2) AS cancellation_rate
    FROM (${ORDER_LEVEL_SOURCE})
    GROUP BY year, month, day, brand, platform
  `);

  await db.execute("DROP VIEW IF EXISTS daily_retention");
  await db.execute(`
    CREATE VIEW daily_retention AS
    SELECT
        strftime('%Y', created_at) AS year,
        strftime('%m', created_at) AS month,
        strftime('%d', created_at) AS day,
        brand,
        platform,
        SUM(CASE WHEN is_retention=1 AND is_cancelled=0 THEN qty ELSE 0 END) AS retention_product_sold,
        COUNT(CASE WHEN is_retention=1 AND is_cancelled=0 THEN 1 END) AS retention_tx,
        COUNT(CASE WHEN is_cancelled=0 THEN 1 END) AS total_tx,
        ROUND(
            COUNT(CASE WHEN is_retention=1 AND is_cancelled=0 THEN 1 END) * 100.0
            / NULLIF(COUNT(CASE WHEN is_cancelled=0 THEN 1 END), 0)
        , 2) AS retention_rate,
        SUM(CASE WHEN is_retention=1 AND is_cancelled=0 THEN gmv_gross ELSE 0 END) AS retention_gmv,
        SUM(CASE WHEN is_retention=1 AND is_cancelled=0 THEN total_payment ELSE 0 END) AS retention_gmv_net,
        ROUND(
            SUM(CASE WHEN is_retention=1 AND is_cancelled=0 THEN gmv_gross ELSE 0 END)
            / NULLIF(COUNT(CASE WHEN is_retention=1 AND is_cancelled=0 THEN 1 END), 0)
        , 2) AS retention_aov,
        ROUND(
            SUM(CASE WHEN is_retention=1 AND is_cancelled=0 THEN gmv_gross ELSE 0 END)
            / NULLIF(SUM(CASE WHEN is_retention=1 AND is_cancelled=0 THEN qty ELSE 0 END), 0)
        , 2) AS retention_rpu
    FROM (${ORDER_LEVEL_SOURCE})
    GROUP BY year, month, day, brand, platform
  `);

  await db.execute(`PRAGMA user_version = ${VIEWS_VERSION}`);
}
