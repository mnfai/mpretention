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
import { formatDate, formatNumber, formatPercent, formatRupiah } from "@/lib/formatters";
import type { DailySummaryRow, SummaryRow } from "@/lib/types";

interface SummaryTableProps {
  rows: DailySummaryRow[];
  totals: SummaryRow | null;
}

export function SummaryTable({ rows, totals }: SummaryTableProps) {
  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Product Sold</TableHead>
            <TableHead>Total TX</TableHead>
            <TableHead>GMV</TableHead>
            <TableHead>AOV</TableHead>
            <TableHead>RPU</TableHead>
            <TableHead>Cancelled TX</TableHead>
            <TableHead>Cancellation Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.date}>
              <TableCell>{formatDate(row.date)}</TableCell>
              <TableCell>{formatNumber(row.product_sold)}</TableCell>
              <TableCell>{formatNumber(row.total_tx)}</TableCell>
              <TableCell>{formatRupiah(row.gmv)}</TableCell>
              <TableCell>{formatRupiah(row.aov)}</TableCell>
              <TableCell>{formatRupiah(row.rpu)}</TableCell>
              <TableCell>{formatNumber(row.cancelled_tx)}</TableCell>
              <TableCell>{formatPercent(row.cancellation_rate)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter className="sticky bottom-0 text-sm">
          <TableRow className="bg-table-head font-semibold hover:bg-table-head">
            <TableCell>Total</TableCell>
            <TableCell>{formatNumber(totals?.product_sold)}</TableCell>
            <TableCell>{formatNumber(totals?.total_tx)}</TableCell>
            <TableCell>{formatRupiah(totals?.gmv)}</TableCell>
            <TableCell>{formatRupiah(totals?.aov)}</TableCell>
            <TableCell>{formatRupiah(totals?.rpu)}</TableCell>
            <TableCell>{formatNumber(totals?.cancelled_tx)}</TableCell>
            <TableCell>{formatPercent(totals?.cancellation_rate)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>
  );
}
