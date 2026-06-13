import { Card, CardBody, CardHeader, CardTitle, CardHeaderAction } from "@/components/selia/card";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RetentionTable } from "@/components/retention/RetentionTable";
import { RetentionExportButton } from "@/components/retention/RetentionExportButton";
import { useRetention } from "@/hooks/useRetention";
import { useFilterStore } from "@/store/filterStore";
import { formatNumber, formatPercent, formatRupiah } from "@/lib/formatters";
import type { SummaryFilters } from "@/lib/types";

export default function RetentionPage() {
  const { brand, platform, gmvMode, dateFrom, dateTo } = useFilterStore();
  const filters: SummaryFilters = { brand, platform, gmvMode, dateFrom, dateTo };
  const { data, totals, isLoading } = useRetention(filters);

  return (
    <div className="space-y-6">
      <FilterBar />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Retention GMV" value={formatRupiah(totals?.retention_gmv)} subtext="Selected period" />
        <MetricCard
          label="Retention Transactions"
          value={formatNumber(totals?.retention_tx)}
          subtext="Repeat orders"
        />
        <MetricCard label="Retention Rate" value={formatPercent(totals?.retention_rate)} subtext="Of all orders" />
        <MetricCard label="Retention AOV" value={formatRupiah(totals?.retention_aov)} subtext="Per repeat order" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Retention</CardTitle>
          <CardHeaderAction>
            <RetentionExportButton rows={data} />
          </CardHeaderAction>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted">Loading…</div>
          ) : (
            <RetentionTable rows={data} totals={totals} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
