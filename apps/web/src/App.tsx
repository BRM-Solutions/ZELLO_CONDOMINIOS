import { Route, Routes } from "react-router-dom";
import { OrgScope } from "./components/OrgScope";
import { RequireAuth } from "./components/RequireAuth";
import { RequireRole } from "./components/RequireRole";
import { Shell } from "./components/Shell";
import { DashboardPage } from "./pages/DashboardPage";
import { HomeRedirect } from "./pages/HomeRedirect";
import { LoginPage } from "./pages/LoginPage";
import { OrganizationPage } from "./pages/OrganizationPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
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
          <Route path="*" element={<p className="state">Página não encontrada.</p>} />
        </Route>
      </Route>
    </Routes>
  );
}
