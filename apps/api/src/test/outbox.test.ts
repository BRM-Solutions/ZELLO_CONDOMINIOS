import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, UnknownOutcomeError, processItem, type OutboxItem } from "../jobs/outbox";
import { createFakeDb } from "./helpers";

const logger = pino({ level: "silent" });
const item = (attempts: number, eventType = "demo"): OutboxItem => ({
  id: "66666666-6666-4666-8666-666666666666",
  organizationId: "22222222-2222-4222-8222-222222222222",
  eventType,
  aggregateId: "77777777-7777-4777-8777-777777777777",
  payload: {},
  attempts,
});

async function run(attempts: number, handler: () => Promise<void>, eventType = "demo") {
  const { db, queries } = createFakeDb();
  await processItem(db, item(attempts, eventType), { demo: handler }, logger);
  const update = queries.find((q) => q.sql.includes("update app.outbox"));
  return { status: update?.params?.[1], error: update?.params?.[2], delay: update?.params?.[3] };
}

describe("outbox processing", () => {
  it("marks success as sent", async () => {
    expect((await run(1, async () => undefined)).status).toBe("sent");
  });

  it("retries with backoff on failure", async () => {
    const result = await run(2, async () => {
      throw new Error("provider down");
    });
    expect(result).toMatchObject({ status: "retry", error: "provider down", delay: 120 });
  });

  it("fails permanently after the maximum attempts", async () => {
    const result = await run(MAX_ATTEMPTS, async () => {
      throw new Error("still down");
    });
    expect(result.status).toBe("failed");
  });

  it("flags ambiguous outcomes as unknown instead of retrying", async () => {
    const result = await run(1, async () => {
      throw new UnknownOutcomeError();
    });
    expect(result.status).toBe("unknown");
  });

  it("fails items without a registered handler", async () => {
    expect((await run(1, async () => undefined, "other")).status).toBe("failed");
  });
});
