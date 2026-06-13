# MPRetention — PRD Addendum: Retention Feature
**Version:** 1.0  
**Company:** Sinergi Group  
**Last Updated:** June 2026  

---

## 1. Overview

Retention feature adalah halaman baru di MPRetention yang menghitung dan menampilkan metrik **repeat purchase** per brand dan platform. Halaman ini terpisah dari Dashboard existing (Overview) yang tetap menampilkan semua transaksi.

---

## 2. Definisi Retention

- **First Purchase:** Transaksi pertama kali seorang customer membeli suatu brand di suatu platform — dihitung dari seluruh history di DB.
- **Retention Purchase:** Transaksi kedua dan seterusnya dari customer yang sama, brand yang sama, platform yang sama.
- **Scope:** Per brand + per platform. Tidak ada cross-brand retention, tidak ada cross-platform retention.

**Contoh:**
- Customer A beli Amura di Shopee tgl 1 Juni → First Purchase
- Customer A beli Amura di Shopee tgl 2 Juli → Retention Purchase ✅
- Customer A beli Amura di TikTok tgl 5 Juli → First Purchase (platform berbeda) ✅
- Customer A beli Reglow di Shopee tgl 10 Juli → First Purchase (brand berbeda) ✅

---

## 3. Customer Identity — Matching Logic

### 3.1 Shopee
- **Identifier:** `Username Pembeli` (exact match)
- **Confidence:** HIGH — Shopee username adalah unique per akun, tidak ada kasus satu username dua orang berbeda.
- **Logic:** `customer_key = platform + brand + username_pembeli`

### 3.2 TikTokShop
TikTok menyensor sebagian besar kolom identitas. Matching menggunakan hierarki berikut:

#### Tier 1 — Buyer Username exact match (HIGH confidence)
```
buyer_username exact string match
Contoh: "m***ahgrace122" == "m***ahgrace122" → same user ✅
```

#### Tier 2 — Phone # exact match (HIGH confidence)
```
phone exact string match
Contoh: "(+62)821******24" == "(+62)821******24" → same user ✅
```

#### Tier 3 — Composite match (MEDIUM confidence)
```
Recipient exact match
AND Province exact match  
AND Regency and City exact match
→ same user ✅
```

#### Tier 4 — Fallback: No match
```
Jika tidak ada satupun Tier 1–3 yang match → dianggap customer baru
```

**Matching Priority:**
- Gunakan Tier 1 dulu. Jika Buyer Username kosong/null → coba Tier 2. Jika Phone kosong/null → coba Tier 3. Jika semua gagal → Tier 4.
- `customer_key` untuk TikTok disimpan sebagai canonical identifier dari Tier tertinggi yang berhasil match.

### 3.3 Customer Key Storage
Tambah tabel baru `customers` di SQLite:

```sql
CREATE TABLE IF NOT EXISTS customers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    platform        TEXT NOT NULL,        -- 'shopee' | 'tiktok'
    brand           TEXT NOT NULL,        -- 'Amura' | 'Reglow'
    customer_key    TEXT NOT NULL,        -- canonical identifier
    buyer_username  TEXT,
    phone           TEXT,
    recipient       TEXT,
    province        TEXT,
    regency_city    TEXT,
    first_order_id  TEXT NOT NULL,
    first_purchase_date TEXT NOT NULL,
    total_orders    INTEGER DEFAULT 1,
    UNIQUE(platform, brand, customer_key)
);
```

Tambah kolom `customer_id` dan `is_retention` ke tabel `transactions`:
```sql
ALTER TABLE transactions ADD COLUMN customer_id INTEGER REFERENCES customers(id);
ALTER TABLE transactions ADD COLUMN is_retention INTEGER NOT NULL DEFAULT 0;
```

**`is_retention` logic saat import:**
- Cari customer yang match di tabel `customers` (same platform + brand + customer_key)
- Jika tidak ditemukan → insert customer baru → `is_retention = 0` (First Purchase)
- Jika ditemukan → `is_retention = 1` (Retention Purchase) → update `customers.total_orders += 1`

---

## 4. Import Enhancement

Saat import berjalan (existing import flow), tambahkan step customer resolution setelah row parsing:

### Kolom tambahan yang perlu di-extract saat import:

**Shopee — tambah kolom:**
| Internal Field | Column Name |
|---|---|
| buyer_username | `Username (Pembeli)` |
| phone | *(tidak ada di Shopee export)* |
| recipient | *(tidak ada di Shopee export)* |
| province | *(tidak ada di Shopee export)* |
| regency_city | *(tidak ada di Shopee export)* |

**TikTokShop — tambah kolom:**
| Internal Field | Column Name |
|---|---|
| buyer_username | `Buyer Username` |
| phone | `Phone #` |
| recipient | `Recipient` |
| province | `Province` |
| regency_city | `Regency and City` |

### Customer Resolution Flow (per row, during import):
```
1. Extract identity fields from row
2. Build customer_key:
   - Shopee: buyer_username
   - TikTok Tier 1: buyer_username (if not empty)
   - TikTok Tier 2: phone (if buyer_username empty)
   - TikTok Tier 3: recipient + '|' + province + '|' + regency_city
3. Lookup: SELECT id FROM customers WHERE platform=? AND brand=? AND customer_key=?
4. If not found:
   - INSERT INTO customers → get new id
   - is_retention = 0
5. If found:
   - is_retention = 1
   - UPDATE customers SET total_orders = total_orders + 1
6. UPDATE transactions SET customer_id=?, is_retention=? WHERE id=?
```

---

## 5. Retention Dashboard — New Page

