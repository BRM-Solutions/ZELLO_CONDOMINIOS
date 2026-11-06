import { exportJWK, createLocalJWKSet, generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { pino } from "pino";
import { createApp } from "../app";
import { createJwtVerifier } from "../auth/authenticate";
import { loadConfig } from "../config";
import type { Db } from "../db";
import { StorageError, type StorageClient, type StorageAuth, type StorageObjectRef } from "../integrations/storage-client";
import type { WebhookAdapters } from "../modules/webhooks/routes";

export const ISSUER = "https://test-ref.supabase.co/auth/v1";
export const USER_ID = "11111111-1111-4111-8111-111111111111";
export const ORG_ID = "22222222-2222-4222-8222-222222222222";
export const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
export const OTHER_ORG_ID = "55555555-5555-4555-8555-555555555555";
export const WEB_ORIGIN = "https://app.example.test";

export const testEnv = {
  NODE_ENV: "test",
  API_PORT: "3000",
  WEB_ORIGIN,
  DATABASE_URL: "postgresql://app_api:secret@localhost:6543/postgres",
  SUPABASE_URL: "https://test-ref.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  DATA_HASH_KEY: Buffer.alloc(32, 2).toString("base64"),
  LOG_LEVEL: "silent",
};

export interface RecordedQuery {
  sql: string;
  params: unknown[] | undefined;
}

type Responder = (sql: string, params: unknown[] | undefined) => { rows: unknown[] } | undefined;

export function createFakeDb(responder: Responder = () => undefined) {
  const queries: RecordedQuery[] = [];
  let released = 0;
  const run = async (sql: string, params?: unknown[]) => {
    queries.push({ sql, params });
    return responder(sql, params) ?? { rows: [] };
  };
  const db = {
    query: run,
    connect: async () => ({ query: run, release: () => void (released += 1) }),
    end: async () => undefined,
  } as unknown as Db;
  return { db, queries, released: () => released };
}

export interface StorageCall {
  method: "createSignedUploadUrl" | "createSignedDownloadUrl" | "headObject" | "removeObjects";
  bucket: string;
  paths: string[];
  auth: StorageAuth;
  ttl?: number;
}

export function createFakeStorage() {
  const objects = new Map<string, { sizeBytes: number; mimeType: string | null }>();
  const calls: StorageCall[] = [];
  const state: { failWith?: number } = {};
  const key = (bucket: string, path: string) => `${bucket}/${path}`;
  const guard = () => {
    if (state.failWith) throw new StorageError(state.failWith, "storage failure");
  };
  const client: StorageClient = {
    async createSignedUploadUrl(ref: StorageObjectRef, auth) {
      calls.push({ method: "createSignedUploadUrl", bucket: ref.bucket, paths: [ref.path], auth });
      guard();
      return { url: `https://test-ref.supabase.co/storage/v1/object/upload/sign/${ref.bucket}/${ref.path}?token=up-token`, token: "up-token" };
    },
    async createSignedDownloadUrl(ref, ttl, auth) {
      calls.push({ method: "createSignedDownloadUrl", bucket: ref.bucket, paths: [ref.path], auth, ttl });
      guard();
      return { url: `https://test-ref.supabase.co/storage/v1/object/sign/${ref.bucket}/${ref.path}?token=dl-token` };
    },
    async headObject(ref, auth) {
      calls.push({ method: "headObject", bucket: ref.bucket, paths: [ref.path], auth });
      guard();
      return objects.get(key(ref.bucket, ref.path)) ?? null;
    },
    async removeObjects(bucket, paths, auth) {
      calls.push({ method: "removeObjects", bucket, paths, auth });
      guard();
      for (const path of paths) objects.delete(key(bucket, path));
    },
  };
  return {
    client,
    calls,
    state,
    put: (bucket: string, path: string, info: { sizeBytes: number; mimeType: string | null }) =>
      void objects.set(key(bucket, path), info),
    has: (bucket: string, path: string) => objects.has(key(bucket, path)),
  };
}

export async function createTestKeys() {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "ES256", use: "sig" };
  const verifier = createJwtVerifier(createLocalJWKSet({ keys: [jwk] }), { issuer: ISSUER });

  const sign = (
    claims: { sub?: string; email?: string } = {},
    options: { issuer?: string; audience?: string; expiresIn?: string; key?: CryptoKey } = {},
  ) =>
    new SignJWT({ email: claims.email ?? "manager@example.test" })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setSubject(claims.sub ?? USER_ID)
      .setIssuer(options.issuer ?? ISSUER)
      .setAudience(options.audience ?? "authenticated")
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? "5m")
      .sign(options.key ?? privateKey);

  return { verifier, sign };
}

export async function buildTestApp(
  responder?: Responder,
  webhookAdapters?: WebhookAdapters,
  storage?: StorageClient,
  envOverrides: Record<string, string> = {},
) {
  const fake = createFakeDb(responder);
  const keys = await createTestKeys();
  const app = createApp({
    config: loadConfig({ ...testEnv, ...envOverrides }),
    db: fake.db,
    verifier: keys.verifier,
    logger: pino({ level: "silent" }),
    webhookAdapters,
    storage,
  });
  return { app, ...fake, ...keys };
}
