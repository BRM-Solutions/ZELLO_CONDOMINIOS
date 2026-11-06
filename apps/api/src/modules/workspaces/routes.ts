import { buildPaginationMeta, paginationQuerySchema } from "@app/shared";
import { Router } from "express";
import { requirePermission } from "../../auth/require-role";
import { withTenantTx } from "../../db";
import { asyncRoute, notFound, parse, sendData } from "../../http";
import { listWorkspaces } from "./repository";

export function workspacesRouter(): Router {
  const router = Router();

  router.get(
    "/workspaces",
    requirePermission("workspaces:read"),
    asyncRoute(async (req, res) => {
      const query = parse(paginationQuerySchema, req.query);
      const organizationId = req.membership?.organizationId;
      if (!organizationId) throw notFound();
      const { items, total } = await withTenantTx(req, (tx) => listWorkspaces(tx, organizationId, query), {
        readOnly: true,
      });
      sendData(req, res, items, buildPaginationMeta(query, total));
    }),
  );

  return router;
}
