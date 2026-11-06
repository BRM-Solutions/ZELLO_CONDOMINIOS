import cors from "cors";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { pino, type Logger } from "pino";
import { pinoHttp } from "pino-http";
import { authenticate, type TokenVerifier } from "./auth/authenticate";
import { loadMembership } from "./auth/membership";
import type { Config } from "./config";
import type { Db } from "./db";
import { DomainError, errorHandler, notFoundHandler, requestId } from "./http";
import { createSupabaseStorageClient, type StorageClient } from "./integrations/storage-client";
import { filesRouter } from "./modules/files/routes";
import { workspacesRouter } from "./modules/workspaces/routes";
import { healthRouter } from "./modules/health/routes";
import { meRouter } from "./modules/me/routes";
import { webhooksRouter, type WebhookAdapters } from "./modules/webhooks/routes";

export interface AppDeps {
  config: Config;
  db: Db;
  verifier: TokenVerifier;
  logger?: Logger;
  webhookAdapters?: WebhookAdapters;
  storage?: StorageClient;
}

const QUIET_PATHS = new Set(["/health", "/ready"]);
const REDACT_PATHS = ["req.headers.authorization", "req.headers.cookie"];

export function createApp({ config, db, verifier, logger, webhookAdapters = {}, storage }: AppDeps): Express {
  const storageClient =
    storage ?? createSupabaseStorageClient({ url: config.supabaseUrl, apiKey: config.supabasePublishableKey });
  const log = logger ?? pino({ level: config.logLevel, redact: REDACT_PATHS });
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.locals.db = db;

  app.use(requestId);
  app.use(
    pinoHttp({
      logger: log,
      genReqId: (req) => req.id,
      autoLogging: { ignore: (req) => QUIET_PATHS.has(req.url ?? "") },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || config.webOrigins.includes(origin)),
      allowedHeaders: ["Authorization", "Content-Type", "X-Organization-Id", "Idempotency-Key"],
      exposedHeaders: ["X-Request-Id"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: false,
      maxAge: 600,
    }),
  );

  app.use(healthRouter());

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(new DomainError(429, "RATE_LIMITED", "Muitas requisições, tente novamente em instantes.")),
    }),
  );

  app.use("/api/v1/webhooks", express.raw({ type: "*/*", limit: "64kb" }), webhooksRouter(webhookAdapters));
  app.use(express.json({ limit: "64kb" }));

  app.use("/api/v1/me", authenticate(verifier), meRouter());
  app.use("/api/v1", authenticate(verifier), loadMembership, workspacesRouter(), filesRouter({ storage: storageClient, config }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
