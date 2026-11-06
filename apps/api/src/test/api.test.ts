import { SignJWT, generateKeyPair } from "jose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { workspaceSchema, errorResponseSchema, meResponseSchema, paginatedSchema } from "@app/shared";
import { WORKSPACE_ID, ISSUER, ORG_ID, OTHER_ORG_ID, USER_ID, WEB_ORIGIN, buildTestApp } from "./helpers";

const membershipRow = {
  id: "44444444-4444-4444-8444-444444444444",
  organization_id: ORG_ID,
  workspace_id: null,
  role: "manager",
};

const workspaceRow = {
  id: WORKSPACE_ID,
  organization_id: ORG_ID,
  name: "Residencial Exemplo",
  cnpj: null,
  city: "Sao Paulo",
  state: "SP",
  status: "active",
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-02T00:00:00Z"),
};

function responder(sql: string, params?: unknown[]) {
  if (sql.includes("from app.memberships") && sql.includes("organization_id = $2")) {
    return params?.[1] === ORG_ID ? { rows: [{ workspace_id: null, role: "manager" }] } : { rows: [] };
  }
  if (sql.includes("from app.memberships")) return { rows: [membershipRow] };
  if (sql.includes("count(*)")) return { rows: [{ total: 1 }] };
  if (sql.includes("from app.workspaces")) return { rows: [workspaceRow] };
  return undefined;
}

function expectStandardError(body: unknown, code: string) {
  expect(errorResponseSchema.safeParse(body).success).toBe(true);
  expect((body as { error: { code: string } }).error.code).toBe(code);
}

const asUser = (token: string, org: string | null = ORG_ID) => {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (org) headers["X-Organization-Id"] = org;
  return headers;
};

describe("authentication", () => {
  it("returns 401 in the standard format without a token", async () => {
    const { app } = await buildTestApp(responder);
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
    expectStandardError(res.body, "AUTH_REQUIRED");
  });

  it("returns 401 for a malformed token", async () => {
    const { app } = await buildTestApp(responder);
    const res = await request(app).get("/api/v1/me").set("Authorization", "Bearer not-a-jwt");
    expect(res.status).toBe(401);
    expectStandardError(res.body, "AUTH_INVALID");
  });

  it("returns 401 for an expired token", async () => {
    const { app, sign } = await buildTestApp(responder);
    const res = await request(app).get("/api/v1/me").set(asUser(await sign({}, { expiresIn: "-10m" }), null));
    expect(res.status).toBe(401);
    expectStandardError(res.body, "AUTH_INVALID");
  });

  it("returns 401 for a token signed by an unknown key", async () => {
    const { app } = await buildTestApp(responder);
    const { privateKey } = await generateKeyPair("ES256");
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setSubject(USER_ID)
      .setIssuer(ISSUER)
      .setAudience("authenticated")
      .setExpirationTime("5m")
      .sign(privateKey);
    const res = await request(app).get("/api/v1/me").set(asUser(forged, null));
    expect(res.status).toBe(401);
  });

  it("returns 401 for a wrong issuer or audience", async () => {
    const { app, sign } = await buildTestApp(responder);
    for (const options of [{ issuer: "https://evil.example.test/auth/v1" }, { audience: "anon" }]) {
      const res = await request(app).get("/api/v1/me").set(asUser(await sign({}, options), null));
      expect(res.status).toBe(401);
    }
  });
});

describe("GET /api/v1/me", () => {
  it("returns the user and memberships without requiring an organization", async () => {
    const { app, sign, queries } = await buildTestApp(responder);
    const res = await request(app).get("/api/v1/me").set(asUser(await sign(), null));
    expect(res.status).toBe(200);
    const body = meResponseSchema.parse(res.body);
    expect(body.data.id).toBe(USER_ID);
    expect(body.data.memberships).toEqual([
      { id: membershipRow.id, organizationId: ORG_ID, workspaceId: null, role: "manager" },
    ]);
    expect(body.meta?.requestId).toBeTruthy();
    const sqls = queries.map((q) => q.sql);
    expect(sqls[0]).toBe("begin read only");
    expect(sqls.at(-1)).toBe("commit");
  });
});

