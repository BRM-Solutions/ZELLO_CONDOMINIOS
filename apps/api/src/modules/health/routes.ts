import { Router } from "express";
import { getDb } from "../../db";
import { asyncRoute } from "../../http";

const READY_TIMEOUT_MS = 3_000;

export function healthRouter(): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "{{SLUG}}-api" });
  });

  router.get(
    "/ready",
    asyncRoute(async (req, res) => {
      let timer: NodeJS.Timeout | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), READY_TIMEOUT_MS);
        });
        await Promise.race([getDb(req).query("select 1"), timeout]);
        res.json({ status: "ready" });
      } catch (err) {
        req.log.warn({ err }, "readiness check failed");
        res.status(503).json({ error: { code: "NOT_READY", message: "Banco de dados indisponível" } });
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return router;
}
