import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  completeFileResponseSchema,
  createFileResponseSchema,
  deleteFileResponseSchema,
  errorResponseSchema,
  fileUrlResponseSchema,
  type Role,
} from "@app/shared";
import { ORG_ID, OTHER_ORG_ID, USER_ID, WORKSPACE_ID, buildTestApp, createFakeStorage } from "./helpers";

interface FakeFile {
  id: string;
  organization_id: string;
  workspace_id: string | null;
  bucket: string;
  object_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string | null;
  classification: string;
  status: string;
  retention_until: Date | null;
  legal_hold: boolean;
  uploaded_by: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface AuditRow {
  organizationId: unknown;
  actorUserId: unknown;
  actorKind: unknown;
  action: unknown;
  entityId: unknown;
  metadata: Record<string, unknown>;
}

const OTHER_FILE_ID = "99999999-9999-4999-8999-999999999999";
const MB = 1024 * 1024;

function createFilesDb(options: { role?: Role; quotaBytes?: number | null; usedBytes?: number } = {}) {
  const files = new Map<string, FakeFile>();
  const audit: AuditRow[] = [];
  const role = options.role ?? "manager";
  let usedExtra = options.usedBytes ?? 0;

  const seed = (patch: Partial<FakeFile> & { id: string }): FakeFile => {
    const now = new Date("2026-01-01T00:00:00Z");
    const file: FakeFile = {
      organization_id: ORG_ID,
      workspace_id: WORKSPACE_ID,
      bucket: "private-files",
      object_path: `${ORG_ID}/${WORKSPACE_ID}/${patch.id}/seed.pdf`,
      original_name: "seed.pdf",
      mime_type: "application/pdf",
      size_bytes: 1000,
      sha256: null,
      classification: "internal",
      status: "available",
      retention_until: null,
      legal_hold: false,
      uploaded_by: USER_ID,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      ...patch,
    };
    files.set(file.id, file);
    return file;
  };

  const responder = (sql: string, params: unknown[] = []) => {
    if (sql.includes("from app.memberships")) {
      return params[1] === ORG_ID ? { rows: [{ workspace_id: null, role }] } : { rows: [] };
    }
    if (sql.includes("from app.workspaces")) {
      return params[0] === WORKSPACE_ID && params[1] === ORG_ID ? { rows: [{ "?column?": 1 }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("org_storage_used_bytes")) {
      const used = [...files.values()].filter((f) => f.status !== "deleted").reduce((sum, f) => sum + f.size_bytes, usedExtra);
      return { rows: [{ storage_quota_bytes: options.quotaBytes ?? null, used: String(used) }] };
    }
    if (sql.includes("insert into app.files")) {
      const [id, org, ws, bucket, path, name, mime, size, classification, uploader] = params as [
        string, string, string | null, string, string, string, string, number, string, string,
      ];
      const now = new Date();
      const file = seed({
        id,
        organization_id: org,
        workspace_id: ws,
        bucket,
        object_path: path,
        original_name: name,
        mime_type: mime,
        size_bytes: size,
        classification,
        status: "pending",
        uploaded_by: uploader,
        created_at: now,
        updated_at: now,
      });
      return { rows: [file] };
    }
    if (sql.includes("from app.files where id = $1 and organization_id = $2")) {
      const file = files.get(params[0] as string);
      return { rows: file && file.organization_id === params[1] ? [file] : [] };
    }
    if (sql.includes("update app.files set status = $2")) {
      const file = files.get(params[0] as string);
      if (!file || file.status !== "pending") return { rows: [] };
      Object.assign(file, { status: params[1], size_bytes: params[2], mime_type: params[3] });
      return { rows: [file] };
    }
    if (sql.includes("update app.files set status = 'deleted'")) {
      const file = files.get(params[0] as string);
      const blocked = !file || file.status === "deleted" || file.legal_hold || (file.retention_until && file.retention_until > new Date());
      if (blocked) return { rows: [] };
      Object.assign(file, { status: "deleted", deleted_at: new Date() });
      return { rows: [file] };
    }
    if (sql.includes("insert into app.audit_log")) {
      const [organizationId, actorUserId, actorKind, action, , entityId, , metadata] = params as unknown[];
      audit.push({
        organizationId,
        actorUserId,
        actorKind,
        action,
        entityId,
        metadata: JSON.parse(String(metadata)) as Record<string, unknown>,
      });
      return { rows: [] };
    }
    return undefined;
  };

  return { responder, files, audit, seed, addUsed: (bytes: number) => void (usedExtra += bytes) };
}

async function setup(options: Parameters<typeof createFilesDb>[0] = {}, env: Record<string, string> = {}) {
  const db = createFilesDb(options);
  const storage = createFakeStorage();
  const built = await buildTestApp(db.responder, undefined, storage.client, env);
  const token = await built.sign();
  const headers = { Authorization: `Bearer ${token}`, "X-Organization-Id": ORG_ID };
  return { ...built, db, storage, token, headers };
}

const validBody = {
  workspaceId: WORKSPACE_ID,
  originalName: "Relatório Anual 2026.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2048,
  classification: "confidential",
};

function expectError(res: request.Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
  expect(res.body.error.code).toBe(code);
}

describe("files: happy path", () => {
  it("runs init -> complete -> url -> delete with audit trail", async () => {
    const { app, headers, db, storage, token, queries } = await setup();

    const init = await request(app).post("/api/v1/files").set(headers).send(validBody);
    expect(init.status).toBe(201);
    const created = createFileResponseSchema.parse(init.body).data;
    expect(created.file.status).toBe("pending");
    expect(created.file.classification).toBe("confidential");
    const expectedPath = `${ORG_ID}/${WORKSPACE_ID}/${created.file.id}/Relatorio-Anual-2026.pdf`;
    expect(created.upload.path).toBe(expectedPath);
    expect(created.upload.url).toContain(expectedPath);
    expect(created.upload.token).toBe("up-token");
    expect(storage.calls[0]).toMatchObject({
      method: "createSignedUploadUrl",
      bucket: "private-files",
      paths: [expectedPath],
      auth: { accessToken: token },
    });
    expect(db.files.get(created.file.id)?.object_path).toBe(expectedPath);
    expect(db.files.get(created.file.id)?.original_name).toBe("Relatório Anual 2026.pdf");

    const insertIndex = queries.findIndex((q) => q.sql.includes("insert into app.files"));
    const lockIndex = queries.findIndex((q) => q.sql.includes("pg_advisory_xact_lock"));
    expect(lockIndex).toBeGreaterThan(-1);
    expect(lockIndex).toBeLessThan(insertIndex);

    storage.put("private-files", expectedPath, { sizeBytes: 2048, mimeType: "application/pdf" });
    const complete = await request(app).post(`/api/v1/files/${created.file.id}/complete`).set(headers);
    expect(complete.status).toBe(200);
    expect(completeFileResponseSchema.parse(complete.body).data.status).toBe("available");

    const url = await request(app).get(`/api/v1/files/${created.file.id}/url`).set(headers);
    expect(url.status).toBe(200);
    const link = fileUrlResponseSchema.parse(url.body).data;
    expect(link.expiresInSeconds).toBe(120);
    expect(link.url).toContain(expectedPath);
    const download = storage.calls.find((c) => c.method === "createSignedDownloadUrl");
    expect(download).toMatchObject({ ttl: 120, paths: [expectedPath], auth: { accessToken: token } });

    const del = await request(app).delete(`/api/v1/files/${created.file.id}`).set(headers);
    expect(del.status).toBe(200);
    expect(deleteFileResponseSchema.parse(del.body).data.status).toBe("deleted");
    expect(db.files.get(created.file.id)?.status).toBe("deleted");
    expect(storage.calls.some((c) => c.method === "removeObjects")).toBe(false);

    expect(db.audit.map((a) => a.action)).toEqual(["file.upload_init", "file.complete", "file.download", "file.delete"]);
    for (const entry of db.audit) {
      expect(entry).toMatchObject({ organizationId: ORG_ID, actorUserId: USER_ID, actorKind: "user", entityId: created.file.id });
      expect(JSON.stringify(entry.metadata)).not.toContain("Relat");
    }
  });

  it("honors a custom signed URL TTL", async () => {
    const { app, headers, db, storage } = await setup({}, { STORAGE_SIGNED_URL_TTL_SECONDS: "90" });
    db.seed({ id: OTHER_FILE_ID });
    const res = await request(app).get(`/api/v1/files/${OTHER_FILE_ID}/url`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.data.expiresInSeconds).toBe(90);
    expect(storage.calls[0]?.ttl).toBe(90);
  });

  it("uses the 'org' segment for organization-level files created by an admin", async () => {
    const { app, headers, storage } = await setup({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/files")
      .set(headers)
      .send({ ...validBody, workspaceId: undefined });
    expect(res.status).toBe(201);
    expect(res.body.data.upload.path).toMatch(new RegExp(`^${ORG_ID}/org/[0-9a-f-]{36}/Relatorio-Anual-2026\\.pdf$`));
    expect(storage.calls).toHaveLength(1);
  });
});

describe("files: authorization", () => {
  it("returns 403 for roles without the permission", async () => {
    const member = await setup({ role: "member" });
    expectError(await request(member.app).post("/api/v1/files").set(member.headers).send(validBody), 403, "FORBIDDEN");
    expectError(await request(member.app).post(`/api/v1/files/${OTHER_FILE_ID}/complete`).set(member.headers), 403, "FORBIDDEN");
    expectError(await request(member.app).delete(`/api/v1/files/${OTHER_FILE_ID}`).set(member.headers), 403, "FORBIDDEN");
    expect(member.storage.calls).toHaveLength(0);

    const staff = await setup({ role: "staff" });
    expectError(await request(staff.app).delete(`/api/v1/files/${OTHER_FILE_ID}`).set(staff.headers), 403, "FORBIDDEN");
  });

  it("lets members read but not write", async () => {
    const { app, headers, db } = await setup({ role: "member" });
    db.seed({ id: OTHER_FILE_ID });
    const res = await request(app).get(`/api/v1/files/${OTHER_FILE_ID}/url`).set(headers);
    expect(res.status).toBe(200);
  });

  it("requires authentication", async () => {
    const { app } = await setup();
    expectError(await request(app).post("/api/v1/files").send(validBody), 401, "AUTH_REQUIRED");
  });

  it("forbids workspace-less uploads for non org-wide roles", async () => {
    const { app, headers, storage } = await setup({ role: "manager" });
    const res = await request(app).post("/api/v1/files").set(headers).send({ ...validBody, workspaceId: null });
    expectError(res, 403, "FORBIDDEN");
    expect(storage.calls).toHaveLength(0);
  });

  it("returns 404 for a workspace the caller cannot see", async () => {
    const { app, headers, storage } = await setup();
    const res = await request(app)
      .post("/api/v1/files")
      .set(headers)
      .send({ ...validBody, workspaceId: "44444444-4444-4444-8444-444444444444" });
    expectError(res, 404, "NOT_FOUND");
    expect(storage.calls).toHaveLength(0);
  });

  it("maps a database RLS denial to 403", async () => {
    const db = createFilesDb();
    const denying = await buildTestApp((sql, params) => {
      if (sql.includes("insert into app.files")) throw Object.assign(new Error("rls"), { code: "42501" });
      return db.responder(sql, params);
    }, undefined, createFakeStorage().client);
    const token = await denying.sign();
    const res = await request(denying.app)
      .post("/api/v1/files")
      .set({ Authorization: `Bearer ${token}`, "X-Organization-Id": ORG_ID })
      .send(validBody);
    expectError(res, 403, "FORBIDDEN");
  });

  it("maps a Storage policy denial to 403 and other Storage failures to 502", async () => {
    const denied = await setup();
    denied.storage.state.failWith = 403;
    expectError(await request(denied.app).post("/api/v1/files").set(denied.headers).send(validBody), 403, "FORBIDDEN");
    const down = await setup();
    down.storage.state.failWith = 503;
    expectError(await request(down.app).post("/api/v1/files").set(down.headers).send(validBody), 502, "STORAGE_UNAVAILABLE");
  });
});

describe("files: validation", () => {
  it("rejects MIME types outside the allowlist with 422", async () => {
    const { app, headers, storage } = await setup();
    const res = await request(app)
      .post("/api/v1/files")
      .set(headers)
      .send({ ...validBody, mimeType: "application/x-msdownload" });
    expectError(res, 422, "FILE_TYPE_NOT_ALLOWED");
    expect(storage.calls).toHaveLength(0);
  });

  it("rejects files above FILE_MAX_BYTES with 422", async () => {
    const { app, headers } = await setup({}, { FILE_MAX_BYTES: String(MB) });
    expectError(await request(app).post("/api/v1/files").set(headers).send({ ...validBody, sizeBytes: MB + 1 }), 422, "FILE_TOO_LARGE");
    expect((await request(app).post("/api/v1/files").set(headers).send({ ...validBody, sizeBytes: MB })).status).toBe(201);
  });

  it("honors a custom FILE_ALLOWED_MIME", async () => {
    const { app, headers } = await setup({}, { FILE_ALLOWED_MIME: "image/png" });
    expectError(await request(app).post("/api/v1/files").set(headers).send(validBody), 422, "FILE_TYPE_NOT_ALLOWED");
    expect((await request(app).post("/api/v1/files").set(headers).send({ ...validBody, mimeType: "image/png" })).status).toBe(201);
  });

  it("returns 400 for malformed bodies and ids", async () => {
    const { app, headers } = await setup();
    for (const patch of [{ sizeBytes: 0 }, { sizeBytes: "10" }, { classification: "secret" }, { originalName: "" }, { mimeType: "pdf" }]) {
      expectError(await request(app).post("/api/v1/files").set(headers).send({ ...validBody, ...patch }), 400, "VALIDATION_ERROR");
    }
    expectError(await request(app).get("/api/v1/files/not-a-uuid/url").set(headers), 400, "VALIDATION_ERROR");
  });

  it("neutralizes path traversal in the original name", async () => {
    const { app, headers } = await setup();
    const res = await request(app)
      .post("/api/v1/files")
      .set(headers)
      .send({ ...validBody, originalName: "../../etc/passwd.pdf" });
    expect(res.status).toBe(201);
    expect(res.body.data.upload.path).toMatch(new RegExp(`^${ORG_ID}/${WORKSPACE_ID}/[0-9a-f-]{36}/passwd\\.pdf$`));
  });
});

describe("files: quota", () => {
  it("rejects an upload that would exceed the organization quota", async () => {
    const { app, headers, db } = await setup({ quotaBytes: 5000, usedBytes: 3000 });
    const res = await request(app).post("/api/v1/files").set(headers).send({ ...validBody, sizeBytes: 2001 });
    expectError(res, 422, "STORAGE_QUOTA_EXCEEDED");
    expect(res.body.error.details).toEqual({ quotaBytes: 5000, usedBytes: 3000, requestedBytes: 2001 });
    expect(db.files.size).toBe(0);
    expect(db.audit).toHaveLength(0);
  });

  it("accepts an upload that exactly fills the quota and counts pending files", async () => {
    const { app, headers } = await setup({ quotaBytes: 5000, usedBytes: 3000 });
    expect((await request(app).post("/api/v1/files").set(headers).send({ ...validBody, sizeBytes: 2000 })).status).toBe(201);
    expectError(await request(app).post("/api/v1/files").set(headers).send({ ...validBody, sizeBytes: 1 }), 422, "STORAGE_QUOTA_EXCEEDED");
  });

  it("does not enforce a quota when it is null", async () => {
    const { app, headers } = await setup({ quotaBytes: null, usedBytes: 10 ** 12 });
    expect((await request(app).post("/api/v1/files").set(headers).send(validBody)).status).toBe(201);
  });
});

describe("files: tenant isolation", () => {
  it("returns 404 for a file of another organization on every route", async () => {
    const { app, headers, db, storage } = await setup();
    db.seed({ id: OTHER_FILE_ID, organization_id: OTHER_ORG_ID });
    expectError(await request(app).get(`/api/v1/files/${OTHER_FILE_ID}/url`).set(headers), 404, "NOT_FOUND");
    expectError(await request(app).post(`/api/v1/files/${OTHER_FILE_ID}/complete`).set(headers), 404, "NOT_FOUND");
    expectError(await request(app).delete(`/api/v1/files/${OTHER_FILE_ID}`).set(headers), 404, "NOT_FOUND");
    expect(storage.calls).toHaveLength(0);
    expect(db.files.get(OTHER_FILE_ID)?.status).toBe("available");
  });

  it("returns 404 when the caller has no membership in the organization", async () => {
    const { app, token } = await setup();
    const res = await request(app).get(`/api/v1/files/${OTHER_FILE_ID}/url`).set({ Authorization: `Bearer ${token}`, "X-Organization-Id": OTHER_ORG_ID });
    expectError(res, 404, "NOT_FOUND");
  });

  it("treats deleted files as not found", async () => {
    const { app, headers, db } = await setup();
    db.seed({ id: OTHER_FILE_ID, status: "deleted", deleted_at: new Date() });
    expectError(await request(app).get(`/api/v1/files/${OTHER_FILE_ID}/url`).set(headers), 404, "NOT_FOUND");
    expectError(await request(app).delete(`/api/v1/files/${OTHER_FILE_ID}`).set(headers), 404, "NOT_FOUND");
  });
});

describe("files: complete", () => {
  async function pendingFile(size = 2048, mime = "application/pdf") {
    const ctx = await setup();
    const init = await request(ctx.app).post("/api/v1/files").set(ctx.headers).send({ ...validBody, sizeBytes: size, mimeType: mime });
    const { file, upload } = createFileResponseSchema.parse(init.body).data;
    return { ...ctx, id: file.id, path: upload.path };
  }

  it("returns 409 while the object is not uploaded yet", async () => {
    const { app, headers, id, db } = await pendingFile();
    expectError(await request(app).post(`/api/v1/files/${id}/complete`).set(headers), 409, "UPLOAD_MISSING");
    expect(db.files.get(id)?.status).toBe("pending");
  });

  it("quarantines when the stored size differs from the declared size", async () => {
    const { app, headers, id, path, storage, db } = await pendingFile(2048);
    storage.put("private-files", path, { sizeBytes: 9999, mimeType: "application/pdf" });
    const res = await request(app).post(`/api/v1/files/${id}/complete`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "quarantined", sizeBytes: 9999 });
    expect(db.audit.at(-1)?.metadata).toMatchObject({ status: "quarantined", reasons: ["size_mismatch"] });
  });

  it("quarantines when the stored MIME differs or is not allowed", async () => {
    const { app, headers, id, path, storage } = await pendingFile();
    storage.put("private-files", path, { sizeBytes: 2048, mimeType: "text/html; charset=utf-8" });
    const res = await request(app).post(`/api/v1/files/${id}/complete`).set(headers);
    expect(res.body.data.status).toBe("quarantined");
  });

  it("is not repeatable and never serves quarantined files", async () => {
    const { app, headers, id, path, storage } = await pendingFile();
    storage.put("private-files", path, { sizeBytes: 1, mimeType: "application/pdf" });
    expect((await request(app).post(`/api/v1/files/${id}/complete`).set(headers)).status).toBe(200);
    expectError(await request(app).post(`/api/v1/files/${id}/complete`).set(headers), 409, "FILE_NOT_PENDING");
    expectError(await request(app).get(`/api/v1/files/${id}/url`).set(headers), 409, "FILE_NOT_AVAILABLE");
  });

  it("lets only the uploader complete the upload", async () => {
    const { app, headers, id, path, storage, db } = await pendingFile();
    storage.put("private-files", path, { sizeBytes: 2048, mimeType: "application/pdf" });
    const file = db.files.get(id);
    if (file) file.uploaded_by = "88888888-8888-4888-8888-888888888888";
    expectError(await request(app).post(`/api/v1/files/${id}/complete`).set(headers), 403, "FORBIDDEN");
    expect(db.files.get(id)?.status).toBe("pending");
  });

  it("keeps the pending row (reserved quota, reconciled by the worker) when signing the upload fails", async () => {
    const ctx = await setup();
    ctx.storage.state.failWith = 503;
    expectError(await request(ctx.app).post("/api/v1/files").set(ctx.headers).send(validBody), 502, "STORAGE_UNAVAILABLE");
    expect([...ctx.db.files.values()].map((f) => f.status)).toEqual(["pending"]);
    const sqls = ctx.queries.map((q) => q.sql);
    expect(sqls.lastIndexOf("commit")).toBeGreaterThan(sqls.findIndex((s) => s.includes("insert into app.files")));
  });

  it("signs the upload only after the pending row is committed", async () => {
    const ctx = await setup();
    let committedBeforeSigning = false;
    const original = ctx.storage.client.createSignedUploadUrl;
    ctx.storage.client.createSignedUploadUrl = async (ref, auth) => {
      const sqls = ctx.queries.map((q) => q.sql);
      committedBeforeSigning = sqls.lastIndexOf("commit") > sqls.findIndex((s) => s.includes("insert into app.files"));
      return original(ref, auth);
    };
    expect((await request(ctx.app).post("/api/v1/files").set(ctx.headers).send(validBody)).status).toBe(201);
    expect(committedBeforeSigning).toBe(true);
  });

  it("does not hand out download URLs for pending files", async () => {
    const { app, headers, id } = await pendingFile();
    expectError(await request(app).get(`/api/v1/files/${id}/url`).set(headers), 409, "FILE_NOT_AVAILABLE");
  });
});

describe("files: governance on delete", () => {
  it("blocks deletion under legal hold with 409", async () => {
    const { app, headers, db } = await setup();
    db.seed({ id: OTHER_FILE_ID, legal_hold: true });
    expectError(await request(app).delete(`/api/v1/files/${OTHER_FILE_ID}`).set(headers), 409, "FILE_LEGAL_HOLD");
    expect(db.files.get(OTHER_FILE_ID)?.status).toBe("available");
    expect(db.audit).toHaveLength(0);
  });

  it("blocks deletion before retention_until with 409 and the date in details", async () => {
    const { app, headers, db } = await setup();
    const until = new Date(Date.now() + 86_400_000);
    db.seed({ id: OTHER_FILE_ID, retention_until: until });
    const res = await request(app).delete(`/api/v1/files/${OTHER_FILE_ID}`).set(headers);
    expectError(res, 409, "FILE_RETENTION_ACTIVE");
    expect(res.body.error.details).toEqual({ retentionUntil: until.toISOString() });
    expect(db.files.get(OTHER_FILE_ID)?.status).toBe("available");
  });

  it("allows deletion once the retention period has passed", async () => {
    const { app, headers, db } = await setup();
    db.seed({ id: OTHER_FILE_ID, retention_until: new Date(Date.now() - 1000) });
    const res = await request(app).delete(`/api/v1/files/${OTHER_FILE_ID}`).set(headers);
    expect(res.status).toBe(200);
    expect(db.audit.map((a) => a.action)).toEqual(["file.delete"]);
  });
});
