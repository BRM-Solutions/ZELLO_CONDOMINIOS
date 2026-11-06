import type { Logger } from "pino";
import { withWorkerTx, type Db } from "../db";

export interface OutboxItem {
  id: string;
  organizationId: string;
  eventType: string;
  aggregateId: string;
  payload: unknown;
  attempts: number;
}

export type OutboxHandler = (item: OutboxItem) => Promise<void>;

export class UnknownOutcomeError extends Error {
  constructor(message = "resultado ambíguo; exige revisão humana") {
    super(message);
    this.name = "UnknownOutcomeError";
  }
}

export const BACKOFF_SECONDS = [30, 120, 600, 3600, 21600];
export const MAX_ATTEMPTS = BACKOFF_SECONDS.length + 1;
const STUCK_AFTER_MINUTES = 10;

interface OutboxRow {
  id: string;
  organization_id: string;
  event_type: string;
  aggregate_id: string;
  payload: unknown;
  attempts: number;
}

export async function requeueStuck(db: Db): Promise<number> {
  return withWorkerTx(db, null, async (client) => {
    const result = await client.query(
      `update app.outbox set status = 'retry', updated_at = now()
        where status = 'processing' and updated_at < now() - make_interval(mins => $1)`,
      [STUCK_AFTER_MINUTES],
    );
    return result.rowCount ?? 0;
  });
}

export async function claimBatch(db: Db, size: number): Promise<OutboxItem[]> {
  return withWorkerTx(db, null, async (client) => {
    const result = await client.query<OutboxRow>(
      `update app.outbox set status = 'processing', attempts = attempts + 1, updated_at = now()
        where id in (
          select id from app.outbox
           where status in ('pending', 'retry') and next_attempt_at <= now()
           order by created_at
           limit $1
           for update skip locked
        )
        returning id, organization_id, event_type, aggregate_id, payload, attempts`,
      [size],
    );
    return result.rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      eventType: row.event_type,
      aggregateId: row.aggregate_id,
      payload: row.payload,
      attempts: row.attempts,
    }));
  });
}

async function finish(db: Db, item: OutboxItem, status: string, error: string | null, delaySeconds = 0): Promise<void> {
  await withWorkerTx(db, null, async (client) => {
    await client.query(
      `update app.outbox
          set status = $2, last_error = $3, next_attempt_at = now() + make_interval(secs => $4), updated_at = now()
        where id = $1`,
      [item.id, status, error, delaySeconds],
    );
  });
}

export async function processItem(
  db: Db,
  item: OutboxItem,
  handlers: Record<string, OutboxHandler>,
  logger: Logger,
): Promise<void> {
  const handler = handlers[item.eventType];
  if (!handler) {
    await finish(db, item, "failed", `sem handler para ${item.eventType}`);
    return;
  }
  try {
    await handler(item);
    await finish(db, item, "sent", null);
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : "erro desconhecido";
    if (err instanceof UnknownOutcomeError) {
      logger.warn({ outboxId: item.id }, "outbox outcome unknown");
      await finish(db, item, "unknown", message);
    } else if (item.attempts >= MAX_ATTEMPTS) {
      logger.error({ outboxId: item.id, err }, "outbox failed permanently");
      await finish(db, item, "failed", message);
    } else {
      logger.warn({ outboxId: item.id, attempts: item.attempts }, "outbox will retry");
      await finish(db, item, "retry", message, BACKOFF_SECONDS[item.attempts - 1] ?? 21600);
    }
  }
}

export async function runOutboxCycle(
  db: Db,
  handlers: Record<string, OutboxHandler>,
  logger: Logger,
  options: { batchSize: number; shouldStop: () => boolean },
): Promise<number> {
  await requeueStuck(db);
  const items = await claimBatch(db, options.batchSize);
  for (const item of items) {
    if (options.shouldStop()) break;
    await processItem(db, item, handlers, logger);
  }
  return items.length;
}
