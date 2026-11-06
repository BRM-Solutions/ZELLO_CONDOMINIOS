import { pino } from "pino";
import { ConfigError, loadWorkerConfig } from "./config";
import { createPool } from "./db";
import { createSupabaseStorageClient } from "./integrations/storage-client";
import { runFilesRetentionCycle } from "./jobs/files-retention";
import { runOutboxCycle, type OutboxHandler } from "./jobs/outbox";

const handlers: Record<string, OutboxHandler> = {};

async function main(): Promise<void> {
  let config;
  try {
    config = loadWorkerConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const logger = pino({ level: config.logLevel });
  const pool = createPool(config, (err) => logger.error({ err }, "pg pool error"));

  const storage = createSupabaseStorageClient({ url: config.supabaseUrl, apiKey: config.supabaseSecretKey });
  let lastFilesRetention = 0;

  let stopping = false;
  let wake: (() => void) | undefined;
  const stop = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, "worker shutting down");
    wake?.();
    setTimeout(() => process.exit(1), 15_000).unref();
  };
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));

  logger.info("worker started");
  while (!stopping) {
    let processed = 0;
    try {
      processed = await runOutboxCycle(pool, handlers, logger, {
        batchSize: config.batchSize,
        shouldStop: () => stopping,
      });
    } catch (err) {
      logger.error({ err }, "outbox cycle failed");
    }
    if (!stopping && Date.now() - lastFilesRetention >= config.filesPurgeIntervalMs) {
      lastFilesRetention = Date.now();
      try {
        const purge = await runFilesRetentionCycle(pool, storage, logger, {
          batchSize: config.batchSize,
          shouldStop: () => stopping,
        });
        if (purge.scanned > 0) logger.info(purge, "files retention cycle");
      } catch (err) {
        logger.error({ err }, "files retention cycle failed");
      }
    }
    if (!stopping && processed === 0) {
      await new Promise<void>((resolve) => {
        wake = resolve;
        setTimeout(resolve, config.pollIntervalMs);
      });
    }
  }

  await pool.end();
  process.exit(0);
}

void main();
