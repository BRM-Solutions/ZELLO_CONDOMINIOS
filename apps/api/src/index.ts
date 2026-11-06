import { pino } from "pino";
import { createApp } from "./app";
import { createRemoteJwtVerifier } from "./auth/authenticate";
import { ConfigError, loadConfig } from "./config";
import { createPool } from "./db";

const SHUTDOWN_TIMEOUT_MS = 10_000;

function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const logger = pino({ level: config.logLevel, redact: ["req.headers.authorization", "req.headers.cookie"] });
  const pool = createPool(config, (err) => logger.error({ err }, "pg pool error"));
  const app = createApp({ config, db: pool, verifier: createRemoteJwtVerifier(config), logger });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, "api listening");
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutting down");
    const force = setTimeout(() => {
      logger.error("shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();
    server.close((closeErr) => {
      pool
        .end()
        .catch((endErr: unknown) => logger.error({ err: endErr }, "pool end failed"))
        .finally(() => process.exit(closeErr ? 1 : 0));
    });
    server.closeIdleConnections();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => logger.error({ err: reason }, "unhandled rejection"));
}

main();
