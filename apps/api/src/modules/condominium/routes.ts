import {
  buildPaginationMeta,
  createBlockSchema,
  createPersonSchema,
  createUnitSchema,
  createUnitsBatchSchema,
  createWorkspaceSchema,
  endUnitMemberSchema,
  linkUnitSchema,
  peopleFilterSchema,
  revealContactSchema,
  unitsQuerySchema,
  updateBlockSchema,
  updatePersonSchema,
  updateUnitSchema,
  updateWorkspaceSchema,
  uuidSchema,
} from "@app/shared";
import { Router } from "express";
import { requirePermission } from "../../auth/require-role";
import { requireWorkspacePermission } from "../../auth/require-workspace";
import { asyncRoute, notFound, parse, sendData } from "../../http";
import {
  createBlock,
  createPerson,
  createUnit,
  createUnitsBatch,
  createWorkspace,
  endUnitMember,
  getPerson,
  linkUnit,
  listBlocks,
  listPeople,
  listUnits,
  myUnits,
  revealContact,
  updateBlock,
  updatePerson,
  updateUnit,
  updateWorkspace,
  type CondominiumDeps,
} from "./service";

const WS = "/workspaces/:workspaceId";

export function condominiumRouter(deps: CondominiumDeps): Router {
  const router = Router();
  const workspaceId = (req: { workspaceId?: string }): string => {
    if (!req.workspaceId) throw notFound();
    return req.workspaceId;
  };

  router.post(
    "/workspaces",
    requirePermission("workspaces:write"),
    asyncRoute(async (req, res) => {
      const input = parse(createWorkspaceSchema, req.body);
      res.status(201);
      sendData(req, res, await createWorkspace(req, deps, input));
    }),
  );

  router.patch(
    WS,
    requireWorkspacePermission("structure:write"),
    asyncRoute(async (req, res) => {
      const input = parse(updateWorkspaceSchema, req.body);
      sendData(req, res, await updateWorkspace(req, deps, workspaceId(req), input));
    }),
  );

  router.get(
    `${WS}/blocks`,
    requireWorkspacePermission("structure:read"),
    asyncRoute(async (req, res) => {
      sendData(req, res, await listBlocks(req, deps, workspaceId(req)));
    }),
  );

  router.post(
    `${WS}/blocks`,
    requireWorkspacePermission("structure:write"),
    asyncRoute(async (req, res) => {
      const input = parse(createBlockSchema, req.body);
      res.status(201);
      sendData(req, res, await createBlock(req, deps, workspaceId(req), input));
    }),
  );

  router.patch(
    `${WS}/blocks/:blockId`,
    requireWorkspacePermission("structure:write"),
    asyncRoute(async (req, res) => {
      const blockId = parse(uuidSchema, req.params.blockId);
      const input = parse(updateBlockSchema, req.body);
      sendData(req, res, await updateBlock(req, deps, workspaceId(req), blockId, input));
    }),
  );

  router.get(
    `${WS}/units`,
    requireWorkspacePermission("structure:read"),
    asyncRoute(async (req, res) => {
      const query = parse(unitsQuerySchema, req.query);
      const { items, total } = await listUnits(req, deps, workspaceId(req), query);
      sendData(req, res, items, buildPaginationMeta(query, total));
    }),
  );

  router.post(
    `${WS}/units`,
    requireWorkspacePermission("structure:write"),
    asyncRoute(async (req, res) => {
      const input = parse(createUnitSchema, req.body);
      res.status(201);
      sendData(req, res, await createUnit(req, deps, workspaceId(req), input));
    }),
  );

  router.post(
    `${WS}/units/batch`,
    requireWorkspacePermission("structure:write"),
    asyncRoute(async (req, res) => {
      const input = parse(createUnitsBatchSchema, req.body);
      sendData(req, res, await createUnitsBatch(req, deps, workspaceId(req), input));
    }),
  );

  router.patch(
    `${WS}/units/:unitId`,
    requireWorkspacePermission("structure:write"),
    asyncRoute(async (req, res) => {
      const unitId = parse(uuidSchema, req.params.unitId);
      const input = parse(updateUnitSchema, req.body);
      sendData(req, res, await updateUnit(req, deps, workspaceId(req), unitId, input));
    }),
  );

  router.get(
    `${WS}/people`,
    requireWorkspacePermission("people:read"),
    asyncRoute(async (req, res) => {
      const filter = parse(peopleFilterSchema, req.query);
      const { items, total } = await listPeople(req, deps, workspaceId(req), filter);
      sendData(req, res, items, buildPaginationMeta(filter, total));
    }),
  );

  router.post(
    `${WS}/people`,
    requireWorkspacePermission("people:write"),
    asyncRoute(async (req, res) => {
      const input = parse(createPersonSchema, req.body);
      res.status(201);
      sendData(req, res, await createPerson(req, deps, workspaceId(req), input));
    }),
  );

  router.get(
    `${WS}/people/:personId`,
    requireWorkspacePermission("people:read"),
    asyncRoute(async (req, res) => {
      const personId = parse(uuidSchema, req.params.personId);
      sendData(req, res, await getPerson(req, deps, workspaceId(req), personId));
    }),
  );

  router.patch(
    `${WS}/people/:personId`,
    requireWorkspacePermission("people:write"),
    asyncRoute(async (req, res) => {
      const personId = parse(uuidSchema, req.params.personId);
      const input = parse(updatePersonSchema, req.body);
      sendData(req, res, await updatePerson(req, deps, workspaceId(req), personId, input));
    }),
  );

  router.post(
    `${WS}/people/:personId/reveal-contact`,
    requireWorkspacePermission("people:reveal"),
    asyncRoute(async (req, res) => {
      const personId = parse(uuidSchema, req.params.personId);
      const input = parse(revealContactSchema, req.body);
      res.setHeader("Cache-Control", "no-store");
      sendData(req, res, await revealContact(req, deps, workspaceId(req), personId, input));
    }),
  );

  router.post(
    `${WS}/people/:personId/units`,
    requireWorkspacePermission("people:write"),
    asyncRoute(async (req, res) => {
      const personId = parse(uuidSchema, req.params.personId);
      const input = parse(linkUnitSchema, req.body);
      res.status(201);
      sendData(req, res, await linkUnit(req, deps, workspaceId(req), personId, input));
    }),
  );

  router.post(
    `${WS}/unit-members/:id/end`,
    requireWorkspacePermission("people:write"),
    asyncRoute(async (req, res) => {
      const id = parse(uuidSchema, req.params.id);
      const input = parse(endUnitMemberSchema, req.body);
      sendData(req, res, await endUnitMember(req, deps, workspaceId(req), id, input));
    }),
  );

  router.get(
    "/me/units",
    asyncRoute(async (req, res) => {
      sendData(req, res, await myUnits(req, deps));
    }),
  );

  return router;
}
