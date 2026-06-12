import { useCallback, useEffect, useState } from "react";
import { deleteImportBatch, getImportLogs } from "@/lib/db";
import type { ImportLogEntry } from "@/lib/types";

export function useImportHistory() {
  const [history, setHistory] = useState<ImportLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setHistory(await getImportLogs());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function deleteBatch(id: number) {
    await deleteImportBatch(id);
    await refresh();
  }

  return { history, isLoading, deleteBatch };
}
