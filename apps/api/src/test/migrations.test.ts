import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "../../../../supabase/migrations");
const sql = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(dir, file), "utf8"))
  .join("\n");

const tables = [...sql.matchAll(/create table if not exists app\.(\w+)/g)].map((m) => m[1] as string);

describe("migrations catalog (static)", () => {
  it("creates the expected base tables", () => {
    expect(tables).toEqual(
      expect.arrayContaining([
        "organizations",
        "workspaces",
        "memberships",
        "audit_log",
        "outbox",
        "inbound_events",
        "idempotency_keys",
        "files",
      ]),
    );
  });

  it.each(tables)("app.%s has RLS enabled and at least one policy", (table) => {
    expect(sql).toContain(`alter table app.${table} enable row level security`);
    expect(sql).toMatch(new RegExp(`create policy \\w+ on app\\.${table}\\b`));
  });

  it.each(tables.filter((t) => t !== "organizations"))("app.%s cascades from organizations", (table) => {
    const block = sql.slice(sql.indexOf(`create table if not exists app.${table} `));
    const definition = block.slice(0, block.indexOf(");"));
    expect(definition).toMatch(/organization_id[^,]*references app\.organizations \(id\) on delete cascade/);
  });

  const code = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("never uses FORCE RLS, BYPASSRLS grants or passwords", () => {
    expect(code).not.toMatch(/force row level security/i);
    expect(code).not.toMatch(/\bbypassrls\b(?<!nobypassrls)/i);
    expect(code).not.toMatch(/password/i);
    expect(code).not.toMatch(/grant authenticated to/i);
  });

  it("uses auth.uid() only inside app.can_access_object", () => {
    const withoutHelper = code.replace(
      /create or replace function app\.can_access_object[\s\S]*?\n\$\$;/,
      "",
    );
    expect(code).toMatch(/auth\.uid\(\)/);
    expect(withoutHelper).not.toMatch(/auth\.uid\(\)/);
  });

  it("grants authenticated exactly schema usage and the Storage helper", () => {
    const grants = code
      .split(";")
      .map((statement) => statement.replace(/\s+/g, " ").trim())
      .filter((statement) => /^grant /i.test(statement) && /\bauthenticated\b/i.test(statement));
    expect(grants).toEqual([
      "grant usage on schema app to authenticated",
      "grant execute on function app.can_access_object(text, text) to authenticated",
    ]);
  });

  it("creates app.files with the governance columns and checks", () => {
    const block = sql.slice(sql.indexOf("create table if not exists app.files "));
    const definition = block.slice(0, block.indexOf("\n);"));
    for (const column of [
      "workspace_id",
      "object_path text not null unique",
      "classification",
      "status",
      "retention_until",
      "legal_hold",
      "uploaded_by",
      "deleted_at",
    ]) {
      expect(definition).toContain(column);
    }
    expect(definition).toMatch(/classification in \('public', 'internal', 'confidential', 'personal'\)/);
    expect(definition).toMatch(/status in \('pending', 'available', 'quarantined', 'deleted'\)/);
    expect(sql).toContain("storage_quota_bytes bigint");
  });

  it("guards the Storage objects behind a schema existence check", () => {
    expect(code).toContain("to_regclass('storage.buckets') is not null");
    expect(code).toMatch(/create policy private_files_select on storage\.objects/);
    expect(code).toMatch(/create policy private_files_delete on storage\.objects/);
  });
});
