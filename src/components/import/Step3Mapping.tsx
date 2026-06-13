import { Check } from "lucide-react";
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
import { getColumnMapping } from "@/lib/importer";
import { formatDate, formatRupiah } from "@/lib/formatters";
import type { UploadedFile } from "@/hooks/useImport";

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
  total_payment: "Total Payment",
  warehouse: "Warehouse",
  buyer_username: "Buyer Username",
  phone: "Phone Number",
  recipient: "Recipient",
  province: "Province",
  regency_city: "Regency/City",
};

const PLATFORM_BADGE_CLASS: Record<string, string> = {
  Shopee: "bg-orange-500/15 text-orange-600",
  TikTokShop: "bg-teal-500/15 text-teal-600",
};

interface Step3MappingProps {
  files: UploadedFile[];
}

export function Step3Mapping({ files }: Step3MappingProps) {
  const { profile, transactions } = files[0].parsed;
  const mapping = getColumnMapping(profile);
  const sample = transactions.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge size="lg" className={PLATFORM_BADGE_CLASS[profile.platform]}>
          {profile.platform}
        </Badge>
        <Badge size="lg" variant={profile.sourceType === "existing_db" ? "success" : "info"}>
          {profile.sourceType === "existing_db" ? "Existing Database" : "Fresh Export"}
        </Badge>
        <Badge size="lg" variant={profile.isThousands ? "warning" : "secondary"}>
          {profile.isThousands ? "×1000 Normalization Applied" : "Full Rupiah"}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-muted">Column Mapping</div>
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Header</TableHead>
                <TableHead>Internal Field</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mapping.map(({ field, header }) => (
                <TableRow key={field}>
                  <TableCell>{header}</TableCell>
                  <TableCell>{FIELD_LABELS[field] ?? field}</TableCell>
                  <TableCell>
                    <Check className="size-4 text-success" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-muted">Sample Data (first 3 rows)</div>
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
    </div>
  );
}
