import { can, type Permission } from "@app/shared";
import { useAuth } from "../contexts/AuthContext";

export function useCan(permission: Permission): boolean {
  const { role } = useAuth();
  return can(role, permission);
}
