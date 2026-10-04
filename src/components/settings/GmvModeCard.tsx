import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Switch } from "@astryxdesign/core/Switch";
import { useFilterStore } from "@/store/filterStore";

const DESCRIPTIONS = {
  gross: "Gross — product subtotal after discounts (Shopee Subtotal Pesanan / Total Harga Produk, TikTok SKU Subtotal After Discount).",
  net: "Net — amount the buyer paid per order (Shopee Total Pembayaran, TikTok Order Amount). TikTok's Order Amount includes shipping, so it can exceed Gross.",
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
