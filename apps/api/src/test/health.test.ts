import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp, createFakeDb } from "./helpers";

describe("health", () => {
  it("GET /health responds 200 without auth", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "{{SLUG}}-api" });
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("GET /ready checks the database", async () => {
    const { app, queries } = await buildTestApp();
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(queries.map((q) => q.sql)).toContain("select 1");
  });

  it("GET /ready returns 503 in the standard error format when the database is down", async () => {
    const { app } = await buildTestApp();
    const broken = createFakeDb();
    broken.db.query = (async () => {
      throw new Error("connection refused");
    }) as typeof broken.db.query;
    app.locals.db = broken.db;
    const res = await request(app).get("/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { code: "NOT_READY", message: "Banco de dados indisponível" } });
  });
});
