import type { Brand, Platform } from "@/lib/types";

/** Brand colours used everywhere a file or batch is labelled, so Amura and Reglow are never confused. */
export const BRAND_STYLE: Record<Brand, { solid: string; soft: string; text: string }> = {
  Amura: { solid: "bg-violet-600 text-white", soft: "bg-violet-500/10 ring-violet-500/50", text: "text-violet-600" },
  Reglow: { solid: "bg-pink-600 text-white", soft: "bg-pink-500/10 ring-pink-500/50", text: "text-pink-600" },
};

export const PLATFORM_BADGE_CLASS: Record<Platform, string> = {
  Shopee: "bg-orange-500/15 text-orange-600",
  TikTokShop: "bg-teal-500/15 text-teal-600",
};
