import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { PENDING_TTL_HOURS, runFilesRetentionCycle } from "../jobs/files-retention";
import { ORG_ID, createFakeDb, createFakeStorage } from "./helpers";

const logger = pino({ level: "silent" });
const candidate = (n: number, reason: string) => ({
  id: `aaaaaaaa-0000-4000-8000-00000000000${n}`,
  organization_id: ORG_ID,
  bucket: "private-files",
  object_path: `${ORG_ID}/org/f${n}/file.pdf`,
  reason,
});

function setup(options: { candidates?: ReturnType<typeof candidate>[]; deleteMisses?: string[]; failDeleteFor?: string } = {}) {
  const candidates = options.candidates ?? [];
  const fake = createFakeDb((sql, params) => {
    if (sql.includes("from app.files") && sql.includes("limit $1")) return { rows: candidates };
    if (sql.includes("delete from app.files")) {
      const id = String(params?.[0]);
      if (id === options.failDeleteFor) throw new Error("db down");
      if (options.deleteMisses?.includes(id)) return { rows: [] };
      const found = candidates.find((c) => c.id === id);
      return { rows: found ? [{ bucket: found.bucket, object_path: found.object_path }] : [] };
    }
    return undefined;
  });
  const storage = createFakeStorage();
  for (const c of candidates) storage.put(c.bucket, c.object_path, { sizeBytes: 1, mimeType: "application/pdf" });
  return { ...fake, storage };
}

const run = (ctx: ReturnType<typeof setup>) =>
  runFilesRetentionCycle(ctx.db, ctx.storage.client, logger, { batchSize: 20, shouldStop: () => false });

describe("files retention job", () => {
  it("removes the object and the row, auditing each purge as the worker", async () => {
    const list = [candidate(1, "deleted"), candidate(2, "retention_expired"), candidate(3, "pending_expired")];
    const ctx = setup({ candidates: list });
    const result = await run(ctx);
    expect(result).toEqual({ scanned: 3, purged: 3, failed: 0 });
    for (const c of list) expect(ctx.storage.has(c.bucket, c.object_path)).toBe(false);
    const removals = ctx.storage.calls.filter((c) => c.method === "removeObjects");
    expect(removals.map((c) => c.paths[0])).toEqual(list.map((c) => c.object_path));
    expect(removals.every((c) => c.auth.accessToken === undefined)).toBe(true);

    const audits = ctx.queries.filter((q) => q.sql.includes("insert into app.audit_log"));
    expect(audits).toHaveLength(3);
    expect(audits.map((q) => q.params?.slice(1, 5))).toEqual(list.map(() => [null, "worker", "file.purge", "file"]));
    expect(audits.map((q) => JSON.parse(String(q.params?.[7])).reason)).toEqual(["deleted", "retention_expired", "pending_expired"]);
  });

  it("deletes the row before the object removal inside one transaction, scoped to the organization", async () => {
    const ctx = setup({ candidates: [candidate(1, "deleted")] });
    await run(ctx);
    const sqls = ctx.queries.map((q) => q.sql);
    const purgeTx = sqls.lastIndexOf("begin");
    const deleteIdx = sqls.findIndex((s) => s.includes("delete from app.files"));
    const auditIdx = sqls.findIndex((s) => s.includes("insert into app.audit_log"));
    expect(deleteIdx).toBeGreaterThan(purgeTx);
    expect(auditIdx).toBeGreaterThan(deleteIdx);
    expect(sqls.at(-1)).toBe("commit");
    const orgSetting = ctx.queries.filter((q) => q.params?.[0] === "app.org_id").map((q) => q.params?.[1]);
    expect(orgSetting).toEqual(["", ORG_ID]);
    const deleteQuery = ctx.queries.find((q) => q.sql.includes("delete from app.files"));
    expect(deleteQuery?.sql).toContain("legal_hold = false");
    expect(deleteQuery?.params).toEqual([candidate(1, "deleted").id, PENDING_TTL_HOURS, ORG_ID]);
  });

  it("never removes the object when the guarded delete matches no row (legal hold applied meanwhile)", async () => {
    const list = [candidate(1, "deleted")];
    const ctx = setup({ candidates: list, deleteMisses: [list[0]?.id ?? ""] });
    const result = await run(ctx);
    expect(result).toEqual({ scanned: 1, purged: 0, failed: 0 });
    expect(ctx.storage.calls.filter((c) => c.method === "removeObjects")).toHaveLength(0);
    expect(ctx.storage.has(list[0]?.bucket ?? "", list[0]?.object_path ?? "")).toBe(true);
  });

  it("rolls back and keeps going when the Storage removal fails", async () => {
    const list = [candidate(1, "deleted"), candidate(2, "deleted")];
    const ctx = setup({ candidates: list });
    ctx.storage.state.failWith = 503;
    const failing = await run(ctx);
    expect(failing).toEqual({ scanned: 2, purged: 0, failed: 2 });
    expect(ctx.queries.some((q) => q.sql === "rollback")).toBe(true);
    expect(ctx.queries.some((q) => q.sql.includes("insert into app.audit_log"))).toBe(false);

    ctx.storage.state.failWith = undefined;
    expect(await run(ctx)).toEqual({ scanned: 2, purged: 2, failed: 0 });
  });

  it("counts a database failure as failed without stopping the batch", async () => {
    const list = [candidate(1, "deleted"), candidate(2, "deleted")];
    const ctx = setup({ candidates: list, failDeleteFor: list[0]?.id });
    expect(await run(ctx)).toEqual({ scanned: 2, purged: 1, failed: 1 });
  });

  it("does nothing when there are no candidates and honors shouldStop", async () => {
    const empty = setup();
    expect(await run(empty)).toEqual({ scanned: 0, purged: 0, failed: 0 });
    const ctx = setup({ candidates: [candidate(1, "deleted")] });
    const result = await runFilesRetentionCycle(ctx.db, ctx.storage.client, logger, { batchSize: 5, shouldStop: () => true });
    expect(result.purged).toBe(0);
  });

  it("selects only unheld, due rows using the pending TTL", async () => {
    const ctx = setup();
    await run(ctx);
    const select = ctx.queries.find((q) => q.sql.includes("limit $1"));
    expect(select?.sql).toContain("legal_hold = false");
    expect(select?.sql).toContain("retention_until <= now()");
    expect(select?.params).toEqual([20, 24]);
    expect(PENDING_TTL_HOURS).toBe(24);
  });
});
