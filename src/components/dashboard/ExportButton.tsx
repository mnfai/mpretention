import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Download } from "lucide-react";
import { Button } from "@/components/selia/button";
import { formatDate } from "@/lib/formatters";
import type { DailySummaryRow } from "@/lib/types";

const HEADERS = [
  "Date",
  "Product Sold",
  "Total TX",
  "GMV",
  "AOV",
  "RPU",
  "Cancelled TX",
  "Cancellation Rate (%)",
];

interface ExportButtonProps {
  rows: DailySummaryRow[];
}

export function ExportButton({ rows }: ExportButtonProps) {
  async function handleExport() {
    const body = rows.map((row) => [
      formatDate(row.date),
      row.product_sold,
      row.total_tx,
      row.gmv,
      row.aov,
      row.rpu,
      row.cancelled_tx,
      row.cancellation_rate,
    ]);

    const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...body]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Daily Summary");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const path = await save({
      defaultPath: "daily-summary.xlsx",
      filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
    });
    if (!path) return;

    await writeFile(path, new Uint8Array(buffer));
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download />
      Export
    </Button>
  );
}
