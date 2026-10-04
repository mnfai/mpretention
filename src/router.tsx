import { createHashRouter, Navigate } from "react-router-dom";
import { homePath, useUiStore } from "@/store/uiStore";
import { AppShell } from "@/components/layout/AppShell";
import DashboardPage from "@/pages/DashboardPage";
import RetentionPage from "@/pages/RetentionPage";
import ImportPage from "@/pages/ImportPage";
import HistoryPage from "@/pages/HistoryPage";
import SettingsPage from "@/pages/SettingsPage";

/** Opens Retention unless the optional Dashboard page is enabled in Settings. */
function HomeRedirect() {
  const showDashboard = useUiStore((s) => s.showDashboard);
  return <Navigate to={homePath(showDashboard)} replace />;
}

/** The Dashboard route only renders while the page is enabled. */
function DashboardRoute() {
  const showDashboard = useUiStore((s) => s.showDashboard);
  return showDashboard ? <DashboardPage /> : <Navigate to="/retention" replace />;
}

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: "dashboard", element: <DashboardRoute /> },
      { path: "retention", element: <RetentionPage /> },
      { path: "import", element: <ImportPage /> },
      { path: "history", element: <HistoryPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
