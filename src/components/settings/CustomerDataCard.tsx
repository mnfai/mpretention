import { useEffect, useState } from "react";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { formatNumber } from "@/lib/formatters";
import { getCustomerStats, reResolveAllCustomers } from "@/lib/db";
import type { CustomerStats } from "@/lib/types";

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <VStack gap={0.5}>
      <Text type="supporting">{label}</Text>
      <Text type="large">{formatNumber(value)}</Text>
    </VStack>
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
      <VStack gap={4}>
        <Heading level={3}>Customer Data</Heading>

        <Grid columns={4} gap={4}>
          <Stat label="Total Customers" value={stats?.totalCustomers} />
          <Stat label="Shopee" value={stats?.shopeeCustomers} />
          <Stat label="TikTokShop" value={stats?.tiktokCustomers} />
          <Stat label="Retention TX" value={stats?.totalRetentionTx} />
        </Grid>

        <Divider />

        <Grid columns={4} gap={4}>
          <Stat label="Tier 1 (Username)" value={stats?.tier1} />
          <Stat label="Tier 2 (Phone)" value={stats?.tier2} />
          <Stat label="Tier 3 (Composite)" value={stats?.tier3} />
          <Stat label="Unresolved" value={stats?.unresolved} />
        </Grid>

        <Divider />

        <HStack gap={4} justify="between" align="center">
          <VStack gap={0.5}>
            <Text type="label">Re-run Customer Resolution</Text>
            <Text type="supporting">
              Rebuilds the customer table and re-checks every transaction against the matching rules.
            </Text>
          </VStack>
          <Button
            label={isResolving ? "Resolving…" : "Re-run Customer Resolution"}
            variant="secondary"
            isDisabled={isResolving}
            onClick={handleReResolve}
          />
        </HStack>

        {isResolving && (
          <VStack gap={1}>
            <ProgressBar label="Re-resolving customers" isLabelHidden value={percent} />
            <Text type="supporting">
              Re-resolve {progress.current.toLocaleString("id-ID")} of {progress.total.toLocaleString("id-ID")}{" "}
              transactions
            </Text>
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
