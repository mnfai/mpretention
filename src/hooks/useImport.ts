import { parseImportFile } from "@/lib/importer";
import {
  createImportLog,
  finalizeImportLog,
  getBatchCounts,
  getCustomerIdsByKeys,
  getCustomersForBrandPlatform,
  getExistingTxKeys,
  incrementCustomerOrders,
  insertCustomers,
  insertTransactions,
  txKey,
} from "@/lib/db";
import { resolveCustomerBatch } from "@/lib/customerResolver";
import { useFilterStore } from "@/store/filterStore";
import { useImportStore } from "@/store/importStore";
import type { Brand, Platform, ResolvedTransaction } from "@/lib/types";
import type { ImportStep, UploadedFile } from "@/store/importStore";

export type { ImportStep, ImportProgress, ImportResult, UploadedFile } from "@/store/importStore";

const CHUNK_SIZE = 500;
const ROWS_PER_SECOND = 2000;

/** Rough import duration estimate, used by Step2 to show "~Ns to import". */
export function estimateImportSeconds(rows: number): number {
  return Math.ceil(rows / ROWS_PER_SECOND);
}

export function useImport() {
  const gmvMode = useFilterStore((s) => s.gmvMode);
  const store = useImportStore();
  const {
    step,
    brand,
    platform,
    files,
    error,
    isParsing,
    parsingMessage,
    isImporting,
    progress,
    result,
    importError,
  } = store;

  function selectBrand(value: Brand) {
    store.setBrand(value);
  }

  function selectPlatform(value: Platform) {
    store.setPlatform(value);
    store.setFiles([]);
    store.setError(null);
  }

  async function addFiles(paths: string[]) {
    if (!brand || !platform) return;
    store.setError(null);

    const parsed: UploadedFile[] = [];

    store.setParsing(true, paths.length > 1 ? `Reading file 1 of ${paths.length}...` : "Reading file...");
    // Yield so the spinner paints before the (synchronous) XLSX parse begins.
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        const name = path.split(/[\\/]/).pop() ?? path;
        if (paths.length > 1) {
          store.setParsing(true, `Reading file ${i + 1} of ${paths.length}...`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        try {
          // Parsed entirely by the Rust backend (calamine) so the WebView's
          // XLSX/File APIs, which hang on large files, are never involved.
          const file = new File([], name);
          const parsedFile = await parseImportFile(path, brand);
          if (parsedFile.profile.platform !== platform) {
            store.setError(
              `"${name}" looks like a ${parsedFile.profile.platform} file, but ${platform} is selected.`,
            );
            continue;
          }
          parsed.push({ file, parsed: parsedFile });
        } catch {
          store.setError(`"${name}": File format not recognized.`);
        }
      }
    } finally {
      store.setParsing(false);
    }

    if (parsed.length === 0) return;

    store.setFiles((prev) => (platform === "Shopee" ? [...prev, ...parsed] : [parsed[0]]));
  }

  function removeFile(index: number) {
    store.setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  /** Step indicator lets the user jump back to any already-completed step. */
  function goToStep(target: ImportStep) {
    if (isImporting) return;
    if (target < step) store.setStep(target);
  }

  function goNext() {
    if (step === 1 && brand && platform) store.setStep(2);
    else if (step === 2 && files.length > 0 && !isParsing) store.setStep(3);
    else if (step === 3) startImport();
  }

  function goBack() {
    if (step === 2) store.setStep(1);
    else if (step === 3) store.setStep(2);
  }

  function reset() {
    store.reset();
  }

  async function startImport() {
    if (!brand || !platform || files.length === 0) return;
    store.setStep(4);
    store.setIsImporting(true);
    store.setImportError(null);

    const allTransactions = files.flatMap((f) => f.parsed.transactions);
    const parseSkipped = files.reduce((sum, f) => sum + f.parsed.skippedRows, 0);
    const total = allTransactions.length;
    const filenames = files.map((f) => f.file.name).join(", ");

    try {
      const batchId = await createImportLog({
        brand,
        platform,
        filename: filenames,
        source_type: files[0].parsed.profile.sourceType,
        gmv_mode: gmvMode,
      });

      // --- Customer resolution (in-memory, before any insert) ---
      // Rows already present in the DB (re-imported file) or duplicated
      // within this import are excluded from resolution so they don't
      // double-count total_orders or flip is_retention on already-resolved
      // customers. They're still passed through insertTransactions below,
      // where INSERT OR IGNORE skips them at the DB level as before.
      const existingTxKeys = await getExistingTxKeys(platform, brand);
      const seenKeys = new Set<string>();
      const resolvableRows: typeof allTransactions = [];
      for (const row of allTransactions) {
        const key = txKey(row.order_id, row.sku);
        if (existingTxKeys.has(key) || seenKeys.has(key)) continue;
        seenKeys.add(key);
        resolvableRows.push(row);
      }

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

      let inserted = 0;
      let dupSkipped = 0;
      let cancelledSeen = 0;
      let lastCurrent = 0;
      let loopError: unknown = null;

      store.setProgress({ current: 0, total, inserted: 0, skipped: 0, cancelled: 0 });
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = allTransactions.slice(i, i + CHUNK_SIZE);
        try {
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
            current: lastCurrent,
            total,
            inserted,
            skipped: dupSkipped + parseSkipped,
            cancelled: cancelledSeen,
          });
          // Yield to the browser event loop so the progress bar repaints between chunks.
          await new Promise((resolve) => setTimeout(resolve, 0));
        } catch (err) {
          loopError = err;
          break;
        }
      }

      const counts = await getBatchCounts(batchId);
      const finalSkipped = total - counts.inserted + parseSkipped;

      await finalizeImportLog(batchId, filenames, {
        row_count: counts.inserted,
        skipped_count: finalSkipped,
        cancelled_count: counts.cancelled,
      });

      if (loopError) {
        store.setImportError(
          `Import stopped after ${lastCurrent.toLocaleString("id-ID")} of ${total.toLocaleString("id-ID")} rows: ${
            loopError instanceof Error ? loopError.message : String(loopError)
          }`,
        );
      }

      store.setResult({
        rowsImported: counts.inserted,
        duplicatesSkipped: finalSkipped,
        cancelledFlagged: counts.cancelled,
      });
    } catch (err) {
      store.setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      store.setIsImporting(false);
    }
  }

  return {
    step,
    brand,
    platform,
    files,
    error,
    isParsing,
    parsingMessage,
    isImporting,
    progress,
    result,
    importError,
    selectBrand,
    selectPlatform,
    addFiles,
    removeFile,
    goToStep,
    goNext,
    goBack,
    reset,
  };
}

export type UseImportReturn = ReturnType<typeof useImport>;
