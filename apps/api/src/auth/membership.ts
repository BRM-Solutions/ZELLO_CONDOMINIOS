import { highestRole, uuidSchema, type Role } from "@app/shared";
import type { RequestHandler } from "express";
import { withTenantTx } from "../db";
import { DomainError, asyncRoute, notFound } from "../http";

interface MembershipRow {
  workspace_id: string | null;
  role: Role;
}

export const loadMembership: RequestHandler = asyncRoute(async (req, _res, next) => {
  const organizationId = uuidSchema.safeParse(req.header("x-organization-id"));
  if (!organizationId.success) {
    throw new DomainError(400, "VALIDATION_ERROR", "Cabeçalho X-Organization-Id ausente ou inválido.");
  }

  const rows = await withTenantTx(
    req,
    async (client) => {
      const result = await client.query<MembershipRow>(
        `select workspace_id, role
           from app.memberships
          where user_id = $1 and organization_id = $2 and status = 'active'`,
        [req.auth?.userId, organizationId.data],
      );
      return result.rows;
    },
    { readOnly: true },
  );

  const role = highestRole(rows.map((row) => row.role));
  if (!role) throw notFound();

  req.membership = {
    organizationId: organizationId.data,
    role,
    workspaceIds: rows.flatMap((row) => (row.workspace_id ? [row.workspace_id] : [])),
  };
  next();
});
