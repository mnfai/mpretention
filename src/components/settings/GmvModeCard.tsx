import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Switch } from "@astryxdesign/core/Switch";
import { useFilterStore } from "@/store/filterStore";

const DESCRIPTIONS = {
  gross: "Gross — GMV based on Total Harga Produk (before payment adjustments).",
  net: "Net — GMV based on Total Pembayaran (actual amount paid by the customer).",
};

export function GmvModeCard() {
  const { gmvMode, setGmvMode } = useFilterStore();

  return (
    <Card>
      <VStack gap={3}>
        <Heading level={3}>GMV Default Mode</Heading>
        <HStack gap={4} justify="between" align="center">
          <VStack gap={0.5}>
            <Text type="label">{gmvMode === "gross" ? "Gross" : "Net"}</Text>
            <Text type="supporting">{DESCRIPTIONS[gmvMode]}</Text>
          </VStack>
          <Switch
            label="Use net GMV"
            isLabelHidden
            value={gmvMode === "net"}
            onChange={(checked) => setGmvMode(checked ? "net" : "gross")}
          />
        </HStack>
      </VStack>
    </Card>
  );
}
