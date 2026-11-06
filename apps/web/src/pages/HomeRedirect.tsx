import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function HomeRedirect() {
  const { memberships } = useAuth();
  const first = memberships[0]?.organizationId;
  if (!first) return <p className="state">Seu usuário ainda não está vinculado a nenhuma organização.</p>;
  return <Navigate to={`/o/${first}`} replace />;
}
