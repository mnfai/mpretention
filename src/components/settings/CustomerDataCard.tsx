import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/selia/card";
import { Button } from "@/components/selia/button";
import { Separator } from "@/components/selia/separator";
import { Progress } from "@/components/selia/progress";
import { formatNumber } from "@/lib/formatters";
import { getCustomerStats, reResolveAllCustomers } from "@/lib/db";
import type { CustomerStats } from "@/lib/types";

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold">{formatNumber(value)}</div>
    </div>
  );
}

export function CustomerDataCard() {
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    getCustomerStats().then(setStats);
  }, []);

  async function handleReResolve() {
    setIsResolving(true);
    setProgress({ current: 0, total: 0 });
    try {
      const result = await reResolveAllCustomers((current, total) => setProgress({ current, total }));
      setStats(result);
    } finally {
      setIsResolving(false);
    }
  }

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Data</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total Customers" value={stats?.totalCustomers} />
          <Stat label="Shopee" value={stats?.shopeeCustomers} />
          <Stat label="TikTokShop" value={stats?.tiktokCustomers} />
          <Stat label="Retention TX" value={stats?.totalRetentionTx} />
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Tier 1 (Username)" value={stats?.tier1} />
          <Stat label="Tier 2 (Phone)" value={stats?.tier2} />
          <Stat label="Tier 3 (Composite)" value={stats?.tier3} />
          <Stat label="Unresolved" value={stats?.unresolved} />
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Re-run Customer Resolution</div>
            <div className="text-xs text-muted">
              Rebuilds the customer table and re-checks every transaction against the matching rules.
            </div>
          </div>
          <Button variant="outline" disabled={isResolving} onClick={handleReResolve}>
            {isResolving ? "Resolving…" : "Re-run Customer Resolution"}
          </Button>
        </div>

        {isResolving && (
          <div className="space-y-1">
            <Progress value={percent} />
            <div className="text-xs text-muted">
              Re-resolve {progress.current.toLocaleString("id-ID")} of {progress.total.toLocaleString("id-ID")}{" "}
              transactions
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
