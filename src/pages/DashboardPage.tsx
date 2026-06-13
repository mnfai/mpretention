import { Card, CardBody, CardHeader, CardTitle, CardHeaderAction } from "@/components/selia/card";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SummaryTable } from "@/components/dashboard/SummaryTable";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { useDailySummary } from "@/hooks/useDailySummary";
import { useFilterStore } from "@/store/filterStore";
import { formatPercent, formatRupiah } from "@/lib/formatters";
import type { SummaryFilters } from "@/lib/types";

export default function DashboardPage() {
  const { brand, platform, gmvMode, dateFrom, dateTo } = useFilterStore();
  const filters: SummaryFilters = { brand, platform, gmvMode, dateFrom, dateTo };
  const { data, totals, isLoading } = useDailySummary(filters);

  return (
    <div className="space-y-6">
      <FilterBar />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total GMV" value={formatRupiah(totals?.gmv)} subtext="Selected period" />
        <MetricCard
          label="Total Transactions"
          value={(totals?.total_tx ?? 0).toLocaleString("id-ID")}
          subtext="Unique orders"
        />
        <MetricCard label="AOV" value={formatRupiah(totals?.aov)} subtext="Per transaction" />
        <MetricCard
          label="Cancellation Rate"
          value={formatPercent(totals?.cancellation_rate)}
          subtext="Of all orders"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Summary</CardTitle>
          <CardHeaderAction>
            <ExportButton rows={data} />
          </CardHeaderAction>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted">Loading…</div>
          ) : (
            <SummaryTable rows={data} totals={totals} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
