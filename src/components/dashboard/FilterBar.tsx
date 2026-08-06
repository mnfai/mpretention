import { Card, CardBody } from "@/components/selia/card";
import { cn } from "@/lib/utils";
import { useFilterStore } from "@/store/filterStore";
import { DateRangeFilter } from "./DateRangeFilter";
import type { BrandFilter, GmvMode, PlatformFilter } from "@/lib/types";

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  activeClass: string;
}

const BRAND_OPTIONS: SegmentOption<BrandFilter>[] = [
  { value: "All", label: "All", activeClass: "bg-foreground text-background" },
  { value: "Amura", label: "Amura", activeClass: "bg-violet-500 text-white" },
  { value: "Reglow", label: "Reglow", activeClass: "bg-pink-500 text-white" },
];

const PLATFORM_OPTIONS: SegmentOption<PlatformFilter>[] = [
  { value: "All", label: "All", activeClass: "bg-foreground text-background" },
  { value: "Shopee", label: "Shopee", activeClass: "bg-orange-500 text-white" },
  { value: "TikTokShop", label: "TikTokShop", activeClass: "bg-teal-500 text-white" },
];

const GMV_MODE_OPTIONS: SegmentOption<GmvMode>[] = [
  { value: "gross", label: "Gross", activeClass: "bg-foreground text-background" },
  { value: "net", label: "Net", activeClass: "bg-foreground text-background" },
];

const GMV_MODE_HINT: Record<GmvMode, string> = {
  gross: "Before payment adjustments",
  net: "Actual amount paid",
};

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full ring ring-border p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            value === opt.value ? opt.activeClass : "text-muted hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar() {
  const { brand, platform, gmvMode, dateFrom, dateTo, setBrand, setPlatform, setGmvMode, setDateRange } =
    useFilterStore();

  return (
    <Card>
      <CardBody className="flex flex-wrap items-end gap-6">
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted">Brand</div>
          <SegmentedControl options={BRAND_OPTIONS} value={brand} onChange={setBrand} />
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted">Platform</div>
          <SegmentedControl options={PLATFORM_OPTIONS} value={platform} onChange={setPlatform} />
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted">GMV Mode</div>
          <SegmentedControl options={GMV_MODE_OPTIONS} value={gmvMode} onChange={setGmvMode} />
          <div className="text-xs text-muted">{GMV_MODE_HINT[gmvMode]}</div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted">Period</div>
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={setDateRange} />
        </div>
      </CardBody>
    </Card>
  );
}
