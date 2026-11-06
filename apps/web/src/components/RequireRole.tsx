import type { Role } from "@app/shared";
import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";

interface RequireRoleProps {
  roles: Role[];
  children: ReactNode;
}

export function RequireRole({ roles, children }: RequireRoleProps) {
  const { role, loading } = useAuth();

  if (loading) return <p className="state" role="status">Carregando...</p>;
  if (!role || !roles.includes(role)) {
    return (
      <p className="state state-error" role="alert">
        Você não tem permissão para acessar esta página.
      </p>
    );
  }
  return <>{children}</>;
}