### 5.1 Sidebar
Tambah menu baru di sidebar:
```
Dashboard        ← existing (rename jadi "Overview")
Retention        ← NEW
Import Data
Import History
Settings
```

### 5.2 Filter Bar
| Filter | Options | Default |
|---|---|---|
| Brand | All / Amura / Reglow | All |
| Platform | All / Shopee / TikTokShop | All |
| GMV Mode | Gross / Net | Gross |
| Date Range | From–To | Current month |

**Catatan:** Ketika Brand = Amura dan Platform = All → data Shopee + TikTok digabung. Ketika Platform = Shopee → hanya Shopee.

### 5.3 Summary Metric Cards (4 cards, retention transactions only)
| Card | Formula |
|---|---|
| Retention GMV | `SUM(gmv_gross)` where `is_retention=1 AND is_cancelled=0` |
| Retention Transactions | `COUNT(DISTINCT order_id)` where `is_retention=1 AND is_cancelled=0` |
| Retention Rate % | `Retention TX / Total TX × 100` |
| Retention AOV | `Retention GMV / Retention TX` |

### 5.4 Daily Retention Table
Default view: **retention transactions only**.

| Column | Formula |
|---|---|
| Date | Calendar day |
| Product Sold | `SUM(qty)` where `is_retention=1 AND is_cancelled=0` |
| Total Transaction | `COUNT(DISTINCT order_id)` where `is_retention=1 AND is_cancelled=0` |
| GMV Retention | `SUM(gmv_gross)` where `is_retention=1 AND is_cancelled=0` |
| AOV | `GMV Retention / Total Transaction` |
| RPU | `GMV Retention / Product Sold` |

**Table Rules:**
- Same rules as Overview dashboard: days with no data → `—`
- Sticky footer: totals/averages
- Currency: `Rp 54.545.870`
- Empty cells: `—` never `0`

**Export:** current filtered view as `.xlsx`

---

## 6. SQLite — Additional View

```sql
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
GROUP BY year, month, day, t.brand, t.platform;
```

---

## 7. File Structure Additions

```
src/
  components/
    retention/
      RetentionFilterBar.tsx
      RetentionMetricCard.tsx
      RetentionTable.tsx
      RetentionExportButton.tsx
  hooks/
    useRetention.ts
  pages/
    RetentionPage.tsx
  lib/
    customerResolver.ts    ← NEW: customer matching logic
```

---

## 8. Migration

Tambah migration baru (setelah existing migrations):

```sql
-- Migration 002: Add retention support
CREATE TABLE IF NOT EXISTS customers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    platform        TEXT NOT NULL,
    brand           TEXT NOT NULL,
    customer_key    TEXT NOT NULL,
    buyer_username  TEXT,
    phone           TEXT,
    recipient       TEXT,
    province        TEXT,
    regency_city    TEXT,
    first_order_id  TEXT NOT NULL,
    first_purchase_date TEXT NOT NULL,
    total_orders    INTEGER DEFAULT 1,
    UNIQUE(platform, brand, customer_key)
);

ALTER TABLE transactions ADD COLUMN customer_id INTEGER REFERENCES customers(id);
ALTER TABLE transactions ADD COLUMN is_retention INTEGER NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN buyer_username TEXT;
ALTER TABLE transactions ADD COLUMN phone TEXT;
ALTER TABLE transactions ADD COLUMN recipient TEXT;
ALTER TABLE transactions ADD COLUMN province TEXT;
ALTER TABLE transactions ADD COLUMN regency_city TEXT;
```

**PENTING:** Setelah migration, existing transactions (yang sudah di-import sebelumnya) perlu di-resolve ulang:
- Jalankan customer resolution pass pada semua existing transactions
- Update `is_retention` dan `customer_id` untuk semua rows yang sudah ada
- Tampilkan progress di Settings page: "Re-resolve X of Y transactions"

---

## 9. Settings — Tambahan

Tambah card baru di Settings:

**Customer Data Card:**
- Total unique customers (Shopee + TikTok)
- Total retention transactions
- Button: **"Re-run Customer Resolution"** — untuk re-process semua transactions jika matching logic diupdate

---

## 10. Acceptance Criteria

- [ ] Import baru otomatis resolve customer & set `is_retention`
- [ ] Existing transactions ter-resolve setelah migration
- [ ] Shopee: username match 100% akurat
- [ ] TikTok: Tier 1 (username) match bekerja untuk kasus seperti `m***ahgrace122`
- [ ] TikTok: Tier 2 (phone) bekerja sebagai fallback
- [ ] TikTok: Tier 3 (composite) bekerja sebagai fallback
- [ ] Retention page muncul di sidebar
- [ ] Filter Brand = All + Platform = All → gabungan semua
- [ ] Filter Brand = Amura + Platform = All → Shopee Amura + TikTok Amura digabung
- [ ] Filter Brand = Amura + Platform = Shopee → hanya Shopee Amura
- [ ] Tabel harian menampilkan kolom: Date, Product Sold, Total TX, GMV Retention, AOV, RPU
- [ ] Days tanpa retention → semua sel `—`
- [ ] Export `.xlsx` bekerja untuk retention view
- [ ] Settings → Re-run Customer Resolution bekerja

---

## 11. Important Notes

- **Cancelled orders tidak dihitung** dalam retention metrics (`is_cancelled=0` always)
- **`is_retention` ditetapkan berdasarkan urutan tanggal** — order pertama = 0, semua order berikutnya = 1, regardless kapan data di-import
- **TikTok matching bersifat probabilistic** untuk Tier 3 — dokumentasikan di UI bahwa Tier 3 adalah "estimated match"
- **Re-import file yang sama** tidak mengubah `is_retention` yang sudah ada (idempotent)
