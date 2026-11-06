import { ROLES, type Role } from "./tenancy";

export const PERMISSIONS = {
  "organization:read": ROLES,
  "organization:manage": ["owner", "admin"],
  "members:manage": ["owner", "admin"],
  "workspaces:read": ROLES,
  "workspaces:write": ["owner", "admin"],
  "workspaces:update": ["owner", "admin", "manager"],
  "structure:read": ROLES,
  "structure:write": ["owner", "admin", "manager"],
  "people:read": ["owner", "admin", "manager"],
  "people:write": ["owner", "admin", "manager"],
  "people:reveal": ["owner", "admin", "manager"],
  "files:read": ROLES,
  "files:write": ["owner", "admin", "manager", "staff"],
  "files:delete": ["owner", "admin", "manager"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function rolesFor(permission: Permission): Role[] {
  return [...PERMISSIONS[permission]];
}

export function can(role: Role | undefined, permission: Permission): boolean {
  return role !== undefined && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
