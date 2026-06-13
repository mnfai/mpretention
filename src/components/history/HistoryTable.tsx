import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/selia/badge";
import { Button } from "@/components/selia/button";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/selia/table";
import { formatDate, formatNumber } from "@/lib/formatters";
import { DeleteBatchModal } from "./DeleteBatchModal";
import type { ImportLogEntry } from "@/lib/types";

const BRAND_BADGE_CLASS: Record<string, string> = {
  Amura: "bg-violet-500/15 text-violet-600",
  Reglow: "bg-pink-500/15 text-pink-600",
};

const PLATFORM_BADGE_CLASS: Record<string, string> = {
  Shopee: "bg-orange-500/15 text-orange-600",
  TikTokShop: "bg-teal-500/15 text-teal-600",
};

interface HistoryTableProps {
  history: ImportLogEntry[];
  onDelete: (id: number) => void;
}

export function HistoryTable({ history, onDelete }: HistoryTableProps) {
  const [pendingDelete, setPendingDelete] = useState<ImportLogEntry | null>(null);

  return (
    <>
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Source Type</TableHead>
              <TableHead>Filename(s)</TableHead>
              <TableHead>Rows</TableHead>
              <TableHead>Skipped</TableHead>
              <TableHead>Cancelled</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((entry) => {
              const filenames = entry.filename.split(", ");
              return (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.imported_at)}</TableCell>
                  <TableCell>
                    <Badge className={BRAND_BADGE_CLASS[entry.brand]}>{entry.brand}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={PLATFORM_BADGE_CLASS[entry.platform]}>{entry.platform}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.source_type === "existing_db" ? "secondary" : "info"}>
                      {entry.source_type === "existing_db" ? "Existing DB" : "Export"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {filenames[0]}
                    {filenames.length > 1 && (
                      <span className="text-muted"> +{filenames.length - 1} more</span>
                    )}
                  </TableCell>
                  <TableCell>{formatNumber(entry.row_count)}</TableCell>
                  <TableCell>{formatNumber(entry.skipped_count)}</TableCell>
                  <TableCell>{formatNumber(entry.cancelled_count)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm-icon" onClick={() => setPendingDelete(entry)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <DeleteBatchModal entry={pendingDelete} onClose={() => setPendingDelete(null)} onConfirm={onDelete} />
    </>
  );
}
