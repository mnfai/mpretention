import { Card, CardBody, CardHeader, CardTitle } from "@/components/selia/card";
import { Switch } from "@/components/selia/switch";
import { useFilterStore } from "@/store/filterStore";

const DESCRIPTIONS = {
  gross: "Gross — GMV based on Total Harga Produk (before payment adjustments).",
  net: "Net — GMV based on Total Pembayaran (actual amount paid by the customer).",
};

export function GmvModeCard() {
  const { gmvMode, setGmvMode } = useFilterStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>GMV Default Mode</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">{gmvMode === "gross" ? "Gross" : "Net"}</div>
            <div className="text-xs text-muted">{DESCRIPTIONS[gmvMode]}</div>
          </div>
          <Switch
            checked={gmvMode === "net"}
            onCheckedChange={(checked) => setGmvMode(checked ? "net" : "gross")}
          />
        </div>
      </CardBody>
    </Card>
  );
}
