import { randomUUID } from "node:crypto";
import { pino } from "pino";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { loadConfig } from "../config";
import { createPool, runInTx } from "../db";
import { createTestKeys, testEnv } from "./helpers";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
const enabled = Boolean(DATABASE_URL && ADMIN_URL);
const PHONE_DIGITS = "998765432";

type Role = "owner" | "admin" | "council" | "manager" | "staff" | "member";

// Banco dev real: cria dois tenants `test_*`, exercita a API de ponta a ponta e apaga tudo no afterAll.
describe.skipIf(!enabled)("estrutura do condomínio (banco dev)", () => {
  let admin: Pool;
  let appPool: Pool;
  let app: ReturnType<typeof createApp>;
  let sign: Awaited<ReturnType<typeof createTestKeys>>["sign"];

  const suffix = randomUUID().slice(0, 8);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userIds: string[] = [];
  const users = {} as Record<"adminA" | "mgrA1" | "mgrA2" | "councilA1" | "staffA1" | "memberA1" | "ownerB", string>;
  let wsA1 = "";
  let wsA2 = "";
  let wsB1 = "";

  async function newUser(key: keyof typeof users): Promise<string> {
    const id = randomUUID();
    await admin.query("insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)", [
      id,
      `test_${suffix}_${key}@example.test`,
    ]);
    userIds.push(id);
    users[key] = id;
    return id;
  }

  async function call(user: keyof typeof users, org: string, method: "get" | "post" | "patch", url: string, body?: object) {
    const token = await sign({ sub: users[user] });
    const req = request(app)[method](url).set({ Authorization: `Bearer ${token}`, "X-Organization-Id": org });
    return body ? req.send(body) : req;
  }

  async function grant(user: keyof typeof users, org: string, role: Role, workspace: string | null) {
    await admin.query(
      "insert into app.memberships (user_id, organization_id, workspace_id, role, status) values ($1, $2, $3, $4, 'active')",
      [users[user], org, workspace, role],
    );
  }

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL, max: 2 });
    const config = loadConfig({ ...testEnv, DATABASE_URL: DATABASE_URL as string });
    appPool = createPool(config, () => undefined);
    const keys = await createTestKeys();
    sign = keys.sign;
    app = createApp({ config, db: appPool, verifier: keys.verifier, logger: pino({ level: "silent" }) });

    await admin.query("insert into app.organizations (id, name) values ($1, $2), ($3, $4)", [
      orgA,
      `test_${suffix}_a`,
      orgB,
      `test_${suffix}_b`,
    ]);
    for (const key of ["adminA", "mgrA1", "mgrA2", "councilA1", "staffA1", "memberA1", "ownerB"] as const) await newUser(key);

    // Condomínios criados pela própria API (slug único por execução).
    await grant("adminA", orgA, "admin", null);
    const base = { address: "Rua Teste, 10", city: "Rio de Janeiro", state: "RJ" };
    const a1 = await call("adminA", orgA, "post", "/api/v1/workspaces", { ...base, name: "Teste A1", slug: `test-${suffix}-a1` });
    const a2 = await call("adminA", orgA, "post", "/api/v1/workspaces", { ...base, name: "Teste A2", slug: `test-${suffix}-a2` });
    wsA1 = a1.body.data?.id;
    wsA2 = a2.body.data?.id;
    await admin.query("insert into app.workspaces (id, organization_id, name, slug) values (gen_random_uuid(), $1, 'Teste B1', $2) returning id", [
      orgB,
      `test-${suffix}-b1`,
    ]).then((r) => (wsB1 = r.rows[0].id));

    await grant("mgrA1", orgA, "manager", wsA1);
    await grant("mgrA2", orgA, "manager", wsA2);
    await grant("councilA1", orgA, "council", wsA1);
    await grant("staffA1", orgA, "staff", wsA1);
    await grant("memberA1", orgA, "member", wsA1);
    await grant("ownerB", orgB, "owner", null);
  }, 60_000);

  afterAll(async () => {
    try {
      await admin.query("delete from app.organizations where id = any($1)", [[orgA, orgB]]);
      await admin.query("delete from auth.users where id = any($1)", [userIds]);
      const left = await admin.query(
        `select (select count(*) from app.workspaces where organization_id = any($1))::int as ws,
                (select count(*) from app.people where organization_id = any($1))::int as people,
                (select count(*) from auth.users where id = any($2))::int as users`,
        [[orgA, orgB], userIds],
      );
      expect(left.rows[0]).toEqual({ ws: 0, people: 0, users: 0 });
    } finally {
      await appPool.end();
      await admin.end();
    }
  }, 60_000);

  it("cria condomínio com slug único (409 no repetido)", async () => {
    const res = await call("adminA", orgA, "post", "/api/v1/workspaces", {
      name: "Outro",
      slug: `test-${suffix}-a1`,
      address: "Rua X",
      city: "Rio",
      state: "RJ",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SLUG_TAKEN");
    const patch = await call("adminA", orgA, "patch", `/api/v1/workspaces/${wsA1}`, { address: "Rua Nova, 20" });
    expect(patch.status).toBe(200);
    expect(patch.body.data.address).toBe("Rua Nova, 20");
  });

  let blockId = "";
  let unitIds: string[] = [];
  let personId = "";

  it("blocos, unidades em lote idempotente e unicidades", async () => {
    const b1 = await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/blocks`, { name: "Bloco 1" });
    expect(b1.status).toBe(201);
    blockId = b1.body.data.id;
    expect((await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/blocks`, { name: "BLOCO 1" })).status).toBe(409);
    expect((await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/blocks`, { name: "Bloco 2" })).status).toBe(201);

    const numbers = ["101", "102", "103", "201", "202", "203"];
    const first = await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/units/batch`, { blockId, numbers });
    expect(first.status).toBe(200);
    expect(first.body.data.created).toHaveLength(6);
    unitIds = first.body.data.created.map((u: { id: string }) => u.id);
    const again = await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/units/batch`, { blockId, numbers });
    expect(again.body.data.created).toHaveLength(0);
    expect(again.body.data.skipped).toHaveLength(6);

    const single = await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/units`, { blockId, number: "101" });
    expect(single.status).toBe(409);
    const list = await call("mgrA1", orgA, "get", `/api/v1/workspaces/${wsA1}/units?blockId=${blockId}`);
    expect(list.body.meta.total).toBe(6);
  });

  it("pré-cadastra pessoas com telefone cifrado, vínculo, encerramento e histórico", async () => {
    const body = {
      fullName: "Ana Souza",
      email: `ana_${suffix}@example.test`,
      phone: "(21) 99876-5432",
      whatsapp: "(21) 99876-5432",
      units: [{ unitId: unitIds[0], relation: "owner" }],
    };
    const created = await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/people`, body);
    expect(created.status).toBe(201);
    personId = created.body.data.id;
    expect(created.body.data.phoneMasked).toBe("(21) •••••-5432");
    expect(created.body.data.accessStatus).toBe("none");
    expect(JSON.stringify(created.body)).not.toContain(PHONE_DIGITS);

    const raw = await admin.query("select phone_enc, phone_hash, whatsapp_enc from app.people where id = $1", [personId]);
    expect(raw.rows[0].phone_enc).toMatch(/^v1:/);
    expect(JSON.stringify(raw.rows[0])).not.toContain(PHONE_DIGITS);

    const dup = await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/people`, { ...body, units: [] });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("PERSON_EMAIL_TAKEN");

    for (const [i, name] of ["Carlos Lima", "Beatriz Melo"].entries()) {
      const res = await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/people`, {
        fullName: name,
        email: `p${i}_${suffix}@example.test`,
        phone: "21998765432",
        units: [{ unitId: unitIds[i + 1], relation: "tenant" }],
      });
      expect(res.status).toBe(201);
    }

    const link = await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/people/${personId}/units`, {
      unitId: unitIds[0],
      relation: "resident",
    });
    expect(link.status).toBe(409);
    const second = await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/people/${personId}/units`, {
      unitId: unitIds[3],
      relation: "owner",
    });
    expect(second.status).toBe(201);
    const memberId = second.body.data.units.find((u: { unitId: string }) => u.unitId === unitIds[3]).id;

    const today = (await admin.query<{ d: string }>("select (now() at time zone 'America/Sao_Paulo')::date::text as d")).rows[0]!.d;
    const future = await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/unit-members/${memberId}/end`, { endsOn: "2999-01-01" });
    expect(future.status).toBe(400);
    const ended = await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/unit-members/${memberId}/end`, {
      endsOn: today,
    });
    expect(ended.status).toBe(200);
    expect(ended.body.data.endsOn).not.toBeNull();
    const badDate = await call("mgrA1", orgA, "post", `/api/v1/workspaces/${wsA1}/unit-members/${memberId}/end`, { endsOn: "2000-01-01" });
    expect([400, 409]).toContain(badDate.status);

    const detail = await call("mgrA1", orgA, "get", `/api/v1/workspaces/${wsA1}/people/${personId}`);
    expect(detail.body.data.units).toHaveLength(2);
    expect(detail.body.data.units.some((u: { endsOn: string | null }) => u.endsOn !== null)).toBe(true);
    const list = await call("mgrA1", orgA, "get", `/api/v1/workspaces/${wsA1}/people?name=ana&unitNumber=101`);
    expect(list.body.data.map((p: { id: string }) => p.id)).toEqual([personId]);
    expect(list.body.data[0].units).toHaveLength(1);
  });

  it("revela contato só com motivo e deixa rastro em audit_log", async () => {
    const url = `/api/v1/workspaces/${wsA1}/people/${personId}/reveal-contact`;
    expect((await call("mgrA1", orgA, "post", url, {})).status).toBe(400);
    const ok = await call("mgrA1", orgA, "post", url, { reason: "Contato sobre a assembleia" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.phone).toBe("+5521998765432");
    const audit = await admin.query(
      "select metadata from app.audit_log where organization_id = $1 and action = 'person.contact_reveal' and entity_id = $2",
      [orgA, personId],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].metadata.reason).toBe("Contato sobre a assembleia");
    expect(JSON.stringify(audit.rows[0].metadata)).not.toContain(PHONE_DIGITS);
  });

  it("papéis por condomínio: manager A1 x A2, council e staff sem pessoas, member sem diretório", async () => {
    expect((await call("mgrA1", orgA, "get", `/api/v1/workspaces/${wsA1}/people`)).status).toBe(200);
    expect((await call("mgrA1", orgA, "get", `/api/v1/workspaces/${wsA2}/people`)).status).toBe(404);
    expect((await call("mgrA1", orgA, "get", `/api/v1/workspaces/${wsA2}/blocks`)).status).toBe(404);
    expect((await call("mgrA2", orgA, "get", `/api/v1/workspaces/${wsA1}/blocks`)).status).toBe(404);
    for (const user of ["councilA1", "staffA1", "memberA1"] as const) {
      expect((await call(user, orgA, "get", `/api/v1/workspaces/${wsA1}/blocks`)).status).toBe(200);
      expect((await call(user, orgA, "get", `/api/v1/workspaces/${wsA1}/units`)).status).toBe(200);
      expect((await call(user, orgA, "get", `/api/v1/workspaces/${wsA1}/people`)).status).toBe(403);
      expect((await call(user, orgA, "post", `/api/v1/workspaces/${wsA1}/blocks`, { name: "Intruso" })).status).toBe(403);
    }
  });

  it("member vinculado enxerga só as próprias unidades em /me/units", async () => {
    expect((await call("memberA1", orgA, "get", "/api/v1/me/units")).body.data).toEqual([]);
    await admin.query("update app.people set user_id = $1, access_status = 'active' where id = $2", [users.memberA1, personId]);
    const mine = await call("memberA1", orgA, "get", "/api/v1/me/units");
    expect(mine.status).toBe(200);
    expect(mine.body.data.map((u: { unitId: string }) => u.unitId)).toEqual([unitIds[0]]);
  });

  it("outro tenant: todas as rotas de A retornam 404 e o banco não devolve nada", async () => {
    for (const org of [orgA, orgB]) {
      for (const path of ["blocks", "units", "people", `people/${personId}`]) {
        expect((await call("ownerB", org, "get", `/api/v1/workspaces/${wsA1}/${path}`)).status).toBe(404);
      }
      expect((await call("ownerB", org, "post", `/api/v1/workspaces/${wsA1}/people`, { fullName: "Intruso", email: "i@example.test" })).status).toBe(404);
      expect((await call("ownerB", org, "patch", `/api/v1/workspaces/${wsA1}`, { name: "Invadido" })).status).toBe(404);
    }
    expect((await call("ownerB", orgB, "get", `/api/v1/workspaces/${wsB1}/people`)).body.data).toEqual([]);

    const settings = { "request.jwt.claim.sub": users.ownerB, "app.org_id": orgA };
    const counts = await runInTx(appPool, settings, async (client) => {
      const rows = [];
      for (const table of ["blocks", "units", "people", "unit_members"]) {
        rows.push((await client.query(`select count(*)::int as n from app.${table}`)).rows[0].n);
      }
      return rows;
    });
    expect(counts).toEqual([0, 0, 0, 0]);
    await expect(
      runInTx(appPool, settings, (client) =>
        client.query("insert into app.blocks (organization_id, workspace_id, name) values ($1, $2, 'X')", [orgA, wsA1]),
      ),
    ).rejects.toThrow();
  });
});
