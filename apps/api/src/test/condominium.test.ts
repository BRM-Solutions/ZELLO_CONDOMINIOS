import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import { pino } from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorResponseSchema, personWithUnitsSchema, type Role } from "@app/shared";
import { REDACT_PATHS } from "../app";
import { loadConfig } from "../config";
import { decryptPii } from "../crypto/pii";
import { ORG_ID, WORKSPACE_ID, buildTestApp, testEnv } from "./helpers";

const WS_A2 = "44444444-4444-4444-8444-444444444444";
const WS_OTHER_ORG = "77777777-7777-4777-8777-777777777777";
const BLOCK_ID = "66666666-6666-4666-8666-666666666666";
const UNIT_ID = "88888888-8888-4888-8888-888888888888";
const PHONE_INPUT = "(21) 99876-5432";
const PHONE_DIGITS = "998765432";
const config = loadConfig(testEnv);

interface Scope {
  workspace_id: string | null;
  role: Role;
}

interface FakePerson {
  id: string;
  workspace_id: string;
  full_name: string;
  email: string;
  phone_enc: string | null;
  phone_hash: string | null;
  whatsapp_enc: string | null;
  photo_file_id: null;
  user_id: null;
  status: string;
  access_status: string;
  created_at: Date;
  updated_at: Date;
}

interface AuditRow {
  action: unknown;
  entityType: unknown;
  entityId: unknown;
  metadata: Record<string, unknown>;
}

function createDb(scopes: Scope[], options: { failInsertWith?: { code: string; constraint: string } } = {}) {
  const people = new Map<string, FakePerson>();
  const audit: AuditRow[] = [];
  const inserts: unknown[][] = [];
  const known = new Set([WORKSPACE_ID, WS_A2]);

  const responder = (sql: string, params: unknown[] = []) => {
    if (sql.includes("from app.memberships")) {
      return params[1] === ORG_ID ? { rows: scopes } : { rows: [] };
    }
    if (sql.includes("select 1 from app.workspaces")) {
      const ok = known.has(params[0] as string) && params[1] === ORG_ID;
      return { rows: ok ? [{ "?column?": 1 }] : [], rowCount: ok ? 1 : 0 };
    }
    if (sql.includes("insert into app.people")) {
      if (options.failInsertWith) throw Object.assign(new Error("duplicate key"), options.failInsertWith);
      inserts.push(params);
      const [, workspaceId, fullName, email, phoneEnc, phoneHash, whatsappEnc] = params as [
        string, string, string, string, string | null, string | null, string | null,
      ];
      const person: FakePerson = {
        id: randomUUID(),
        workspace_id: workspaceId,
        full_name: fullName,
        email,
        phone_enc: phoneEnc,
        phone_hash: phoneHash,
        whatsapp_enc: whatsappEnc,
        photo_file_id: null,
        user_id: null,
        status: "active",
        access_status: "none",
        created_at: new Date("2026-11-05T12:00:00Z"),
        updated_at: new Date("2026-11-05T12:00:00Z"),
      };
      people.set(person.id, person);
      return { rows: [{ id: person.id }] };
    }
    if (sql.includes("select phone_enc, whatsapp_enc from app.people")) {
      const person = people.get(params[0] as string);
      return { rows: person && person.workspace_id === params[2] ? [person] : [] };
    }
    if (sql.includes("from app.people where id = $1")) {
      const person = people.get(params[0] as string);
      return { rows: person && person.workspace_id === params[2] ? [person] : [] };
    }
    if (sql.includes("from app.unit_members um")) return { rows: [] };
    if (sql.includes("insert into app.audit_log")) {
      const [, , , action, entityType, entityId, , metadata] = params as unknown[];
      audit.push({ action, entityType, entityId, metadata: JSON.parse(String(metadata)) as Record<string, unknown> });
      return { rows: [] };
    }
    return undefined;
  };

  return { responder, people, audit, inserts };
}

async function setup(scopes: Scope[], options?: Parameters<typeof createDb>[1]) {
  const db = createDb(scopes, options);
  const built = await buildTestApp(db.responder);
  const token = await built.sign();
  const headers = { Authorization: `Bearer ${token}`, "X-Organization-Id": ORG_ID };
  return { ...built, db, headers };
}

