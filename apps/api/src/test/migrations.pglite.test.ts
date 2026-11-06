import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = join(__dirname, "../../../../supabase");
const migrations = readdirSync(join(root, "migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(root, "migrations", file), "utf8"));
const catalogSql = readFileSync(join(root, "tests/catalog.sql"), "utf8");

const stub = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  end $$;
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key);
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create schema if not exists storage;
  create table if not exists storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text
  );
  alter table storage.objects enable row level security;
  grant usage on schema auth, storage to authenticated;
  grant execute on function auth.uid() to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
`;

const ORG_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ORG_B = "bbbbbbbb-0000-4000-8000-000000000002";
const WS_A1 = "aaaaaaaa-0000-4000-8000-0000000000a1";
const WS_A2 = "aaaaaaaa-0000-4000-8000-0000000000a2";
const WS_B1 = "bbbbbbbb-0000-4000-8000-0000000000b1";
const U_OWNER = "00000000-0000-4000-8000-0000000000e1";
const U_MANAGER = "00000000-0000-4000-8000-0000000000e2";
const U_STAFF = "00000000-0000-4000-8000-0000000000e3";
const U_MEMBER = "00000000-0000-4000-8000-0000000000e4";
const U_OWNER_B = "00000000-0000-4000-8000-0000000000e5";
const U_REVOKED = "00000000-0000-4000-8000-0000000000e6";
const FILE_A1 = "ffffffff-0000-4000-8000-0000000000a1";
const FILE_A2 = "ffffffff-0000-4000-8000-0000000000a2";
const FILE_AORG = "ffffffff-0000-4000-8000-0000000000a3";
const FILE_B1 = "ffffffff-0000-4000-8000-0000000000b1";

let db: PGlite;

async function applyAll(): Promise<void> {
  for (const sql of migrations) await db.exec(sql);
}

async function as<T>(role: string, user: string | null, org: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('app.org_id', $2, false)", [
    user ?? "",
    org ?? "",
  ]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

async function ids(sql: string, params: unknown[] = []): Promise<string[]> {
  const res = await db.query<{ id: string }>(sql, params);
  return res.rows.map((row) => row.id).sort();
}

async function allowed(user: string | null, name: string, mode: string): Promise<boolean> {
  return as("authenticated", user, null, async () => {
    const res = await db.query<{ ok: boolean }>("select app.can_access_object($1, $2) as ok", [name, mode]);
    return res.rows[0]?.ok ?? false;
  });
}

async function fails(role: string, user: string | null, org: string | null, sql: string, params: unknown[] = []) {
  return as(role, user, org, async () => {
    try {
      await db.query(sql, params);
      return false;
    } catch {
      return true;
    }
  });
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(stub);
  await applyAll();
  await applyAll();

  await db.exec(`
    insert into auth.users (id) values
      ('${U_OWNER}'), ('${U_MANAGER}'), ('${U_STAFF}'), ('${U_MEMBER}'), ('${U_OWNER_B}'), ('${U_REVOKED}');
    insert into app.organizations (id, name) values ('${ORG_A}', 'test_org_a'), ('${ORG_B}', 'test_org_b');
    insert into app.workspaces (id, organization_id, name) values
      ('${WS_A1}', '${ORG_A}', 'Workspace A1'), ('${WS_A2}', '${ORG_A}', 'Workspace A2'), ('${WS_B1}', '${ORG_B}', 'Workspace B1');
    insert into app.memberships (user_id, organization_id, workspace_id, role, status) values
      ('${U_OWNER}', '${ORG_A}', null, 'owner', 'active'),
      ('${U_MANAGER}', '${ORG_A}', '${WS_A1}', 'manager', 'active'),
      ('${U_STAFF}', '${ORG_A}', '${WS_A2}', 'staff', 'active'),
      ('${U_MEMBER}', '${ORG_A}', '${WS_A1}', 'member', 'active'),
      ('${U_OWNER_B}', '${ORG_B}', null, 'owner', 'active'),
      ('${U_REVOKED}', '${ORG_A}', '${WS_A1}', 'manager', 'revoked');
    insert into app.files (id, organization_id, workspace_id, object_path, original_name, mime_type, size_bytes, status, uploaded_by) values
      ('${FILE_A1}', '${ORG_A}', '${WS_A1}', '${ORG_A}/${WS_A1}/${FILE_A1}/a1.pdf', 'a1.pdf', 'application/pdf', 100, 'available', '${U_OWNER}'),
      ('${FILE_A2}', '${ORG_A}', '${WS_A2}', '${ORG_A}/${WS_A2}/${FILE_A2}/a2.pdf', 'a2.pdf', 'application/pdf', 200, 'available', '${U_OWNER}'),
      ('${FILE_AORG}', '${ORG_A}', null, '${ORG_A}/org/${FILE_AORG}/org.pdf', 'org.pdf', 'application/pdf', 300, 'available', '${U_OWNER}'),
      ('${FILE_B1}', '${ORG_B}', '${WS_B1}', '${ORG_B}/${WS_B1}/${FILE_B1}/b1.pdf', 'b1.pdf', 'application/pdf', 400, 'available', '${U_OWNER_B}');
  `);
}, 120_000);

afterAll(async () => {
  await db.close();
});

describe("files migration (PGlite)", () => {
  it("is idempotent: base + files migration applied twice without error", async () => {
    await expect(applyAll()).resolves.toBeUndefined();
  });

  it("catalog.sql returns zero rows", async () => {
    const res = await db.query(catalogSql);
    expect(res.rows).toEqual([]);
  });

  it("creates the private bucket idempotently with limits and mime allowlist", async () => {
    const res = await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'private-files'",
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]?.public).toBe(false);
    expect(Number(res.rows[0]?.file_size_limit)).toBe(52428800);
    expect(res.rows[0]?.allowed_mime_types).toContain("application/pdf");
  });

  it("has RLS enabled and policies on app.files", async () => {
    const rls = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'app.files'::regclass",
    );
    expect(rls.rows[0]?.relrowsecurity).toBe(true);
    const policies = await db.query<{ policyname: string }>(
      "select policyname from pg_policies where schemaname = 'app' and tablename = 'files' order by policyname",
    );
    expect(policies.rows.map((row) => row.policyname)).toEqual([
      "files_delete_worker",
      "files_insert",
      "files_select",
      "files_select_worker",
      "files_update",
    ]);
  });

  it("cascades files when the organization is deleted", async () => {
    await db.exec(`
      insert into app.organizations (id, name) values ('cccccccc-0000-4000-8000-000000000003', 'test_cascade');
      insert into app.files (organization_id, object_path, original_name, mime_type, size_bytes, uploaded_by)
        values ('cccccccc-0000-4000-8000-000000000003', 'x/org/y/z.pdf', 'z.pdf', 'application/pdf', 1, '${U_OWNER}');
      delete from app.organizations where id = 'cccccccc-0000-4000-8000-000000000003';
    `);
    const res = await db.query("select 1 from app.files where object_path = 'x/org/y/z.pdf'");
    expect(res.rows).toHaveLength(0);
  });

  it("rejects invalid classification, status and inconsistent deleted_at", async () => {
    const base = `insert into app.files (organization_id, object_path, original_name, mime_type, size_bytes, uploaded_by`;
    const vals = `'${ORG_A}', 'p/org/${crypto.randomUUID()}/n.pdf', 'n.pdf', 'application/pdf', 1, '${U_OWNER}'`;
    await expect(db.query(`${base}, classification) values (${vals}, 'secret')`)).rejects.toThrow();
    await expect(db.query(`${base}, status) values (${vals}, 'weird')`)).rejects.toThrow();
    await expect(db.query(`${base}, status) values (${vals}, 'deleted')`)).rejects.toThrow();
  });

  it("isolates files between organizations", async () => {
    const a = await as("app_api", U_OWNER, ORG_A, () => ids("select id from app.files"));
    expect(a).toEqual([FILE_A1, FILE_A2, FILE_AORG].sort());
    const b = await as("app_api", U_OWNER_B, ORG_B, () => ids("select id from app.files"));
    expect(b).toEqual([FILE_B1]);
    const cross = await as("app_api", U_OWNER_B, ORG_A, () => ids("select id from app.files"));
    expect(cross).toEqual([]);
  });

  it("restricts a workspace-scoped manager to their workspace and hides org-level files", async () => {
    const manager = await as("app_api", U_MANAGER, ORG_A, () => ids("select id from app.files"));
    expect(manager).toEqual([FILE_A1]);
    const member = await as("app_api", U_MEMBER, ORG_A, () => ids("select id from app.files"));
    expect(member).toEqual([FILE_A1]);
    const revoked = await as("app_api", U_REVOKED, ORG_A, () => ids("select id from app.files"));
    expect(revoked).toEqual([]);
  });

  it("returns zero rows without context and denies anon/authenticated", async () => {
    expect(await as("app_api", null, null, () => ids("select id from app.files"))).toEqual([]);
    expect(await as("app_api", U_OWNER, null, () => ids("select id from app.files"))).toEqual([]);
    expect(await fails("anon", null, null, "select id from app.files")).toBe(true);
    expect(await fails("authenticated", U_OWNER, ORG_A, "select id from app.files")).toBe(true);
    expect(await fails("authenticated", U_OWNER, ORG_A, "insert into app.organizations (name) values ('xx')")).toBe(true);
  });

  it("insert is limited to write roles in their scope, as pending, by the caller", async () => {
    const insert = (user: string, org: string, ws: string | null, status = "pending", uploader = user) =>
      fails(
        "app_api",
        user,
        org,
        `insert into app.files (organization_id, workspace_id, object_path, original_name, mime_type, size_bytes, status, uploaded_by)
         values ($1, $2, $3, 'n.pdf', 'application/pdf', 1, $4, $5)`,
        [org, ws, `${org}/${ws ?? "org"}/${crypto.randomUUID()}/n.pdf`, status, uploader],
      );
    expect(await insert(U_STAFF, ORG_A, WS_A2)).toBe(false);
    expect(await insert(U_MANAGER, ORG_A, WS_A1)).toBe(false);
    expect(await insert(U_OWNER, ORG_A, null)).toBe(false);
    expect(await insert(U_MEMBER, ORG_A, WS_A1)).toBe(true);
    expect(await insert(U_STAFF, ORG_A, WS_A1)).toBe(true);
    expect(await insert(U_MANAGER, ORG_A, null)).toBe(true);
    expect(await insert(U_OWNER_B, ORG_A, WS_A1)).toBe(true);
    expect(await insert(U_OWNER, ORG_A, WS_A1, "available")).toBe(true);
    expect(await insert(U_OWNER, ORG_A, WS_A1, "pending", U_STAFF)).toBe(true);
  });

  it("update: staff can complete but only delete roles can mark as deleted; api has no physical delete", async () => {
    const complete = `update app.files set status = 'quarantined' where id = $1`;
    const softDelete = `update app.files set status = 'deleted', deleted_at = now() where id = $1`;
    const touched = (user: string, sql: string, id: string) =>
      as("app_api", user, ORG_A, async () => (await db.query(sql, [id])).affectedRows ?? 0);
    expect(await touched(U_STAFF, complete, FILE_A2)).toBe(1);
    await db.query("update app.files set status = 'available' where id = $1", [FILE_A2]);
    expect(await fails("app_api", U_STAFF, ORG_A, softDelete, [FILE_A2])).toBe(true);
    expect(await touched(U_MEMBER, complete, FILE_A1)).toBe(0);
    expect(await touched(U_MANAGER, softDelete, FILE_A2)).toBe(0);
    expect(await fails("app_api", U_OWNER, ORG_A, "update app.files set legal_hold = true where id = $1", [FILE_A2])).toBe(true);
    expect(await fails("app_api", U_OWNER, ORG_A, "delete from app.files where id = $1", [FILE_A2])).toBe(true);
    expect(await touched(U_MANAGER, softDelete, FILE_A1)).toBe(1);
    await db.query("update app.files set status = 'available', deleted_at = null where id = $1", [FILE_A1]);
  });

  it("blocks marking as deleted a file under legal hold or inside retention, even for delete roles", async () => {
    const softDelete = `update app.files set status = 'deleted', deleted_at = now() where id = $1`;
    const mkRow = async (hold: boolean, retention: string | null) => {
      const id = crypto.randomUUID();
      await db.query(
        `insert into app.files (id, organization_id, workspace_id, object_path, original_name, mime_type, size_bytes, status, uploaded_by, legal_hold, retention_until)
         values ($1, $2, $3, $4, 'g.pdf', 'application/pdf', 1, 'available', $5, $6, $7)`,
        [id, ORG_A, WS_A1, `${ORG_A}/${WS_A1}/${id}/g.pdf`, U_OWNER, hold, retention],
      );
      return id;
    };
    const held = await mkRow(true, null);
    const retained = await mkRow(false, "2999-01-01T00:00:00Z");
    const elapsed = await mkRow(false, "2000-01-01T00:00:00Z");
    for (const user of [U_OWNER, U_MANAGER]) {
      expect(await fails("app_api", user, ORG_A, softDelete, [held])).toBe(true);
      expect(await fails("app_api", user, ORG_A, softDelete, [retained])).toBe(true);
    }
    expect(await fails("app_api", U_OWNER, ORG_A, "update app.files set legal_hold = false where id = $1", [held])).toBe(true);
    expect(await fails("app_api", U_OWNER, ORG_A, "delete from app.files where id = $1", [held])).toBe(true);
    const state = await db.query<{ status: string }>("select status from app.files where id = any($1)", [[held, retained]]);
    expect(state.rows.map((row) => row.status)).toEqual(["available", "available"]);
    expect(await fails("app_api", U_MANAGER, ORG_A, softDelete, [elapsed])).toBe(false);
  });

  it("org_storage_used_bytes sums the whole organization regardless of workspace scope", async () => {
    const used = await as("app_api", U_MANAGER, ORG_A, async () => {
      const res = await db.query<{ used: string }>("select app.org_storage_used_bytes() as used");
      return Number(res.rows[0]?.used);
    });
    const total = await db.query<{ total: string }>(
      `select sum(size_bytes) as total from app.files where organization_id = '${ORG_A}' and status <> 'deleted'`,
    );
    expect(used).toBe(Number(total.rows[0]?.total));
    expect(used).toBeGreaterThanOrEqual(600);
    const none = await as("app_api", U_OWNER_B, ORG_A, async () => {
      const res = await db.query<{ used: string }>("select app.org_storage_used_bytes() as used");
      return Number(res.rows[0]?.used);
    });
    expect(none).toBe(0);
  });

  it("worker deletes only purgeable rows of its organization context", async () => {
    await db.exec(`
      insert into app.files (id, organization_id, object_path, original_name, mime_type, size_bytes, status, deleted_at, uploaded_by, legal_hold, retention_until)
      values
        ('ffffffff-0000-4000-8000-0000000000d1', '${ORG_A}', 'w/org/d1/a.pdf', 'a.pdf', 'application/pdf', 1, 'deleted', now(), '${U_OWNER}', false, null),
        ('ffffffff-0000-4000-8000-0000000000d2', '${ORG_A}', 'w/org/d2/a.pdf', 'a.pdf', 'application/pdf', 1, 'deleted', now(), '${U_OWNER}', true, null),
        ('ffffffff-0000-4000-8000-0000000000d3', '${ORG_A}', 'w/org/d3/a.pdf', 'a.pdf', 'application/pdf', 1, 'deleted', now(), '${U_OWNER}', false, now() + interval '1 day'),
        ('ffffffff-0000-4000-8000-0000000000d4', '${ORG_A}', 'w/org/d4/a.pdf', 'a.pdf', 'application/pdf', 1, 'available', null, '${U_OWNER}', false, now() - interval '1 day'),
        ('ffffffff-0000-4000-8000-0000000000d5', '${ORG_A}', 'w/org/d5/a.pdf', 'a.pdf', 'application/pdf', 1, 'available', null, '${U_OWNER}', false, null);
      insert into app.files (id, organization_id, object_path, original_name, mime_type, size_bytes, status, uploaded_by, created_at)
      values ('ffffffff-0000-4000-8000-0000000000d6', '${ORG_A}', 'w/org/d6/a.pdf', 'a.pdf', 'application/pdf', 1, 'pending', '${U_OWNER}', now() - interval '25 hours');
    `);
    const scanned = await as("app_worker", null, null, () => ids("select id from app.files where object_path like 'w/%'"));
    expect(scanned).toHaveLength(6);
    const wrongOrg = await as("app_worker", null, ORG_B, async () => (await db.query("delete from app.files where object_path like 'w/%'")).affectedRows);
    expect(wrongOrg).toBe(0);
    const removed = await as("app_worker", null, ORG_A, () =>
      ids("delete from app.files where object_path like 'w/%' returning id"),
    );
    expect(removed.map((id) => id.slice(-2))).toEqual(["d1", "d4", "d6"]);
  });

  it("anon and authenticated hold no table privilege in schema app", async () => {
    const res = await db.query<{ grantee: string }>(
      `select distinct grantee from information_schema.role_table_grants
        where table_schema = 'app' and grantee in ('anon', 'authenticated', 'public')`,
    );
    expect(res.rows).toEqual([]);
  });

  it("authenticated can execute only app.can_access_object", async () => {
    const res = await db.query<{ proname: string }>(
      `select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and has_function_privilege('authenticated', p.oid, 'execute')`,
    );
    expect(res.rows.map((row) => row.proname)).toEqual(["can_access_object"]);
    expect(await fails("authenticated", U_OWNER, ORG_A, "select app.current_org_id()")).toBe(true);
    expect(await fails("app_api", U_OWNER, ORG_A, "select app.can_access_object('a/b/c/d', 'read')")).toBe(true);
  });
});

describe("app.can_access_object (PGlite)", () => {
  interface Seed {
    org?: string;
    ws?: string | null;
    status?: string;
    uploader?: string;
    legalHold?: boolean;
    retentionUntil?: string | null;
  }

  async function mk(seed: Seed = {}): Promise<string> {
    const id = crypto.randomUUID();
    const org = seed.org ?? ORG_A;
    const ws = seed.ws === undefined ? WS_A1 : seed.ws;
    const path = `${org}/${ws ?? "org"}/${id}/doc.pdf`;
    const status = seed.status ?? "available";
    await db.query(
      `insert into app.files (id, organization_id, workspace_id, object_path, original_name, mime_type, size_bytes,
         status, deleted_at, uploaded_by, legal_hold, retention_until)
       values ($1, $2, $3, $4, 'doc.pdf', 'application/pdf', 1, $5, $6, $7, $8, $9)`,
      [id, org, ws, path, status, status === "deleted" ? new Date() : null, seed.uploader ?? U_OWNER, seed.legalHold ?? false, seed.retentionUntil ?? null],
    );
    return path;
  }

  it("allows read of an available file for any active member of the right workspace", async () => {
    const path = await mk();
    expect(await allowed(U_OWNER, path, "read")).toBe(true);
    expect(await allowed(U_MEMBER, path, "read")).toBe(true);
    expect(await allowed(U_MANAGER, path, "read")).toBe(true);
    expect(await allowed(U_STAFF, path, "read")).toBe(false);
    const other = await mk({ ws: WS_A2 });
    expect(await allowed(U_MEMBER, other, "read")).toBe(false);
    expect(await allowed(U_MANAGER, other, "read")).toBe(false);
    expect(await allowed(U_STAFF, other, "read")).toBe(true);
  });

  it("denies the wrong organization, revoked members and anonymous callers", async () => {
    const path = await mk();
    expect(await allowed(U_OWNER_B, path, "read")).toBe(false);
    expect(await allowed(U_REVOKED, path, "read")).toBe(false);
    expect(await allowed(null, path, "read")).toBe(false);
    const foreign = await mk({ org: ORG_B, ws: WS_B1, uploader: U_OWNER_B });
    expect(await allowed(U_OWNER, foreign, "read")).toBe(false);
  });

  it("denies paths without a matching app.files row, or whose segments do not match the row", async () => {
    const real = await mk();
    const [org, ws, id, name] = real.split("/") as [string, string, string, string];
    expect(await allowed(U_OWNER, `${org}/${ws}/${crypto.randomUUID()}/${name}`, "read")).toBe(false);
    expect(await allowed(U_OWNER, `${org}/${WS_A2}/${id}/${name}`, "read")).toBe(false);
    expect(await allowed(U_OWNER, `${org}/org/${id}/${name}`, "read")).toBe(false);
    expect(await allowed(U_OWNER, `${ORG_B}/${ws}/${id}/${name}`, "read")).toBe(false);
    expect(await allowed(U_OWNER, `${org}/${ws}/${id}/${name}/extra`, "read")).toBe(false);
  });

  it("denies a workspace that does not belong to the organization in the path", async () => {
    expect(await allowed(U_OWNER, `${ORG_A}/${WS_B1}/${crypto.randomUUID()}/doc.pdf`, "read")).toBe(false);
  });

  it("read: a pending or quarantined file is readable only by its own uploader (pending) and never when quarantined", async () => {
    const pending = await mk({ status: "pending", uploader: U_MANAGER });
    expect(await allowed(U_MANAGER, pending, "read")).toBe(true);
    expect(await allowed(U_OWNER, pending, "read")).toBe(false);
    expect(await allowed(U_MEMBER, pending, "read")).toBe(false);
    const quarantined = await mk({ status: "quarantined", uploader: U_MANAGER });
    expect(await allowed(U_MANAGER, quarantined, "read")).toBe(false);
    expect(await allowed(U_OWNER, quarantined, "read")).toBe(false);
    const deleted = await mk({ status: "deleted", uploader: U_MANAGER });
    expect(await allowed(U_MANAGER, deleted, "read")).toBe(false);
  });

  it("write: only the uploader of a pending file with a write role; never on available files", async () => {
    const pending = await mk({ status: "pending", uploader: U_STAFF, ws: WS_A2 });
    expect(await allowed(U_STAFF, pending, "write")).toBe(true);
    expect(await allowed(U_OWNER, pending, "write")).toBe(false);
    const memberPending = await mk({ status: "pending", uploader: U_MEMBER });
    expect(await allowed(U_MEMBER, memberPending, "write")).toBe(false);
    const available = await mk({ status: "available", uploader: U_MANAGER });
    expect(await allowed(U_MANAGER, available, "write")).toBe(false);
    expect(await allowed(U_OWNER, available, "write")).toBe(false);
    const orgLevel = await mk({ status: "pending", ws: null, uploader: U_OWNER });
    expect(await allowed(U_OWNER, orgLevel, "write")).toBe(true);
    const orgLevelManager = await mk({ status: "pending", ws: null, uploader: U_MANAGER });
    expect(await allowed(U_MANAGER, orgLevelManager, "write")).toBe(false);
  });

  it("delete: only a deleted file without legal hold and with retention elapsed or null", async () => {
    expect(await allowed(U_MANAGER, await mk({ status: "available" }), "delete")).toBe(false);
    expect(await allowed(U_MANAGER, await mk({ status: "pending", uploader: U_MANAGER }), "delete")).toBe(false);
    expect(await allowed(U_MANAGER, await mk({ status: "deleted" }), "delete")).toBe(true);
    expect(await allowed(U_OWNER, await mk({ status: "deleted" }), "delete")).toBe(true);
    expect(await allowed(U_MEMBER, await mk({ status: "deleted" }), "delete")).toBe(false);
    expect(await allowed(U_STAFF, await mk({ status: "deleted", ws: WS_A2 }), "delete")).toBe(false);
    expect(await allowed(U_MANAGER, await mk({ status: "deleted", legalHold: true }), "delete")).toBe(false);
    expect(await allowed(U_MANAGER, await mk({ status: "deleted", retentionUntil: "2999-01-01T00:00:00Z" }), "delete")).toBe(false);
    expect(await allowed(U_MANAGER, await mk({ status: "deleted", retentionUntil: "2000-01-01T00:00:00Z" }), "delete")).toBe(true);
    expect(await allowed(U_MANAGER, await mk({ status: "deleted", legalHold: true, retentionUntil: "2000-01-01T00:00:00Z" }), "delete")).toBe(false);
  });

  it("limits org-level paths to organization-wide memberships", async () => {
    const path = await mk({ ws: null });
    expect(await allowed(U_OWNER, path, "read")).toBe(true);
    expect(await allowed(U_MANAGER, path, "read")).toBe(false);
  });

  it("denies malformed names, unknown modes and files of other buckets", async () => {
    const path = await mk();
    expect(await allowed(U_OWNER, "not-a-path", "read")).toBe(false);
    expect(await allowed(U_OWNER, `${ORG_A}/${WS_A1}`, "read")).toBe(false);
    expect(await allowed(U_OWNER, "", "read")).toBe(false);
    expect(await allowed(U_OWNER, `zzzz/${WS_A1}/x/y.pdf`, "read")).toBe(false);
    expect(await allowed(U_OWNER, path, "admin")).toBe(false);
    expect(await allowed(U_OWNER, path, "")).toBe(false);
    await db.query("update app.files set bucket = 'other-files' where object_path = $1", [path]);
    expect(await allowed(U_OWNER, path, "read")).toBe(false);
  });

  it("has no UPDATE policy on storage.objects and exactly select/insert/delete for the private bucket", async () => {
    const res = await db.query<{ policyname: string; cmd: string }>(
      "select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname",
    );
    expect(res.rows.map((row) => row.policyname)).toEqual(["private_files_delete", "private_files_insert", "private_files_select"]);
    expect(res.rows.map((row) => row.cmd).sort()).toEqual(["DELETE", "INSERT", "SELECT"]);
  });

  it("enforces the storage.objects policies for the private bucket only", async () => {
    const own = await mk({ status: "pending", uploader: U_MANAGER });
    const foreign = await mk({ org: ORG_B, ws: WS_B1, status: "available", uploader: U_OWNER_B });
    const availableOwn = await mk({ status: "available", uploader: U_MANAGER });
    await db.query("insert into storage.objects (bucket_id, name) values ('private-files', $1), ('private-files', $2), ('private-files', $3)", [own, foreign, availableOwn]);
    await db.query("insert into storage.buckets (id, name) values ('other', 'other') on conflict do nothing");
    await db.query("insert into storage.objects (bucket_id, name) values ('other', $1)", [own]);

    const visible = (user: string) =>
      as("authenticated", user, null, async () => {
        const res = await db.query<{ name: string }>("select name from storage.objects where bucket_id = 'private-files' order by name");
        return res.rows.map((row) => row.name);
      });
    expect(await visible(U_MANAGER)).toEqual([own, availableOwn].sort());
    expect(await visible(U_OWNER)).toEqual([availableOwn]);
    expect(await visible(U_OWNER_B)).toEqual([foreign]);

    const insert = (user: string, bucket: string, name: string) =>
      fails("authenticated", user, null, "insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, name]);
    const pendingMember = await mk({ status: "pending", uploader: U_MEMBER });
    const pendingStaff = await mk({ status: "pending", uploader: U_STAFF, ws: WS_A2 });
    const pendingManager = await mk({ status: "pending", uploader: U_MANAGER });
    const noRow = `${ORG_A}/${WS_A1}/${crypto.randomUUID()}/direct.pdf`;
    expect(await insert(U_MEMBER, "private-files", pendingMember)).toBe(true);
    expect(await insert(U_STAFF, "private-files", pendingStaff)).toBe(false);
    expect(await insert(U_OWNER, "private-files", pendingManager)).toBe(true);
    expect(await insert(U_MANAGER, "private-files", noRow)).toBe(true);
    expect(await insert(U_MANAGER, "private-files", availableOwn)).toBe(true);
    expect(await insert(U_MANAGER, "other", pendingManager)).toBe(true);
  });

  it("denies UPDATE on storage.objects (no overwrite of a verified object)", async () => {
    const path = await mk({ status: "available", uploader: U_MANAGER });
    await db.query("insert into storage.objects (bucket_id, name) values ('private-files', $1)", [path]);
    const touched = await as("authenticated", U_OWNER, null, async () =>
      (await db.query("update storage.objects set name = name where name = $1", [path])).affectedRows ?? 0,
    );
    expect(touched).toBe(0);
    const renamed = await as("authenticated", U_MANAGER, null, async () =>
      (await db.query("update storage.objects set name = $2 where name = $1", [path, `${path}.x`])).affectedRows ?? 0,
    );
    expect(renamed).toBe(0);
    expect(await fails("authenticated", U_MANAGER, null, "insert into storage.objects (bucket_id, name) values ('private-files', $1) on conflict (id) do update set name = excluded.name", [path])).toBe(true);
  });

  it("storage delete policy: only deleted files without legal hold and with retention elapsed (unfiltered DELETE)", async () => {
    const wipe = (user: string) =>
      as("authenticated", user, null, async () => (await db.query("delete from storage.objects")).affectedRows ?? 0);
    const remaining = async (paths: string[]) => {
      const res = await db.query<{ name: string }>("select name from storage.objects where name = any($1) order by name", [paths]);
      return res.rows.map((row) => row.name);
    };
    const insertObject = (path: string) => db.query("insert into storage.objects (bucket_id, name) values ('private-files', $1)", [path]);

    const available = await mk({ status: "available" });
    const held = await mk({ status: "deleted", legalHold: true });
    const retained = await mk({ status: "deleted", retentionUntil: "2999-01-01T00:00:00Z" });
    const due = await mk({ status: "deleted", retentionUntil: "2000-01-01T00:00:00Z" });
    const plain = await mk({ status: "deleted" });
    const all = [available, held, retained, due, plain];
    for (const path of all) await insertObject(path);

    await wipe(U_MEMBER);
    await wipe(U_OWNER_B);
    await wipe(U_STAFF);
    expect(await remaining(all)).toEqual([...all].sort());

    await wipe(U_MANAGER);
    expect(await remaining(all)).toEqual([available, held, retained].sort());
  });
});

describe("condominium structure migration (PGlite)", () => {
  const ORG_C = "cccccccc-0000-4000-8000-0000000000c0";
  const WS_C1 = "cccccccc-0000-4000-8000-0000000000c1";
  const WS_C2 = "cccccccc-0000-4000-8000-0000000000c2";
  const BLK_C1 = "cccccccc-0000-4000-8000-0000000000b1";
  const BLK_C1B = "cccccccc-0000-4000-8000-0000000000b2";
  const BLK_C2 = "cccccccc-0000-4000-8000-0000000000b3";
  const UNIT_101 = "cccccccc-0000-4000-8000-000000000101";
  const UNIT_102 = "cccccccc-0000-4000-8000-000000000102";
  const UNIT_C2 = "cccccccc-0000-4000-8000-000000000201";
  const P_RES = "cccccccc-0000-4000-8000-0000000000d1";
  const P_ROOMMATE = "cccccccc-0000-4000-8000-0000000000d2";
  const P_PENDING = "cccccccc-0000-4000-8000-0000000000d3";
  const P_C2 = "cccccccc-0000-4000-8000-0000000000d4";
  const UM_RES = "cccccccc-0000-4000-8000-0000000000e1";
  const UM_ROOMMATE = "cccccccc-0000-4000-8000-0000000000e2";
  const UM_PENDING = "cccccccc-0000-4000-8000-0000000000e3";
  const UM_C2 = "cccccccc-0000-4000-8000-0000000000e4";
  const U_OWN = "00000000-0000-4000-8000-0000000000c1";
  const U_COUNCIL = "00000000-0000-4000-8000-0000000000c2";
  const U_MGR1 = "00000000-0000-4000-8000-0000000000c3";
  const U_MGR2 = "00000000-0000-4000-8000-0000000000c4";
  const U_STF = "00000000-0000-4000-8000-0000000000c5";
  const U_RES = "00000000-0000-4000-8000-0000000000c6";
  const U_PENDING = "00000000-0000-4000-8000-0000000000c7";

  const rows = async <T = { id: string }>(role: string, user: string | null, org: string | null, sql: string, params: unknown[] = []) =>
    as(role, user, org, async () => (await db.query<T>(sql, params)).rows);

  beforeAll(async () => {
    await db.exec(`
      insert into auth.users (id) values
        ('${U_OWN}'), ('${U_COUNCIL}'), ('${U_MGR1}'), ('${U_MGR2}'), ('${U_STF}'), ('${U_RES}'), ('${U_PENDING}');
      insert into app.organizations (id, name) values ('${ORG_C}', 'test_org_c');
      insert into app.workspaces (id, organization_id, name, slug, address) values
        ('${WS_C1}', '${ORG_C}', 'Condominio C1', 'condominio-c1', 'Rua A, 1'),
        ('${WS_C2}', '${ORG_C}', 'Condominio C2', 'condominio-c2', null);
      insert into app.memberships (user_id, organization_id, workspace_id, role, status) values
        ('${U_OWN}', '${ORG_C}', null, 'owner', 'active'),
        ('${U_COUNCIL}', '${ORG_C}', '${WS_C1}', 'council', 'active'),
        ('${U_MGR1}', '${ORG_C}', '${WS_C1}', 'manager', 'active'),
        ('${U_MGR2}', '${ORG_C}', '${WS_C2}', 'manager', 'active'),
        ('${U_STF}', '${ORG_C}', '${WS_C1}', 'staff', 'active'),
        ('${U_RES}', '${ORG_C}', '${WS_C1}', 'member', 'active'),
        ('${U_PENDING}', '${ORG_C}', '${WS_C1}', 'member', 'active');
      insert into app.blocks (id, organization_id, workspace_id, name) values
        ('${BLK_C1}', '${ORG_C}', '${WS_C1}', 'Bloco 1'),
        ('${BLK_C1B}', '${ORG_C}', '${WS_C1}', 'Bloco 2'),
        ('${BLK_C2}', '${ORG_C}', '${WS_C2}', 'Bloco 1');
      insert into app.units (id, organization_id, workspace_id, block_id, number) values
        ('${UNIT_101}', '${ORG_C}', '${WS_C1}', '${BLK_C1}', '101'),
        ('${UNIT_102}', '${ORG_C}', '${WS_C1}', '${BLK_C1}', '102'),
        ('${UNIT_C2}', '${ORG_C}', '${WS_C2}', '${BLK_C2}', '201');
      insert into app.people (id, organization_id, workspace_id, full_name, email, user_id, access_status, created_by) values
        ('${P_RES}', '${ORG_C}', '${WS_C1}', 'Ana Souza', 'ana@exemplo.com', '${U_RES}', 'active', '${U_MGR1}'),
        ('${P_ROOMMATE}', '${ORG_C}', '${WS_C1}', 'Carlos Lima', 'carlos@exemplo.com', null, 'none', '${U_MGR1}'),
        ('${P_PENDING}', '${ORG_C}', '${WS_C1}', 'Beatriz Melo', 'bia@exemplo.com', '${U_PENDING}', 'pending_approval', '${U_MGR1}'),
        ('${P_C2}', '${ORG_C}', '${WS_C2}', 'Joana Avila', 'joana@exemplo.com', null, 'none', '${U_MGR2}');
      insert into app.unit_members (id, organization_id, workspace_id, unit_id, person_id, relation, created_by) values
        ('${UM_RES}', '${ORG_C}', '${WS_C1}', '${UNIT_101}', '${P_RES}', 'owner', '${U_MGR1}'),
        ('${UM_ROOMMATE}', '${ORG_C}', '${WS_C1}', '${UNIT_101}', '${P_ROOMMATE}', 'tenant', '${U_MGR1}'),
        ('${UM_PENDING}', '${ORG_C}', '${WS_C1}', '${UNIT_102}', '${P_PENDING}', 'resident', '${U_MGR1}'),
        ('${UM_C2}', '${ORG_C}', '${WS_C2}', '${UNIT_C2}', '${P_C2}', 'owner', '${U_MGR2}');
    `);
  }, 60_000);

  afterAll(async () => {
    await db.exec(`delete from app.organizations where id = '${ORG_C}'`);
    const left = await db.query("select 1 from app.units where organization_id = $1", [ORG_C]);
    expect(left.rows).toHaveLength(0);
  });

  it("accepts council only with a workspace and keeps rejecting unknown roles", async () => {
    const insert = (role: string, ws: string | null) =>
      db
        .query("insert into app.memberships (user_id, organization_id, workspace_id, role) values ($1, $2, $3, $4)", [U_OWNER_B, ORG_B, ws, role])
        .then(() => true)
        .catch(() => false);
    expect(await insert("council", null)).toBe(false);
    expect(await insert("owner", WS_B1)).toBe(false);
    expect(await insert("superuser", null)).toBe(false);
    expect(await insert("council", WS_B1)).toBe(true);
    await db.query("delete from app.memberships where user_id = $1 and role = 'council'", [U_OWNER_B]);
  });

  it("enforces slug format, global uniqueness and allows several null slugs", async () => {
    const setSlug = (id: string, slug: string | null) =>
      db.query("update app.workspaces set slug = $2 where id = $1", [id, slug]).then(() => true).catch(() => false);
    expect(await setSlug(WS_C2, "condominio-c1")).toBe(false);
    for (const bad of ["Ab-c", "ab", "a_b_c", "-abc", "abc--def", "x".repeat(61)]) expect(await setSlug(WS_C2, bad)).toBe(false);
    expect(await setSlug(WS_B1, "b1-slug")).toBe(true);
    expect(await setSlug(WS_A1, null)).toBe(true);
    expect(await setSlug(WS_A2, null)).toBe(true);
    expect(await db.query("update app.workspaces set address = $2 where id = $1", [WS_C1, "x".repeat(201)]).then(() => true).catch(() => false)).toBe(false);
  });

  it("keeps block and unit names unique per scope, case-insensitively", async () => {
    const run = (sql: string) => db.exec(sql).then(() => true).catch(() => false);
    expect(await run(`insert into app.blocks (organization_id, workspace_id, name) values ('${ORG_C}', '${WS_C1}', 'BLOCO 1')`)).toBe(false);
    expect(await run(`insert into app.blocks (organization_id, workspace_id, name) values ('${ORG_C}', '${WS_C2}', 'Bloco 2')`)).toBe(true);
    expect(await run(`insert into app.units (organization_id, workspace_id, block_id, number) values ('${ORG_C}', '${WS_C1}', '${BLK_C1}', '101')`)).toBe(false);
    expect(await run(`insert into app.units (organization_id, workspace_id, block_id, number) values ('${ORG_C}', '${WS_C1}', '${BLK_C1B}', '101')`)).toBe(true);
    expect(await run(`insert into app.units (organization_id, workspace_id, block_id, number) values ('${ORG_C}', '${WS_C1}', '${BLK_C2}', '301')`)).toBe(false);
    expect(await run(`insert into app.units (organization_id, workspace_id, block_id, number) values ('${ORG_C}', '${WS_C1}', '${BLK_C1}', '${"9".repeat(21)}')`)).toBe(false);
  });

  it("batch insert with ON CONFLICT DO NOTHING is idempotent", async () => {
    const batch = async () =>
      (
        await db.query(
          `insert into app.units (organization_id, workspace_id, block_id, number)
           select $1, $2, $3, n from unnest($4::text[]) as t(n) on conflict do nothing returning id`,
          [ORG_C, WS_C1, BLK_C1B, ["201", "202", "101"]],
        )
      ).rows.length;
    expect(await batch()).toBe(2);
    expect(await batch()).toBe(0);
  });

  it("enforces people and link invariants", async () => {
    const run = (sql: string, params: unknown[] = []) => db.query(sql, params).then(() => true).catch(() => false);
    const person = (email: string, ws = WS_C1) =>
      run(
        `insert into app.people (organization_id, workspace_id, full_name, email, created_by) values ($1, $2, 'Fulano de Tal', $3, $4)`,
        [ORG_C, ws, email, U_MGR1],
      );
    expect(await person("ana@exemplo.com")).toBe(false);
    expect(await person("Novo@Exemplo.com")).toBe(false);
    expect(await person("ana@exemplo.com", WS_C2)).toBe(true);
    expect(await run(`update app.people set status = 'weird' where id = $1`, [P_RES])).toBe(false);
    expect(await run(`update app.people set access_status = 'weird' where id = $1`, [P_RES])).toBe(false);
    expect(await run(`update app.people set user_id = $2 where id = $1`, [P_ROOMMATE, U_RES])).toBe(false);

    const link = (unit: string, personId: string, ws = WS_C1) =>
      run(
        `insert into app.unit_members (organization_id, workspace_id, unit_id, person_id, relation, created_by) values ($1, $2, $3, $4, 'owner', $5)`,
        [ORG_C, ws, unit, personId, U_MGR1],
      );
    expect(await link(UNIT_101, P_RES)).toBe(false);
    expect(await link(UNIT_C2, P_RES)).toBe(false);
    expect(await link(UNIT_C2, P_RES, WS_C2)).toBe(false);
    expect(await run(`update app.unit_members set ends_on = current_date - 1, starts_on = current_date where id = $1`, [UM_ROOMMATE])).toBe(false);
    expect(await run(`update app.unit_members set relation = 'dependent' where id = $1`, [UM_ROOMMATE])).toBe(false);
  });

  it("keeps history: ending a link allows a new active link for the same pair", async () => {
    const link = () =>
      db
        .query(
          `insert into app.unit_members (organization_id, workspace_id, unit_id, person_id, relation, starts_on, created_by)
           values ($1, $2, $3, $4, 'resident', current_date, $5)`,
          [ORG_C, WS_C1, UNIT_102, P_ROOMMATE, U_MGR1],
        )
        .then(() => true)
        .catch(() => false);
    expect(await link()).toBe(true);
    expect(await link()).toBe(false);
    await db.query(
      "update app.unit_members set ends_on = current_date where person_id = $1 and unit_id = $2 and ends_on is null",
      [P_ROOMMATE, UNIT_102],
    );
    expect(await link()).toBe(true);
    const history = await db.query("select 1 from app.unit_members where person_id = $1 and unit_id = $2", [P_ROOMMATE, UNIT_102]);
    expect(history.rows).toHaveLength(2);
  });

  it("marks personal columns as PII in the catalog", async () => {
    const res = await db.query<{ column_name: string }>(
      `select a.attname as column_name
         from pg_description d
         join pg_attribute a on a.attrelid = d.objoid and a.attnum = d.objsubid
        where d.objoid = 'app.people'::regclass and d.description like 'pii:%'
        order by 1`,
    );
    expect(res.rows.map((row) => row.column_name)).toEqual([
      "email",
      "full_name",
      "phone_enc",
      "phone_hash",
      "photo_file_id",
      "whatsapp_enc",
    ]);
  });

  it("RLS: blocks and units are readable by every role of the condominium, writable by managers and above", async () => {
    for (const user of [U_OWN, U_COUNCIL, U_MGR1, U_STF, U_RES]) {
      const blocks = await rows("app_api", user, ORG_C, "select id from app.blocks where workspace_id = $1", [WS_C1]);
      expect(blocks.map((r) => r.id)).toContain(BLK_C1);
      const units = await rows("app_api", user, ORG_C, "select id from app.units where workspace_id = $1", [WS_C1]);
      expect(units.map((r) => r.id)).toContain(UNIT_101);
    }
    const other = await rows("app_api", U_MGR1, ORG_C, "select id from app.blocks where workspace_id = $1", [WS_C2]);
    expect(other).toEqual([]);

    const insertBlock = (user: string, ws: string, name: string) =>
      fails("app_api", user, ORG_C, "insert into app.blocks (organization_id, workspace_id, name) values ($1, $2, $3)", [ORG_C, ws, name]);
    expect(await insertBlock(U_MGR1, WS_C1, "Bloco 9")).toBe(false);
    expect(await insertBlock(U_OWN, WS_C2, "Bloco 9")).toBe(false);
    expect(await insertBlock(U_MGR1, WS_C2, "Bloco 8")).toBe(true);
    for (const user of [U_COUNCIL, U_STF, U_RES]) expect(await insertBlock(user, WS_C1, "Bloco 7")).toBe(true);
    expect(await fails("app_api", U_MGR1, ORG_C, "update app.units set status = 'inactive' where id = $1 returning id", [UNIT_102])).toBe(false);
    const denied = await rows("app_api", U_COUNCIL, ORG_C, "update app.units set status = 'inactive' where id = $1 returning id", [UNIT_101]);
    expect(denied).toEqual([]);
    expect(await fails("app_api", U_OWN, ORG_C, "delete from app.units where id = $1", [UNIT_101])).toBe(true);
  });

  it("RLS: only managers and above see people and links; council and staff see nothing", async () => {
    const people = (user: string) => rows("app_api", user, ORG_C, "select id from app.people");
    const links = (user: string) => rows("app_api", user, ORG_C, "select id from app.unit_members");
    expect((await people(U_MGR1)).map((r) => r.id).sort()).toEqual([P_RES, P_ROOMMATE, P_PENDING].sort());
    const managerC2 = (await people(U_MGR2)).map((r) => r.id);
    expect(managerC2).toContain(P_C2);
    expect(managerC2).not.toContain(P_RES);
    expect((await people(U_OWN)).map((r) => r.id)).toEqual(expect.arrayContaining([P_RES, P_ROOMMATE, P_PENDING, P_C2]));
    expect(await people(U_COUNCIL)).toEqual([]);
    expect(await people(U_STF)).toEqual([]);
    expect(await links(U_COUNCIL)).toEqual([]);
    expect(await links(U_STF)).toEqual([]);
    expect((await links(U_MGR2)).map((r) => r.id)).toEqual([UM_C2]);
  });

  it("RLS: a member sees only their own person row and the links of their own units", async () => {
    expect((await rows("app_api", U_RES, ORG_C, "select id from app.people")).map((r) => r.id)).toEqual([P_RES]);
    const links = await rows("app_api", U_RES, ORG_C, "select id from app.unit_members");
    expect(links.map((r) => r.id).sort()).toEqual([UM_RES, UM_ROOMMATE].sort());
    expect((await rows("app_api", U_RES, ORG_C, "select app.my_unit_ids() as id")).map((r) => r.id)).toEqual([UNIT_101]);
  });

  it("my_unit_ids requires an active access, an active link and an active membership", async () => {
    const mine = (user: string) => rows("app_api", user, ORG_C, "select app.my_unit_ids() as id").then((r) => r.map((x) => x.id));
    expect(await mine(U_PENDING)).toEqual([]);
    expect(await rows("app_api", U_PENDING, ORG_C, "select id from app.unit_members")).toEqual([]);
    expect(await mine(U_MGR1)).toEqual([]);

    await db.query("update app.people set access_status = 'active' where id = $1", [P_PENDING]);
    expect(await mine(U_PENDING)).toEqual([UNIT_102]);
    await db.query("update app.memberships set status = 'revoked' where user_id = $1", [U_PENDING]);
    expect(await mine(U_PENDING)).toEqual([]);
    await db.query("update app.memberships set status = 'active' where user_id = $1", [U_PENDING]);
    await db.query("update app.unit_members set ends_on = current_date - 1, starts_on = current_date - 5 where id = $1", [UM_PENDING]);
    expect(await mine(U_PENDING)).toEqual([]);
    await db.query("update app.unit_members set ends_on = current_date, starts_on = current_date - 5 where id = $1", [UM_PENDING]);
    expect(await mine(U_PENDING)).toEqual([]);
    await db.query("update app.unit_members set ends_on = current_date + 1, starts_on = current_date - 5 where id = $1", [UM_PENDING]);
    expect(await mine(U_PENDING)).toEqual([UNIT_102]);

    expect(await rows("app_api", U_RES, ORG_B, "select app.my_unit_ids() as id")).toEqual([]);
    expect(await rows("app_api", U_RES, null, "select app.my_unit_ids() as id")).toEqual([]);
    expect(await fails("authenticated", U_RES, ORG_C, "select app.my_unit_ids()")).toBe(true);
    expect(await fails("anon", null, null, "select app.my_unit_ids()")).toBe(true);
  });

  it("RLS: inserts and updates are limited to managers of that condominium, created_by to the caller", async () => {
    const addPerson = (user: string, ws: string, createdBy = user, org = ORG_C) =>
      fails(
        "app_api",
        user,
        org,
        `insert into app.people (organization_id, workspace_id, full_name, email, created_by) values ($1, $2, 'Pessoa Teste', $3, $4)`,
        [ORG_C, ws, `${randomId()}@exemplo.com`, createdBy],
      );
    expect(await addPerson(U_MGR1, WS_C1)).toBe(false);
    expect(await addPerson(U_MGR1, WS_C2)).toBe(true);
    expect(await addPerson(U_MGR1, WS_C1, U_MGR2)).toBe(true);
    for (const user of [U_COUNCIL, U_STF, U_RES]) expect(await addPerson(user, WS_C1)).toBe(true);
    expect(await addPerson(U_OWNER_B, WS_C1, U_OWNER_B, ORG_B)).toBe(true);

    const changed = (user: string, id: string) =>
      rows("app_api", user, ORG_C, "update app.people set status = 'inactive' where id = $1 returning id", [id]);
    expect(await changed(U_MGR2, P_RES)).toEqual([]);
    expect((await changed(U_MGR1, P_ROOMMATE)).map((r) => r.id)).toEqual([P_ROOMMATE]);
    expect(await changed(U_COUNCIL, P_ROOMMATE)).toEqual([]);
    expect((await changed(U_RES, P_RES)).map((r) => r.id)).toEqual([P_RES]);
    expect(await changed(U_RES, P_ROOMMATE)).toEqual([]);

    expect(await fails("app_api", U_MGR1, ORG_C, "delete from app.people where id = $1", [P_ROOMMATE])).toBe(true);
    expect(await fails("app_api", U_MGR1, ORG_C, "delete from app.unit_members where id = $1", [UM_ROOMMATE])).toBe(true);
  });

  it("RLS: another tenant sees and writes nothing, even naming the organization", async () => {
    for (const table of ["blocks", "units", "people", "unit_members"]) {
      expect(await rows("app_api", U_OWNER_B, ORG_C, `select id from app.${table}`)).toEqual([]);
      expect(await rows("app_api", U_OWNER_B, ORG_B, `select id from app.${table}`)).toEqual([]);
      expect(await rows("app_api", U_OWN, null, `select id from app.${table}`)).toEqual([]);
      expect(await fails("anon", null, null, `select id from app.${table}`)).toBe(true);
      expect(await fails("authenticated", U_OWN, ORG_C, `select id from app.${table}`)).toBe(true);
    }
    expect(await fails("app_api", U_OWNER_B, ORG_B, "insert into app.units (organization_id, workspace_id, block_id, number) values ($1, $2, $3, '999')", [ORG_C, WS_C1, BLK_C1])).toBe(true);
  });

  it("RLS: an owner creates a workspace and reads it back in the next statement", async () => {
    const id = "cccccccc-0000-4000-8000-0000000000f1";
    await as("app_api", U_OWN, ORG_C, () =>
      db.query("insert into app.workspaces (id, organization_id, name, slug) values ($1, $2, 'Novo Condominio', 'novo-condominio')", [id, ORG_C]),
    );
    const read = await rows("app_api", U_OWN, ORG_C, "select id from app.workspaces where id = $1", [id]);
    expect(read.map((r) => r.id)).toEqual([id]);
    expect(await fails("app_api", U_MGR1, ORG_C, "insert into app.workspaces (organization_id, name) values ($1, 'Intruso')", [ORG_C])).toBe(true);
  });

  it("cascades the whole structure when the organization is deleted", async () => {
    const org = "dddddddd-0000-4000-8000-0000000000d0";
    const ws = "dddddddd-0000-4000-8000-0000000000d1";
    const blk = "dddddddd-0000-4000-8000-0000000000d2";
    await db.exec(`
      insert into app.organizations (id, name) values ('${org}', 'test_cascade_structure');
      insert into app.workspaces (id, organization_id, name) values ('${ws}', '${org}', 'Cascata');
      insert into app.blocks (id, organization_id, workspace_id, name) values ('${blk}', '${org}', '${ws}', 'B');
      insert into app.units (organization_id, workspace_id, block_id, number) values ('${org}', '${ws}', '${blk}', '1');
      insert into app.people (organization_id, workspace_id, full_name, email, created_by) values ('${org}', '${ws}', 'Pessoa Cascata', 'c@exemplo.com', '${U_OWN}');
      delete from app.organizations where id = '${org}';
    `);
    for (const table of ["blocks", "units", "people", "unit_members"]) {
      const left = await db.query(`select 1 from app.${table} where organization_id = $1`, [org]);
      expect(left.rows).toHaveLength(0);
    }
  });
});

function randomId(): string {
  return crypto.randomUUID().slice(0, 8);
}
