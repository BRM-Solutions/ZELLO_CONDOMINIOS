import type { Request } from "express";
import { Pool, type PoolClient } from "pg";
import type { Config, WorkerConfig } from "./config";
import { authRequired } from "./http";

export type Db = Pick<Pool, "connect" | "query" | "end">;

export function createPool(config: Pick<Config | WorkerConfig, "databaseUrl">, onError: (err: Error) => void): Pool {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "app",
  });
  pool.on("error", onError);
  return pool;
}

export function getDb(req: Request): Db {
  return req.app.locals.db as Db;
}

interface TxOptions {
  readOnly?: boolean;
}

export async function runInTx<T>(
  db: Db,
  settings: Record<string, string>,
  fn: (client: PoolClient) => Promise<T>,
  options: TxOptions = {},
): Promise<T> {
  const client = await db.connect();
  let broken = false;
  try {
    await client.query(options.readOnly ? "begin read only" : "begin");
    for (const [name, value] of Object.entries(settings)) {
      await client.query("select set_config($1, $2, true)", [name, value]);
    }
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      broken = true;
    }
    throw err;
  } finally {
    client.release(broken);
  }
}

export function withTenantTx<T>(
  req: Request,
  fn: (client: PoolClient) => Promise<T>,
  options?: TxOptions,
): Promise<T> {
  if (!req.auth) throw authRequired();
  return runInTx(
    getDb(req),
    {
      "request.jwt.claim.sub": req.auth.userId,
      "app.org_id": req.membership?.organizationId ?? "",
      "app.request_id": String(req.id ?? ""),
    },
    fn,
    options,
  );
}

export function withWorkerTx<T>(
  db: Db,
  orgId: string | null,
  fn: (client: PoolClient) => Promise<T>,
  options?: TxOptions,
): Promise<T> {
  return runInTx(db, { "request.jwt.claim.sub": "", "app.org_id": orgId ?? "" }, fn, options);
}
