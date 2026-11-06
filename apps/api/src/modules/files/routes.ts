import { createFileInputSchema, uuidSchema } from "@app/shared";
import { Router } from "express";
import { requirePermission } from "../../auth/require-role";
import { asyncRoute, parse, sendData } from "../../http";
import { completeUpload, deleteFile, downloadUrl, initUpload, type FilesDeps } from "./service";

export function filesRouter(deps: FilesDeps): Router {
  const router = Router();

  router.post(
    "/files",
    requirePermission("files:write"),
    asyncRoute(async (req, res) => {
      const input = parse(createFileInputSchema, req.body);
      const data = await initUpload(req, deps, input);
      res.status(201);
      sendData(req, res, data);
    }),
  );

  router.post(
    "/files/:id/complete",
    requirePermission("files:write"),
    asyncRoute(async (req, res) => {
      const id = parse(uuidSchema, req.params.id);
      sendData(req, res, await completeUpload(req, deps, id));
    }),
  );

  router.get(
    "/files/:id/url",
    requirePermission("files:read"),
    asyncRoute(async (req, res) => {
      const id = parse(uuidSchema, req.params.id);
      sendData(req, res, await downloadUrl(req, deps, id));
    }),
  );

  router.delete(
    "/files/:id",
    requirePermission("files:delete"),
    asyncRoute(async (req, res) => {
      const id = parse(uuidSchema, req.params.id);
      sendData(req, res, await deleteFile(req, id));
    }),
  );

  return router;
}
