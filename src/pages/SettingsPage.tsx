import { AppInfoCard } from "@/components/settings/AppInfoCard";
import { GmvModeCard } from "@/components/settings/GmvModeCard";
import { DisplayCard } from "@/components/settings/DisplayCard";
import { CustomerDataCard } from "@/components/settings/CustomerDataCard";
import { DangerZoneCard } from "@/components/settings/DangerZoneCard";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <AppInfoCard />
      <DisplayCard />
      <GmvModeCard />
      <CustomerDataCard />
      <DangerZoneCard />
    </div>
  );
}
