import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/selia/table";
import { formatDate, formatNumber, formatRupiah } from "@/lib/formatters";
import type { DailyRetentionRow, RetentionTotals } from "@/lib/types";

interface RetentionTableProps {
  rows: DailyRetentionRow[];
  totals: RetentionTotals | null;
}

export function RetentionTable({ rows, totals }: RetentionTableProps) {
  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Product Sold</TableHead>
            <TableHead>Total Transaction</TableHead>
            <TableHead>GMV Retention</TableHead>
            <TableHead>AOV</TableHead>
            <TableHead>RPU</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.date}>
              <TableCell>{formatDate(row.date)}</TableCell>
              <TableCell>{formatNumber(row.product_sold)}</TableCell>
              <TableCell>{formatNumber(row.retention_tx)}</TableCell>
              <TableCell>{formatRupiah(row.gmv)}</TableCell>
              <TableCell>{formatRupiah(row.aov)}</TableCell>
              <TableCell>{formatRupiah(row.rpu)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter className="sticky bottom-0 text-sm">
          <TableRow className="bg-table-head font-semibold hover:bg-table-head">
            <TableCell>Total</TableCell>
            <TableCell>{formatNumber(totals?.retention_product_sold)}</TableCell>
            <TableCell>{formatNumber(totals?.retention_tx)}</TableCell>
            <TableCell>{formatRupiah(totals?.retention_gmv)}</TableCell>
            <TableCell>{formatRupiah(totals?.retention_aov)}</TableCell>
            <TableCell>{formatRupiah(totals?.retention_rpu)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>
  );
}
