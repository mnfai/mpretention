import { AppInfoCard } from "@/components/settings/AppInfoCard";
import { GmvModeCard } from "@/components/settings/GmvModeCard";
import { CustomerDataCard } from "@/components/settings/CustomerDataCard";
import { DangerZoneCard } from "@/components/settings/DangerZoneCard";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <AppInfoCard />
      <GmvModeCard />
      <CustomerDataCard />
      <DangerZoneCard />
    </div>
  );
}
