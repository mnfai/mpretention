import { Badge } from "@/components/selia/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/selia/table";
import { cn } from "@/lib/utils";
import { getColumnMapping } from "@/lib/importer";
import { formatDate, formatRupiah } from "@/lib/formatters";
import type { ImportGroup } from "@/hooks/useImport";
import { BRAND_STYLE } from "./brandStyles";
import { fileNotes } from "./Step1Upload";

const FIELD_LABELS: Record<string, string> = {
  order_id: "Order ID",
  order_status: "Order Status",
  created_at: "Created At",
  sku: "SKU",
  product_name: "Product Name",
  variation: "Variation",
  qty: "Quantity",
  price_original: "Price (Original)",
  price_after_disc: "Price (After Discount)",
  gmv_gross: "GMV (Gross)",
  total_payment: "Total Payment (Net)",
  warehouse: "Warehouse",
  buyer_username: "Buyer Username",
  phone: "Phone Number",
  recipient: "Recipient",
  province: "Province",
  regency_city: "Regency/City",
};

function groupDateRange(group: ImportGroup): { from: string; to: string } | null {
  let from: string | null = null;
  let to: string | null = null;
  for (const f of group.files) {
    const r = f.parsed.dateRange;
    if (!r) continue;
    if (from === null || r.from < from) from = r.from;
    if (to === null || r.to > to) to = r.to;
  }
  return from && to ? { from, to } : null;
}

function GroupCard({ group }: { group: ImportGroup }) {
  const style = BRAND_STYLE[group.brand];
  const { profile, transactions } = group.files[0].parsed;
  const rows = group.files.reduce((n, f) => n + f.parsed.transactions.length, 0);
  const range = groupDateRange(group);
  const manual = group.files.filter((f) => f.detection.status === "unknown");
  const sample = transactions.slice(0, 3);

  return (
    <div className={cn("overflow-hidden rounded-xl ring-2", style.soft)}>
      <div className={cn("flex flex-wrap items-center justify-between gap-3 px-5 py-4", style.solid)}>
        <div className="text-2xl font-bold uppercase tracking-wider">{group.brand}</div>
        <div className="flex flex-wrap gap-2">
          <Badge size="lg" className="bg-white/90 text-gray-900">
            {group.platform}
          </Badge>
          <Badge size="lg" className="bg-white/90 text-gray-900">
            {group.sourceType === "existing_db" ? "Existing Database" : "Fresh Export"}
          </Badge>
          {profile.isThousands && (
            <Badge size="lg" className="bg-white/90 text-gray-900">
              ×1000 Normalization
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted">Files</div>
            <div className="text-lg font-semibold">{group.files.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Rows</div>
            <div className="text-lg font-semibold">{rows.toLocaleString("id-ID")}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Order dates</div>
            <div className="text-sm font-semibold">
              {range ? `${formatDate(range.from)} – ${formatDate(range.to)}` : "—"}
            </div>
          </div>
        </div>

        <ul className="space-y-1 text-sm">
          {group.files.map((f) => (
            <li key={f.path}>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {f.detection.status === "detected"
                    ? `${Math.round(f.detection.dominance * 100)}% ${group.brand} products`
                    : "brand chosen manually"}
                </span>
              </div>
              {fileNotes(f).map((n) => (
                <div key={n} className="text-xs text-amber-600">
                  {n}
                </div>
              ))}
            </li>
          ))}
        </ul>

        {manual.length > 0 && (
          <div className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-700">
            {manual.length} file{manual.length > 1 ? "s" : ""} had too few branded product names to detect the brand
            automatically. Double-check they really belong to {group.brand}.
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Column mapping and sample rows</summary>
          <div className="mt-3 space-y-4">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Header</TableHead>
                    <TableHead>Internal Field</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getColumnMapping(profile).map(({ field, header }) => (
                    <TableRow key={field}>
                      <TableCell>{header}</TableCell>
                      <TableCell>{FIELD_LABELS[field] ?? field}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>GMV</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sample.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.order_id}</TableCell>
                      <TableCell>{row.sku}</TableCell>
                      <TableCell>{row.product_name ?? "—"}</TableCell>
                      <TableCell>{row.qty}</TableCell>
                      <TableCell>{formatRupiah(row.gmv_gross)}</TableCell>
                      <TableCell>{formatDate(row.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        </details>
      </div>
    </div>
  );
}

export function Step2Review({ groups }: { groups: ImportGroup[] }) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted">
        Each box is imported as one batch. Check the brand on every box before confirming: the brand comes from the
        product names inside the files, not from the file names.
      </div>
      {groups.map((g) => (
        <GroupCard key={g.key} group={g} />
      ))}
    </div>
  );
}