const ws = (id = WORKSPACE_ID) => `/api/v1/workspaces/${id}`;
const as = (role: Role, workspace: string | null = WORKSPACE_ID): Scope[] => [{ workspace_id: workspace, role }];
const owner = as("owner", null);
const newPerson = { fullName: "Ana Souza", email: "Ana@Exemplo.com", phone: PHONE_INPUT, whatsapp: PHONE_INPUT };

function expectError(res: request.Response, status: number, code?: string) {
  expect(res.status).toBe(status);
  expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
  if (code) expect(res.body.error.code).toBe(code);
}

describe("validação (400)", () => {
  it("rejeita corpo inválido em pessoas, blocos, unidades, condomínio e vínculo", async () => {
    const { app, headers } = await setup(owner);
    const cases: Array<[string, string, unknown]> = [
      ["post", `${ws()}/people`, { fullName: "A", email: "x" }],
      ["post", `${ws()}/people`, { ...newPerson, phone: "123" }],
      ["post", `${ws()}/blocks`, { name: "" }],
      ["post", `${ws()}/units/batch`, { blockId: BLOCK_ID, numbers: Array.from({ length: 501 }, (_, i) => String(i)) }],
      ["post", `${ws()}/units`, { blockId: "x", number: "1" }],
      ["patch", ws(), { slug: "Slug Inválido" }],
      ["patch", ws(), {}],
      ["post", `${ws()}/unit-members/${UNIT_ID}/end`, { endsOn: "05/11/2026" }],
      ["post", "/api/v1/workspaces", { name: "Vila", slug: "ab", address: "Rua", city: "Rio", state: "RJ" }],
    ];
    for (const [method, url, body] of cases) {
      const res = await (request(app) as unknown as Record<string, (u: string) => request.Test>)[method]!(url)
        .set(headers)
        .send(body as object);
      expectError(res, 400, "VALIDATION_ERROR");
    }
  });

  it("rejeita id de pessoa malformado e filtro inválido", async () => {
    const { app, headers } = await setup(owner);
    expectError(await request(app).get(`${ws()}/people/nao-uuid`).set(headers), 400);
    expectError(await request(app).get(`${ws()}/people?relation=dependente`).set(headers), 400);
    expectError(await request(app).get(`${ws()}/units?blockId=1`).set(headers), 400);
  });
});

