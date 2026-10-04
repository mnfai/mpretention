import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Switch } from "@astryxdesign/core/Switch";
import { useUiStore } from "@/store/uiStore";

export function DisplayCard() {
  const { showDashboard, setShowDashboard } = useUiStore();

  return (
    <Card>
      <VStack gap={3}>
        <Heading level={3}>Display</Heading>
        <HStack gap={4} justify="between" align="center">
          <VStack gap={0.5}>
            <Text type="label">Show Dashboard page</Text>
            <Text type="supporting">
              Adds the Dashboard (GMV, transactions, AOV, cancellation per day) to the sidebar. When off, the app opens
              on Retention.
            </Text>
          </VStack>
          <Switch
            label="Show Dashboard page"
            isLabelHidden
            value={showDashboard}
            onChange={(checked) => setShowDashboard(checked)}
          />
        </HStack>
      </VStack>
    </Card>
  );
}
