import * as XLSX from "xlsx";
import { format } from "date-fns";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Download } from "lucide-react";
import { Button } from "@/components/selia/button";
import { formatDate } from "@/lib/formatters";
import type { BrandFilter, DailyRetentionRow } from "@/lib/types";

const HEADERS = ["Date", "Product Sold", "Total Transaction", "GMV Retention", "AOV", "RPU"];

interface RetentionExportButtonProps {
  rows: DailyRetentionRow[];
  brand: BrandFilter;
}

export function RetentionExportButton({ rows, brand }: RetentionExportButtonProps) {
  async function handleExport() {
    const body = rows.map((row) => [
      formatDate(row.date),
      row.product_sold,
      row.retention_tx,
      row.gmv,
      row.aov,
      row.rpu,
    ]);

    const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...body]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Daily Retention");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const brandLabel = brand === "All" ? "All Brands" : brand;
    const path = await save({
      defaultPath: `${brandLabel} Daily Retention - ${format(new Date(), "yyyy-MM-dd")}.xlsx`,
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