describe("autorização por condomínio", () => {
  it("council e staff leem a estrutura mas não veem nem alteram pessoas (403)", async () => {
    for (const role of ["council", "staff"] as const) {
      const { app, headers } = await setup(as(role));
      expect((await request(app).get(`${ws()}/blocks`).set(headers)).status).toBe(200);
      expect((await request(app).get(`${ws()}/units`).set(headers)).status).toBe(200);
      expectError(await request(app).get(`${ws()}/people`).set(headers), 403, "FORBIDDEN");
      expectError(await request(app).get(`${ws()}/people/${UNIT_ID}`).set(headers), 403);
      expectError(await request(app).post(`${ws()}/people`).set(headers).send(newPerson), 403);
      expectError(await request(app).post(`${ws()}/people/${UNIT_ID}/reveal-contact`).set(headers).send({ reason: "Motivo qualquer longo" }), 403);
      expectError(await request(app).post(`${ws()}/blocks`).set(headers).send({ name: "Bloco 1" }), 403);
      expectError(await request(app).post(`${ws()}/units/batch`).set(headers).send({ blockId: BLOCK_ID, numbers: ["1"] }), 403);
    }
  });

  it("member lê a estrutura mas não o diretório de pessoas", async () => {
    const { app, headers } = await setup(as("member"));
    expect((await request(app).get(`${ws()}/blocks`).set(headers)).status).toBe(200);
    expectError(await request(app).get(`${ws()}/people`).set(headers), 403);
    expectError(await request(app).patch(ws()).set(headers).send({ name: "Novo nome" }), 403);
  });

  it("manager de A1 acessa A1 e recebe 404 em A2 e em condomínio de outra organização", async () => {
    const { app, headers } = await setup(as("manager"));
    expect((await request(app).get(`${ws()}/people`).set(headers)).status).toBe(200);
    expectError(await request(app).get(`${ws(WS_A2)}/people`).set(headers), 404);
    expectError(await request(app).get(`${ws(WS_A2)}/blocks`).set(headers), 404);
    expectError(await request(app).post(`${ws(WS_A2)}/people`).set(headers).send(newPerson), 404);
    expectError(await request(app).get(`${ws(WS_OTHER_ORG)}/blocks`).set(headers), 404);
    expectError(await request(app).get(`${ws("nao-uuid")}/blocks`).set(headers), 404);
  });

  it("usa o papel do condomínio da rota, não o mais alto da organização", async () => {
    const { app, headers } = await setup([
      { workspace_id: WORKSPACE_ID, role: "council" },
      { workspace_id: WS_A2, role: "manager" },
    ]);
    expectError(await request(app).get(`${ws()}/people`).set(headers), 403);
    expect((await request(app).get(`${ws(WS_A2)}/people`).set(headers)).status).toBe(200);
  });

  it("owner/admin da organização acessam qualquer condomínio dela, não de outra", async () => {
    for (const role of ["owner", "admin"] as const) {
      const { app, headers } = await setup(as(role, null));
      expect((await request(app).get(`${ws()}/people`).set(headers)).status).toBe(200);
      expect((await request(app).get(`${ws(WS_A2)}/blocks`).set(headers)).status).toBe(200);
      expectError(await request(app).get(`${ws(WS_OTHER_ORG)}/people`).set(headers), 404);
    }
  });

  it("usuário sem vínculo com a organização recebe 404 em tudo", async () => {
    const { app, headers } = await setup([]);
    expectError(await request(app).get(`${ws()}/blocks`).set(headers), 404);
    expectError(await request(app).get("/api/v1/me/units").set(headers), 404);
  });

  it("POST /workspaces é só de owner/admin da organização", async () => {
    const body = { name: "Vila Gaudí", slug: "vila-gaudi", address: "Rua A, 10", city: "Rio de Janeiro", state: "RJ" };
    const manager = await setup(as("manager"));
    expectError(await request(manager.app).post("/api/v1/workspaces").set(manager.headers).send(body), 403);
    const council = await setup(as("council"));
    expectError(await request(council.app).post("/api/v1/workspaces").set(council.headers).send(body), 403);
  });

  it("GET /me/units é aberto a qualquer papel autenticado", async () => {
    const { app, headers } = await setup(as("member"));
    const res = await request(app).get("/api/v1/me/units").set(headers);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe("pessoas: cifragem e mascaramento", () => {
  it("cria pré-cadastro com telefone cifrado e responde mascarado", async () => {
    const { app, headers, db, queries } = await setup(as("manager"));
    const res = await request(app).post(`${ws()}/people`).set(headers).send(newPerson);

    expect(res.status).toBe(201);
    const person = personWithUnitsSchema.parse(res.body.data);
    expect(person).toMatchObject({
      email: "ana@exemplo.com",
      phoneMasked: "(21) •••••-5432",
      whatsappMasked: "(21) •••••-5432",
      accessStatus: "none",
    });
    expect(JSON.stringify(res.body)).not.toContain(PHONE_DIGITS);

    const stored = db.people.get(person.id);
    expect(stored?.phone_enc).toMatch(/^v1:/);
    expect(stored?.phone_enc).not.toContain(PHONE_DIGITS);
    expect(stored?.phone_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(decryptPii(stored?.phone_enc ?? "", config.dataEncryptionKey)).toBe("+5521998765432");

    const insertParams = JSON.stringify(db.inserts);
    expect(insertParams).not.toContain(PHONE_DIGITS);
    expect(queries.some((q) => JSON.stringify(q.params ?? []).includes(PHONE_DIGITS))).toBe(false);

    const created = db.audit.find((entry) => entry.action === "person.create");
    expect(created?.entityType).toBe("person");
    expect(JSON.stringify(created?.metadata)).not.toContain(PHONE_DIGITS);
    expect(JSON.stringify(created?.metadata)).not.toContain("exemplo.com");
  });

  it("e-mail repetido no condomínio vira 409", async () => {
    const { app, headers } = await setup(as("manager"), {
      failInsertWith: { code: "23505", constraint: "people_workspace_email_key" },
    });
    expectError(await request(app).post(`${ws()}/people`).set(headers).send(newPerson), 409, "PERSON_EMAIL_TAKEN");
  });

  it("a leitura devolve só a máscara e pessoa de outro condomínio é 404", async () => {
    const { app, headers, db } = await setup(as("admin", null));
    const created = await request(app).post(`${ws()}/people`).set(headers).send(newPerson);
    const id = created.body.data.id as string;

    const get = await request(app).get(`${ws()}/people/${id}`).set(headers);
    expect(get.status).toBe(200);
    expect(get.body.data.phoneMasked).toBe("(21) •••••-5432");
    expect(JSON.stringify(get.body)).not.toContain(PHONE_DIGITS);
    expect(db.audit.some((entry) => entry.action === "person.contact_reveal")).toBe(false);

    expectError(await request(app).get(`${ws(WS_A2)}/people/${id}`).set(headers), 404);
  });
});

describe("reveal-contact", () => {
  async function withPerson(scopes: Scope[]) {
    const ctx = await setup(scopes);
    const created = await request(ctx.app).post(`${ws()}/people`).set(ctx.headers).send(newPerson);
    return { ...ctx, id: created.body.data.id as string };
  }

  it("sem motivo ou com motivo curto = 400 e nada é auditado nem revelado", async () => {
    const { app, headers, db, id } = await withPerson(as("manager"));
    for (const body of [{}, { reason: "curto" }, { reason: "          " }]) {
      const res = await request(app).post(`${ws()}/people/${id}/reveal-contact`).set(headers).send(body);
      expectError(res, 400, "VALIDATION_ERROR");
      expect(JSON.stringify(res.body)).not.toContain(PHONE_DIGITS);
    }
    expect(db.audit.some((entry) => entry.action === "person.contact_reveal")).toBe(false);
  });

  it("com motivo revela o número completo e grava audit_log com o motivo", async () => {
    const { app, headers, db, id } = await withPerson(as("manager"));
    const res = await request(app)
      .post(`${ws()}/people/${id}/reveal-contact`)
      .set(headers)
      .send({ reason: "Contato sobre a assembleia" });

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.data).toEqual({ phone: "+5521998765432", whatsapp: "+5521998765432" });
    const entry = db.audit.find((e) => e.action === "person.contact_reveal");
    expect(entry).toMatchObject({ entityType: "person", entityId: id });
    expect(entry?.metadata).toMatchObject({ reason: "Contato sobre a assembleia", fields: ["phone", "whatsapp"] });
    expect(JSON.stringify(entry?.metadata)).not.toContain(PHONE_DIGITS);
  });

  it("pessoa inexistente ou de outro condomínio = 404 sem auditoria", async () => {
    const { app, headers, db } = await withPerson(as("manager"));
    const res = await request(app)
      .post(`${ws()}/people/${UNIT_ID}/reveal-contact`)
      .set(headers)
      .send({ reason: "Contato sobre a assembleia" });
    expectError(res, 404);
    expect(db.audit.some((entry) => entry.action === "person.contact_reveal")).toBe(false);
  });
});

describe("log", () => {
  it("redige e-mail, telefone e WhatsApp", () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const log = pino({ redact: REDACT_PATHS }, sink);
    log.info({ email: "ana@exemplo.com", person: { phone: PHONE_INPUT, whatsapp: PHONE_INPUT, email: "b@exemplo.com" } }, "x");
    log.error({ err: { message: "duplicate", detail: "Key (workspace_id, email)=(w, ana@exemplo.com) already exists." } }, "y");
    const output = lines.join("");
    expect(output).not.toContain("exemplo.com");
    expect(output).not.toContain(PHONE_DIGITS);
    expect(output).toContain("[Redacted]");
  });
});

describe("segredos de cifragem na config", () => {
  it("falha sem as chaves, com tamanho errado ou iguais, sem ecoar o valor", () => {
    const { DATA_ENCRYPTION_KEY: _a, ...semChaves } = testEnv;
    expect(() => loadConfig(semChaves)).toThrow(/DATA_ENCRYPTION_KEY/);
    const curta = Buffer.alloc(16, 1).toString("base64");
    expect(() => loadConfig({ ...testEnv, DATA_HASH_KEY: curta })).toThrow(/DATA_HASH_KEY/);
    try {
      loadConfig({ ...testEnv, DATA_HASH_KEY: curta });
    } catch (err) {
      expect((err as Error).message).not.toContain(curta);
    }
    expect(() => loadConfig({ ...testEnv, DATA_HASH_KEY: testEnv.DATA_ENCRYPTION_KEY })).toThrow(/diferente/);
  });
});
