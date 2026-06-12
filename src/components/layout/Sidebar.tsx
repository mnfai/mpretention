import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  RefreshCw,
  Upload,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useImportStore } from "@/store/importStore";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/retention", label: "Retention", icon: RefreshCw },
  { to: "/import", label: "Import Data", icon: Upload },
  { to: "/history", label: "Import History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

const APP_VERSION = "v1.0.3";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const wizardStep = useImportStore((s) => s.step);
  const isImporting = useImportStore((s) => s.isImporting);
  const showResumeBanner = wizardStep > 1 && wizardStep < 4 && location.pathname !== "/import";

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-[#1E293B] transition-all duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4">
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="truncate text-sm font-semibold text-white">MPRetention</div>
            <div className="text-xs text-[#94A3B8]">{APP_VERSION}</div>
          </div>
        )}
      </div>

      {showResumeBanner && !collapsed && (
        <div className="mx-2 mb-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2">
          <div className="text-xs font-medium text-amber-400">Import in progress</div>
          <NavLink
            to="/import"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-300 hover:underline"
          >
            Resume <ArrowRight className="size-3" />
          </NavLink>
        </div>
      )}

      <nav className="relative flex-1 space-y-1 px-2 py-2">
        {isImporting && (
          <div
            title="Navigation disabled while import is running"
            className="absolute inset-0 z-10 cursor-not-allowed rounded-md bg-[#1E293B]/60"
          />
        )}
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md border-l-[3px] border-transparent px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-l-[#6366F1] bg-[#334155] text-white"
                  : "text-[#94A3B8] hover:bg-[#334155]/50 hover:text-white",
              )
            }
          >
            <Icon className="size-5 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-[#94A3B8] transition-colors hover:bg-[#334155]/50 hover:text-white"
        >
          {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
