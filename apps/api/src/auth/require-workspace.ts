import { rolesFor, uuidSchema, type Permission } from "@app/shared";
import type { RequestHandler } from "express";
import { withTenantTx } from "../db";
import { asyncRoute, forbidden, notFound } from "../http";

// Papel avaliado no condomínio da rota (:workspaceId), não o mais alto da organização.
export function requireWorkspacePermission(permission: Permission): RequestHandler {
  const allowed = rolesFor(permission);
  return asyncRoute(async (req, _res, next) => {
    const membership = req.membership;
    const workspaceId = uuidSchema.safeParse(req.params.workspaceId);
    if (!membership || !workspaceId.success) throw notFound();

    const scopes = membership.scopes.filter((s) => s.workspaceId === null || s.workspaceId === workspaceId.data);
    if (scopes.length === 0) throw notFound();

    // Membership de condomínio já garante o workspace (FK composta); owner/admin precisam confirmar que é da organização.
    if (!scopes.some((s) => s.workspaceId === workspaceId.data)) {
      const found = await withTenantTx(
        req,
        async (client) => {
          const result = await client.query("select 1 from app.workspaces where id = $1 and organization_id = $2", [
            workspaceId.data,
            membership.organizationId,
          ]);
          return (result.rowCount ?? result.rows.length) > 0;
        },
        { readOnly: true },
      );
      if (!found) throw notFound();
    }

    if (!scopes.some((s) => allowed.includes(s.role))) throw forbidden();
    req.workspaceId = workspaceId.data;
    next();
  });
}