describe("GET /api/v1/workspaces", () => {
  it("lists with pagination inside a tenant transaction carrying user and organization", async () => {
    const { app, sign, queries, released } = await buildTestApp(responder);
    const res = await request(app).get("/api/v1/workspaces?page=1&pageSize=10").set(asUser(await sign()));
    expect(res.status).toBe(200);
    const body = paginatedSchema(workspaceSchema).parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(body.meta).toMatchObject({ page: 1, pageSize: 10, total: 1 });

    const settings = queries.filter((q) => q.sql.startsWith("select set_config"));
    const byName = (name: string) => settings.filter((q) => q.params?.[0] === name).map((q) => q.params?.[1]);
    expect(byName("request.jwt.claim.sub")).toEqual([USER_ID, USER_ID]);
    expect(byName("app.org_id")).toEqual(["", ORG_ID]);
    const listQuery = queries.find((q) => q.sql.includes("limit $2 offset $3"));
    expect(listQuery?.params).toEqual([ORG_ID, 10, 0]);
    expect(released()).toBe(2);
  });

  it("returns 400 when X-Organization-Id is missing or invalid", async () => {
    const { app, sign } = await buildTestApp(responder);
    for (const org of [null, "abc"]) {
      const res = await request(app).get("/api/v1/workspaces").set(asUser(await sign(), org));
      expect(res.status).toBe(400);
      expectStandardError(res.body, "VALIDATION_ERROR");
    }
  });

  it("returns 404 (not 403) for an organization where the user has no membership", async () => {
    const { app, sign } = await buildTestApp(responder);
    const res = await request(app).get("/api/v1/workspaces").set(asUser(await sign(), OTHER_ORG_ID));
    expect(res.status).toBe(404);
    expectStandardError(res.body, "NOT_FOUND");
  });

  it("returns 400 with issues for invalid pagination", async () => {
    const { app, sign } = await buildTestApp(responder);
    const res = await request(app).get("/api/v1/workspaces?pageSize=1000").set(asUser(await sign()));
    expect(res.status).toBe(400);
    expectStandardError(res.body, "VALIDATION_ERROR");
    expect(res.body.error.details.issues[0].path).toBe("pageSize");
  });

  it("rolls back and returns 500 in the standard format when a query fails", async () => {
    const { app, sign, queries } = await buildTestApp((sql, params) => {
      if (sql.includes("from app.workspaces")) throw new Error("db exploded");
      return responder(sql, params);
    });
    const res = await request(app).get("/api/v1/workspaces").set(asUser(await sign()));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" } });
    expect(queries.at(-1)?.sql).toBe("rollback");
  });
});

describe("errors, cors and webhooks", () => {
  it("returns 404 in the standard format for unknown routes", async () => {
    const { app } = await buildTestApp(responder);
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expectStandardError(res.body, "NOT_FOUND");
  });

  it("returns 400 INVALID_JSON for malformed bodies", async () => {
    const { app, sign } = await buildTestApp(responder);
    const res = await request(app)
      .post("/api/v1/workspaces")
      .set(asUser(await sign()))
      .set("Content-Type", "application/json")
      .send("{bad");
    expect(res.status).toBe(400);
    expectStandardError(res.body, "INVALID_JSON");
  });

  it("allows only configured origins and exposes X-Request-Id", async () => {
    const { app } = await buildTestApp(responder);
    const allowed = await request(app).get("/health").set("Origin", WEB_ORIGIN);
    expect(allowed.headers["access-control-allow-origin"]).toBe(WEB_ORIGIN);
    expect(allowed.headers["access-control-expose-headers"]).toContain("X-Request-Id");
    const denied = await request(app).get("/health").set("Origin", "https://evil.example.test");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  const adapter = {
    name: "fake",
    verify: (headers: Record<string, string | string[] | undefined>, raw: Buffer) =>
      headers["x-signature"] === "ok" && raw.length > 0,
    parse: (body: unknown) => [
      { providerEventId: String((body as { id: string }).id), organizationId: null, payload: { seen: true } },
    ],
  };

  it("webhooks authenticate by signature over the raw body, before JWT auth", async () => {
    const { app, queries } = await buildTestApp(responder, { fake: adapter });
    const rejected = await request(app).post("/api/v1/webhooks/fake").set("Content-Type", "application/json").send({ id: "e1" });
    expect(rejected.status).toBe(401);
    expectStandardError(rejected.body, "INVALID_WEBHOOK_SIGNATURE");

    const accepted = await request(app)
      .post("/api/v1/webhooks/fake")
      .set("X-Signature", "ok")
      .set("Content-Type", "application/json")
      .send({ id: "e1" });
    expect(accepted.status).toBe(200);
    const insert = queries.find((q) => q.sql.includes("insert into app.inbound_events"));
    expect(insert?.params?.slice(0, 2)).toEqual(["fake", "e1"]);
    expect(insert?.sql).toContain("on conflict do nothing");

    const unknown = await request(app).post("/api/v1/webhooks/other").set("Content-Type", "application/json").send({});
    expect(unknown.status).toBe(404);
  });
});
