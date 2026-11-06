import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { OrgScope } from "./components/OrgScope";
import { RequireAuth } from "./components/RequireAuth";
import { RequireRole } from "./components/RequireRole";
import { AppShell } from "./components/shell/AppShell";
import { EmptyState, LoadingRows } from "./components/ui/States";
import { useTheme } from "./hooks/useTheme";
import { DashboardPage } from "./pages/DashboardPage";
import { HomeRedirect } from "./pages/HomeRedirect";
import { LoginPage } from "./pages/LoginPage";
import { OrganizationPage } from "./pages/OrganizationPage";

// A vitrine so existe em build de desenvolvimento: em producao a condicao vira false e o chunk nao e gerado.
const DesignSystemPage = import.meta.env.DEV ? lazy(() => import("./pages/DesignSystemPage")) : null;

export function App() {
  useTheme();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<HomeRedirect />} />
          <Route path="o/:organizationId" element={<OrgScope />}>
            <Route index element={<DashboardPage />} />
            <Route
              path="organizacao"
              element={
                <RequireRole roles={["owner", "admin"]}>
                  <OrganizationPage />
                </RequireRole>
              }
            />
          </Route>
          {DesignSystemPage && (
            <Route
              path="design-system"
              element={
                <Suspense fallback={<LoadingRows />}>
                  <DesignSystemPage />
                </Suspense>
              }
            />
          )}
          <Route path="*" element={<EmptyState message="Página não encontrada." />} />
        </Route>
      </Route>
    </Routes>
  );
}
