import { Navigate } from "react-router-dom";
import { EmptyState } from "../components/ui/States";
import { useAuth } from "../contexts/AuthContext";

export function HomeRedirect() {
  const { memberships } = useAuth();
  const first = memberships[0]?.organizationId;
  if (!first) return <EmptyState message="Seu usuário ainda não está vinculado a nenhuma organização." />;
  return <Navigate to={`/o/${first}`} replace />;
}
