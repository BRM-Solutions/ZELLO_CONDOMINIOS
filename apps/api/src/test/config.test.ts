import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, loadWorkerConfig } from "../config";
import { testEnv } from "./helpers";

describe("loadConfig", () => {
  it("parses a valid environment and derives Supabase URLs", () => {
    const config = loadConfig({ ...testEnv, WEB_ORIGIN: "https://a.test/, https://b.test", SUPABASE_URL: "https://x.supabase.co/" });
    expect(config.webOrigins).toEqual(["https://a.test", "https://b.test"]);
    expect(config.jwksUrl).toBe("https://x.supabase.co/auth/v1/.well-known/jwks.json");
    expect(config.jwtIssuer).toBe("https://x.supabase.co/auth/v1");
    expect(config.port).toBe(3000);
  });

  it("honors an explicit JWKS URL", () => {
    const config = loadConfig({ ...testEnv, SUPABASE_JWKS_URL: "https://keys.example.test/jwks.json" });
    expect(config.jwksUrl).toBe("https://keys.example.test/jwks.json");
  });

  it("fails fast listing only variable names and reasons", () => {
    expect(() => loadConfig({ NODE_ENV: "test" })).toThrow(ConfigError);
    try {
      loadConfig({ NODE_ENV: "test", DATABASE_URL: "not-a-url" });
    } catch (err) {
      const message = (err as ConfigError).message;
      expect(message).toContain("DATABASE_URL");
      expect(message).toContain("SUPABASE_URL");
      expect(message).toContain("WEB_ORIGIN");
      expect(message).not.toContain("not-a-url");
    }
  });

  it("applies storage defaults and parses overrides", () => {
    const defaults = loadConfig(testEnv);
    expect(defaults.supabasePublishableKey).toBe("sb_publishable_test");
    expect(defaults.storageBucket).toBe("private-files");
    expect(defaults.signedUrlTtlSeconds).toBe(120);
    expect(defaults.fileMaxBytes).toBe(10_485_760);
    expect(defaults.fileAllowedMime).toContain("application/pdf");
    const custom = loadConfig({
      ...testEnv,
      STORAGE_BUCKET: "docs-bucket",
      STORAGE_SIGNED_URL_TTL_SECONDS: "90",
      FILE_MAX_BYTES: "2048",
      FILE_ALLOWED_MIME: " Application/PDF , image/png ",
    });
    expect(custom).toMatchObject({ storageBucket: "docs-bucket", signedUrlTtlSeconds: 90, fileMaxBytes: 2048 });
    expect(custom.fileAllowedMime).toEqual(["application/pdf", "image/png"]);
  });

  it("requires the publishable key and bounds the storage settings", () => {
    const { SUPABASE_PUBLISHABLE_KEY: _omit, ...withoutKey } = testEnv;
    expect(() => loadConfig(withoutKey)).toThrow(/SUPABASE_PUBLISHABLE_KEY/);
    expect(() => loadConfig({ ...testEnv, STORAGE_SIGNED_URL_TTL_SECONDS: "30" })).toThrow(ConfigError);
    expect(() => loadConfig({ ...testEnv, STORAGE_SIGNED_URL_TTL_SECONDS: "900" })).toThrow(ConfigError);
    expect(() => loadConfig({ ...testEnv, FILE_MAX_BYTES: "0" })).toThrow(ConfigError);
    expect(() => loadConfig({ ...testEnv, FILE_ALLOWED_MIME: "pdf" })).toThrow(ConfigError);
  });

  it("rejects an invalid port", () => {
    expect(() => loadConfig({ ...testEnv, API_PORT: "70000" })).toThrow(ConfigError);
  });

  it("validates the worker config with defaults", () => {
    const workerEnv = {
      NODE_ENV: "test",
      DATABASE_URL: testEnv.DATABASE_URL,
      SUPABASE_URL: "https://x.supabase.co/",
      SUPABASE_SECRET_KEY: "sb_secret_test",
    };
    const config = loadWorkerConfig(workerEnv);
    expect(config.pollIntervalMs).toBe(5000);
    expect(config.batchSize).toBe(20);
    expect(config.supabaseUrl).toBe("https://x.supabase.co");
    expect(config.supabaseSecretKey).toBe("sb_secret_test");
    expect(config.filesPurgeIntervalMs).toBe(600_000);
    expect(() => loadWorkerConfig({ NODE_ENV: "test" })).toThrow(ConfigError);
  });

  it("requires the secret key only in the worker, never in the API", () => {
    expect(() => loadConfig(testEnv)).not.toThrow();
    expect(() =>
      loadWorkerConfig({ NODE_ENV: "test", DATABASE_URL: testEnv.DATABASE_URL, SUPABASE_URL: testEnv.SUPABASE_URL }),
    ).toThrow(/SUPABASE_SECRET_KEY/);
    expect(Object.keys(loadConfig({ ...testEnv, SUPABASE_SECRET_KEY: "x" }))).not.toContain("supabaseSecretKey");
  });
});
