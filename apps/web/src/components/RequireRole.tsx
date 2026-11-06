import type { Role } from "@app/shared";
import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Alert } from "./ui/Alert";
import { LoadingRows } from "./ui/States";

interface RequireRoleProps {
  roles: Role[];
  children: ReactNode;
}

export function RequireRole({ roles, children }: RequireRoleProps) {
  const { role, loading } = useAuth();

  if (loading) return <LoadingRows />;
  if (!role || !roles.includes(role)) {
    return <Alert tone="danger">Você não tem permissão para acessar esta página.</Alert>;
  }
  return <>{children}</>;
}
