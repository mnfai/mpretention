# Fix: "Invalid time value" Error During TikTok Fresh Export Import

## Problem

When importing TikTok fresh export file, app crashes with:
```
Unexpected Application Error!
Invalid time value
```

This happens because some rows in the TikTok export have empty, null, or
unparseable `Created Time` values. The `normalizeDate()` function returns
an invalid string for these rows, and somewhere downstream a `new Date()`
call throws "Invalid time value".

## Fix Instructions

### 1. Harden `normalizeDate` in `src/lib/dateNormalizer.ts`

If the raw value cannot be parsed into a valid date, return a fallback
instead of an invalid string:

```typescript
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
```

### 2. Find and wrap any `new Date()` calls that use `created_at`

Search for all places in `src/` that call `new Date()` on a transaction
date or `created_at` value, and wrap them in try/catch or add validity
check:

```bash
grep -rn "new Date" src/ --include="*.ts" --include="*.tsx"
```

For each occurrence that uses a date from transactions or import data,
wrap like this:

```typescript
// Before
const d = new Date(someDate);

// After
const d = new Date(someDate);
if (isNaN(d.getTime())) continue; // or skip/use fallback
```

### 3. Also check `src/lib/importer.ts`

If there is any date validation or formatting after `normalizeDate()` call,
add a guard:

```typescript
const created_at = normalizeDate(row[columnMap.created_at], profile.platform);
// Skip rows with fallback date if needed, or just let them import
```

## Verification

1. Apply fixes
2. `npx tsc --noEmit` — must pass
3. Build: `npm run tauri build`
4. Install new .deb
5. Reset DB → reimport Amura TikTok fresh export → must complete without error
6. Check DB:
```bash
sqlite3 ~/.config/com.sinergigroup.mpretention/mpretention.db \
"SELECT substr(created_at,1,10) as date, COUNT(*) FROM transactions WHERE platform='TikTokShop' AND brand='Amura' AND created_at LIKE '2026-06%' GROUP BY date ORDER BY date;"
```
Expected: 07, 08, 09 Jun muncul.

## Version Bump
`src-tauri/tauri.conf.json`: `1.0.4` → `1.0.5`
`package.json`: `1.0.4` → `1.0.5`
