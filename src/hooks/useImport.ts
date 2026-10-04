import { detectBrandFromRows, parseImportFile } from "@/lib/importer";
import {
  createImportLog,
  finalizeImportLog,
  getBatchCounts,
  getCustomerIdsByKeys,
  getCustomersForBrandPlatform,
  getExistingTxKeys,
  getLatestCreatedAt,
  incrementCustomerOrders,
  insertCustomers,
  insertTransactions,
  txKey,
} from "@/lib/db";
import { resolveCustomerBatch } from "@/lib/customerResolver";
import { useFilterStore } from "@/store/filterStore";
import { groupFiles, useImportStore } from "@/store/importStore";
import { useUiStore } from "@/store/uiStore";
import type { Brand, ResolvedTransaction, Transaction } from "@/lib/types";
import type { GroupResult, ImportGroup, ImportStep, UploadedFile } from "@/store/importStore";

export type {
  GroupResult,
  ImportGroup,
  ImportProgress,
  ImportStep,
  UploadedFile,
} from "@/store/importStore";

const CHUNK_SIZE = 500;
const ROWS_PER_SECOND = 2000;

/** Rough import duration estimate, used to show "~Ns to import". */
export function estimateImportSeconds(rows: number): number {
  return Math.ceil(rows / ROWS_PER_SECOND);
}

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

