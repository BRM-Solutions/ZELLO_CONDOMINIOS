import { describe, expect, it } from "vitest";
import { UnsafeTestEnvironmentError, assertTestEnvironment, extractDbRefs } from "./guard";

const direct = "postgresql://u:p@db.devref123.supabase.co:5432/postgres";
const pooler = "postgresql://postgres.devref123:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";

describe("test environment guard", () => {
  it("allows runs without a test database", () => {
    expect(() => assertTestEnvironment({ NODE_ENV: "test" })).not.toThrow();
  });

  it("refuses production", () => {
    expect(() => assertTestEnvironment({ NODE_ENV: "production" })).toThrow(UnsafeTestEnvironmentError);
    expect(() =>
      assertTestEnvironment({ NODE_ENV: "production", TEST_DATABASE_URL: direct, TEST_ALLOWED_DB_REFS: "devref123" }),
    ).toThrow(UnsafeTestEnvironmentError);
  });

  it("requires an allowlist of dev refs for a test database", () => {
    expect(() => assertTestEnvironment({ TEST_DATABASE_URL: direct })).toThrow(UnsafeTestEnvironmentError);
    expect(() => assertTestEnvironment({ TEST_DATABASE_URL: direct, TEST_ALLOWED_DB_REFS: "otherref" })).toThrow(
      UnsafeTestEnvironmentError,
    );
    expect(() => assertTestEnvironment({ TEST_DATABASE_URL: direct, TEST_ALLOWED_DB_REFS: "devref123" })).not.toThrow();
  });

  it("extracts the ref from the pooler user and from the direct host", () => {
    expect(extractDbRefs(direct)).toEqual(["devref123"]);
    expect(extractDbRefs(pooler)).toEqual(["devref123"]);
    expect(() => assertTestEnvironment({ TEST_DATABASE_URL: pooler, TEST_ALLOWED_DB_REFS: "devref123" })).not.toThrow();
  });

  it("compares the extracted ref by exact equality, never by substring", () => {
    const prodWithMisleadingQuery = "postgresql://u:p@db.prodref999.supabase.co:5432/postgres?note=devref123";
    const prodWithMisleadingPassword = "postgresql://postgres.prodref999:devref123@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";
    const longerRef = "postgresql://u:p@db.devref123x.supabase.co:5432/postgres";
    for (const url of [prodWithMisleadingQuery, prodWithMisleadingPassword, longerRef]) {
      expect(() => assertTestEnvironment({ TEST_DATABASE_URL: url, TEST_ALLOWED_DB_REFS: "devref123" })).toThrow(
        UnsafeTestEnvironmentError,
      );
    }
    expect(() => assertTestEnvironment({ TEST_DATABASE_URL: direct, TEST_ALLOWED_DB_REFS: "devref" })).toThrow(
      UnsafeTestEnvironmentError,
    );
  });

  it("refuses when user and host point to different projects", () => {
    const mixed = "postgresql://postgres.prodref999:p@db.devref123.supabase.co:5432/postgres";
    expect(() => assertTestEnvironment({ TEST_DATABASE_URL: mixed, TEST_ALLOWED_DB_REFS: "devref123" })).toThrow(
      UnsafeTestEnvironmentError,
    );
  });

  it("refuses an unparseable URL and accepts a local host only when allowlisted", () => {
    expect(() => assertTestEnvironment({ TEST_DATABASE_URL: "not a url", TEST_ALLOWED_DB_REFS: "x" })).toThrow(
      UnsafeTestEnvironmentError,
    );
    const local = "postgresql://postgres:p@localhost:54322/postgres";
    expect(() => assertTestEnvironment({ TEST_DATABASE_URL: local, TEST_ALLOWED_DB_REFS: "devref123" })).toThrow(
      UnsafeTestEnvironmentError,
    );
    expect(() => assertTestEnvironment({ TEST_DATABASE_URL: local, TEST_ALLOWED_DB_REFS: "localhost" })).not.toThrow();
  });

  it("refuses when the test database equals the application database", () => {
    expect(() =>
      assertTestEnvironment({ TEST_DATABASE_URL: direct, DATABASE_URL: direct, TEST_ALLOWED_DB_REFS: "devref123" }),
    ).toThrow(UnsafeTestEnvironmentError);
  });
});
