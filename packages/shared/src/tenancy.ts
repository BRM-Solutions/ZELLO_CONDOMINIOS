import { z } from "zod";
import { uuidSchema } from "./common";

export const ROLES = ["owner", "admin", "manager", "staff", "member"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_RANK: Record<Role, number> = { owner: 5, admin: 4, manager: 3, staff: 2, member: 1 };

export function highestRole(roles: Role[]): Role | undefined {
  return [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
}

export const organizationSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  status: z.enum(["active", "suspended", "closed"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Organization = z.infer<typeof organizationSchema>;

export const workspaceSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  name: z.string().min(1),
  cnpj: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().length(2).nullable(),
  status: z.enum(["active", "inactive"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const membershipSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  workspaceId: uuidSchema.nullable(),
  role: roleSchema,
});
export type Membership = z.infer<typeof membershipSchema>;

export const meResponseSchema = z.object({
  data: z.object({
    id: uuidSchema,
    email: z.string().nullable(),
    memberships: z.array(membershipSchema),
  }),
  meta: z.object({ requestId: z.string().optional() }).optional(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
