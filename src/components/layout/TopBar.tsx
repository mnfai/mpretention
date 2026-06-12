import { useLocation } from "react-router-dom";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/import": "Import Data",
  "/history": "Import History",
  "/settings": "Settings",
};

export function TopBar() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? "MPRetention";

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
    </header>
  );
}
