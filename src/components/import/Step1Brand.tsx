import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Brand, Platform } from "@/lib/types";

interface SelectableCardProps {
  label: string;
  selected: boolean;
  selectedClass: string;
  onClick: () => void;
}

function SelectableCard({ label, selected, selectedClass, onClick }: SelectableCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-24 flex-1 items-center justify-center rounded-xl ring-2 text-base font-semibold transition-colors",
        selected ? selectedClass : "ring-border text-foreground hover:ring-dimmed",
      )}
    >
      {label}
      {selected && (
        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-current">
          <Check className="size-3.5 text-white" />
        </span>
      )}
    </button>
  );
}

const BRAND_OPTIONS: { value: Brand; label: string; selectedClass: string }[] = [
  { value: "Amura", label: "Amura", selectedClass: "ring-violet-500 text-violet-500" },
  { value: "Reglow", label: "Reglow", selectedClass: "ring-pink-500 text-pink-500" },
];

const PLATFORM_OPTIONS: { value: Platform; label: string; selectedClass: string }[] = [
  { value: "Shopee", label: "Shopee", selectedClass: "ring-orange-500 text-orange-500" },
  { value: "TikTokShop", label: "TikTokShop", selectedClass: "ring-teal-500 text-teal-500" },
];

interface Step1BrandProps {
  brand: Brand | null;
  platform: Platform | null;
  onSelectBrand: (brand: Brand) => void;
  onSelectPlatform: (platform: Platform) => void;
}

export function Step1Brand({ brand, platform, onSelectBrand, onSelectPlatform }: Step1BrandProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted">Brand</div>
        <div className="flex gap-4">
          {BRAND_OPTIONS.map((opt) => (
            <SelectableCard
              key={opt.value}
              label={opt.label}
              selected={brand === opt.value}
              selectedClass={opt.selectedClass}
              onClick={() => onSelectBrand(opt.value)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-muted">Platform</div>
        <div className="flex gap-4">
          {PLATFORM_OPTIONS.map((opt) => (
            <SelectableCard
              key={opt.value}
              label={opt.label}
              selected={platform === opt.value}
              selectedClass={opt.selectedClass}
              onClick={() => onSelectPlatform(opt.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
