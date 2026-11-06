import type { Membership, Role } from "@app/shared";
import { Router } from "express";
import { withTenantTx } from "../../db";
import { asyncRoute, authRequired, sendData } from "../../http";

interface MembershipRow {
  id: string;
  organization_id: string;
  workspace_id: string | null;
  role: Role;
}

export function meRouter(): Router {
  const router = Router();

  router.get(
    "/",
    asyncRoute(async (req, res) => {
      const auth = req.auth;
      if (!auth) throw authRequired();
      const rows = await withTenantTx(
        req,
        async (client) => {
          const result = await client.query<MembershipRow>(
            `select id, organization_id, workspace_id, role
               from app.memberships
              where user_id = $1 and status = 'active'
              order by organization_id, workspace_id nulls first`,
            [auth.userId],
          );
          return result.rows;
        },
        { readOnly: true },
      );
      const memberships = rows.map(
        (row): Membership => ({
          id: row.id,
          organizationId: row.organization_id,
          workspaceId: row.workspace_id,
          role: row.role,
        }),
      );
      sendData(req, res, { id: auth.userId, email: auth.email, memberships });
    }),
  );

  return router;
}
