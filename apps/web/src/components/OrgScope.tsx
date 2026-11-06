import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function OrgScope() {
  const { organizationId } = useAuth();
  if (!organizationId) return <Navigate to="/" replace />;
  return <Outlet />;
}
