# Fix: TikTok Order ID Validation Too Strict

## Problem

In `src/lib/importer.ts`, there is a validation that skips TikTok rows where
`order_id` is not purely numeric:

```typescript
if (profile.platform === "TikTokShop" && !/^\d+$/.test(orderId)) {
  skippedRows++;
  continue;
}
```

This causes rows with non-numeric order IDs (e.g. alphanumeric format) to be
silently skipped during import. Confirmed symptom: dates 07–09 Jun 2026 missing
from DB after importing fresh TikTok export, even though the rows exist in the
file.

## Root Cause

TikTok order IDs are not always purely numeric. Some order IDs may contain
letters or other characters. The strict `/^\d+$/` regex rejects these rows.

## Fix

File: `src/lib/importer.ts`

Replace the strict numeric check with a looser validation — just check that
order_id is not empty and has reasonable length (≥5 chars):

**Before:**
```typescript
if (profile.platform === "TikTokShop" && !/^\d+$/.test(orderId)) {
  skippedRows++;
  continue;
}
```

**After:**
```typescript
if (profile.platform === "TikTokShop" && orderId.length < 5) {
  skippedRows++;
  continue;
}
```

This keeps protection against garbage/empty order IDs while allowing any
alphanumeric format TikTok might use.

## Verification Steps

1. Apply the fix to `src/lib/importer.ts`
2. Run `npx tsc --noEmit` — must pass with no errors
3. Build: `npm run tauri build`
4. Install .deb and test:
   - Reset DB (Settings → Danger Zone → Reset DB)
   - Re-import Amura TikTok existing DB file
   - Re-import Amura TikTok fresh export
   - Check: dates 07, 08, 09 Jun must appear in Retention table
5. Confirm in DB:
```bash
sqlite3 ~/.config/com.sinergigroup.mpretention/mpretention.db \
"SELECT substr(created_at,1,10) as date, COUNT(*) FROM transactions WHERE platform='TikTokShop' AND brand='Amura' AND created_at LIKE '2026-06%' GROUP BY date ORDER BY date;"
```
Expected: 07, 08, 09 Jun muncul dengan row count > 0.

## Version Bump
`src-tauri/tauri.conf.json`: bump version `1.0.3` → `1.0.4`
`package.json`: bump version `1.0.3` → `1.0.4`