export function useImport() {
  const gmvMode = useFilterStore((s) => s.gmvMode);
  const store = useImportStore();
  const { step, files, errors, isParsing, parsingMessage, isImporting, progress, results, importError } = store;
  const groups = groupFiles(files);
  const needsBrand = files.filter((f) => !f.brand);

  /**
   * Parses each file and detects its platform (from columns) and brand (from
   * product names). Files of any platform or brand can be added together.
   */
  async function addFiles(paths: string[]) {
    const known = new Set(useImportStore.getState().files.map((f) => f.path));
    const fresh = paths.filter((p, i) => !known.has(p) && paths.indexOf(p) === i);
    const newErrors: string[] = [];
    for (const p of paths) {
      if (known.has(p)) newErrors.push(`"${fileName(p)}" is already in the list.`);
    }
    if (fresh.length === 0) {
      store.setErrors(newErrors);
      return;
    }

    const parsed: UploadedFile[] = [];
    store.setParsing(true, fresh.length > 1 ? `Reading file 1 of ${fresh.length}...` : "Reading file...");
    // Yield so the spinner paints before parsing begins.
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      for (let i = 0; i < fresh.length; i++) {
        const path = fresh[i];
        const name = fileName(path);
        if (fresh.length > 1) {
          store.setParsing(true, `Reading file ${i + 1} of ${fresh.length}...`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        try {
          // Parsed entirely by the Rust backend (calamine) so the WebView's
          // XLSX/File APIs, which hang on large files, are never involved.
          const parsedFile = await parseImportFile(path);
          if (parsedFile.transactions.length === 0) {
            newErrors.push(`"${name}": no valid order rows found.`);
            continue;
          }
          // Both marketplaces name every shop's export identically, so two
          // brands' files are easily swapped. The brand therefore always
          // comes from the products in the file, never from a manual pick.
          const detection = detectBrandFromRows(parsedFile.transactions);
          if (detection.status === "mixed") {
            const share = Math.round(detection.dominance * 100);
            newErrors.push(
              `"${name}" mixes Amura and Reglow products (largest brand only ${share}% of ${detection.brandedRows.toLocaleString("id-ID")} branded rows). File rejected: export each shop separately.`,
            );
            continue;
          }
          parsed.push({ path, name, parsed: parsedFile, detection, brand: detection.brand });
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          newErrors.push(`"${name}": ${reason}`);
        }
      }
    } finally {
      store.setParsing(false);
    }

    store.setErrors(newErrors);
    if (parsed.length > 0) store.setFiles((prev) => [...prev, ...parsed]);
  }

  function removeFile(path: string) {
    store.setFiles((prev) => prev.filter((f) => f.path !== path));
  }

  /** Brand for a file whose products didn't identify it. */
  function assignBrand(path: string, brand: Brand) {
    store.setFiles((prev) => prev.map((f) => (f.path === path && f.detection.status === "unknown" ? { ...f, brand } : f)));
  }

  /** Step indicator lets the user jump back to any already-completed step. */
  function goToStep(target: ImportStep) {
    if (isImporting || step === 3) return;
    if (target < step) store.setStep(target);
  }

  const canContinue = (step === 1 && files.length > 0 && needsBrand.length === 0 && !isParsing) || step === 2;

  function goNext() {
    if (!canContinue) return;
    if (step === 1) store.setStep(2);
    else if (step === 2) startImport();
  }

  function goBack() {
    if (step === 2) store.setStep(1);
  }

  function reset() {
    store.reset();
  }

  async function importGroup(
    group: ImportGroup,
    totals: { offset: number; total: number },
  ): Promise<GroupResult> {
    const { brand, platform } = group;
    const allTransactions: Transaction[] = group.files.flatMap((f) =>
      f.parsed.transactions.map((row) => ({ ...row, brand })),
    );
    const parseSkipped = group.files.reduce((sum, f) => sum + f.parsed.skippedRows, 0);
    const total = allTransactions.length;
    const filenames = group.files.map((f) => f.name);
    const groupLabel = `${brand} · ${platform}`;
    const result: GroupResult = {
      key: group.key,
      brand,
      platform,
      filenames,
      rowsImported: 0,
      duplicatesSkipped: 0,
      cancelledFlagged: 0,
      olderThanExisting: false,
      error: null,
    };

    const batchId = await createImportLog({
      brand,
      platform,
      filename: filenames.join(", "),
      source_type: group.sourceType,
      gmv_mode: gmvMode,
    });

    let inserted = 0;
    let dupSkipped = 0;
    let cancelledSeen = 0;
    let lastCurrent = 0;
    try {
      // --- Customer resolution (in-memory, before any insert) ---
      // Rows already present in the DB (re-imported file) or duplicated
      // within this import are excluded from resolution so they don't
      // double-count total_orders or flip is_retention on already-resolved
      // customers. They're still passed through insertTransactions below,
      // whose upsert only refreshes their lifecycle fields.
      const existingTxKeys = await getExistingTxKeys(platform, brand);
      const seenKeys = new Set<string>();
      const resolvableRows: Transaction[] = [];
      for (const row of allTransactions) {
        const key = txKey(row.order_id, row.sku);
        if (existingTxKeys.has(key) || seenKeys.has(key)) continue;
        seenKeys.add(key);
        resolvableRows.push(row);
      }

      // Incremental resolution only sees customers from earlier data. New
      // orders dated before the latest stored order (a backfill) can turn an
      // already-counted first purchase into a repeat one, which only a full
      // re-resolution fixes.
      const latestStored = await getLatestCreatedAt(brand, platform);
      result.olderThanExisting =
        latestStored !== null && resolvableRows.some((row) => row.created_at < latestStored);

      const existingCustomers = await getCustomersForBrandPlatform(brand, platform);
      const { resolved, newCustomers, existingIncrements } = resolveCustomerBatch(
        resolvableRows,
        platform,
        existingCustomers,
      );

      await insertCustomers(newCustomers, brand, platform);
      await incrementCustomerOrders(
        [...existingIncrements.entries()].map(([id, increment]) => ({ id, increment })),
      );

      const newCustomerIds = await getCustomerIdsByKeys(
        brand,
        platform,
        newCustomers.map((c) => c.customer_key),
      );
      const customerIdByKey = new Map<string, number>();
      for (const c of existingCustomers) customerIdByKey.set(c.customer_key, c.id);
      for (const [key, id] of newCustomerIds) customerIdByKey.set(key, id);

      const resolutionByTxKey = new Map<string, { customer_id: number; is_retention: 0 | 1 }>();
      resolvableRows.forEach((row, i) => {
        const r = resolved[i];
        const customerId = customerIdByKey.get(r.customer_key);
        if (customerId === undefined) {
          throw new Error(`Customer resolution produced no id for key ${r.customer_key}`);
        }
        resolutionByTxKey.set(txKey(row.order_id, row.sku), {
          customer_id: customerId,
          is_retention: r.is_retention,
        });
      });

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = allTransactions.slice(i, i + CHUNK_SIZE);
        const resolvedChunk: ResolvedTransaction[] = chunk.map((row) => {
          const r = resolutionByTxKey.get(txKey(row.order_id, row.sku));
          return { ...row, customer_id: r?.customer_id ?? 0, is_retention: r?.is_retention ?? 0 };
        });
        const res = await insertTransactions(resolvedChunk, batchId);
        inserted += res.inserted;
        dupSkipped += res.skipped;
        cancelledSeen += chunk.reduce((n, r) => n + r.is_cancelled, 0);
        lastCurrent = Math.min(i + CHUNK_SIZE, total);
        store.setProgress({
          current: totals.offset + lastCurrent,
          total: totals.total,
          inserted,
          skipped: dupSkipped + parseSkipped,
          cancelled: cancelledSeen,
          groupLabel,
        });
        // Yield to the browser event loop so the progress bar repaints between chunks.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      result.error = `Stopped after ${lastCurrent.toLocaleString("id-ID")} of ${total.toLocaleString("id-ID")} rows: ${reason}`;
    }

    const counts = await getBatchCounts(batchId);
    const finalSkipped = total - counts.inserted + parseSkipped;
    await finalizeImportLog(batchId, filenames.join(", "), {
      row_count: counts.inserted,
      skipped_count: finalSkipped,
      cancelled_count: counts.cancelled,
    });

    result.rowsImported = counts.inserted;
    result.duplicatesSkipped = finalSkipped;
    result.cancelledFlagged = counts.cancelled;
    return result;
  }

  async function startImport() {
    const toImport = groupFiles(useImportStore.getState().files);
    if (toImport.length === 0) return;
    store.setStep(3);
    store.setIsImporting(true);
    store.setImportError(null);
    store.setResults(null);

    const total = toImport.reduce(
      (sum, g) => sum + g.files.reduce((n, f) => n + f.parsed.transactions.length, 0),
      0,
    );
    const done: GroupResult[] = [];
    let offset = 0;
    try {
      for (const group of toImport) {
        const groupResult = await importGroup(group, { offset, total });
        done.push(groupResult);
        if (groupResult.olderThanExisting) useUiStore.getState().setResolutionStale(true);
        offset += group.files.reduce((n, f) => n + f.parsed.transactions.length, 0);
      }
    } catch (err) {
      store.setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      store.setResults(done);
      store.setIsImporting(false);
    }
  }

  return {
    step,
    files,
    groups,
    needsBrand,
    errors,
    isParsing,
    parsingMessage,
    isImporting,
    progress,
    results,
    importError,
    canContinue,
    addFiles,
    removeFile,
    assignBrand,
    goToStep,
    goNext,
    goBack,
    reset,
  };
}

export type UseImportReturn = ReturnType<typeof useImport>;
