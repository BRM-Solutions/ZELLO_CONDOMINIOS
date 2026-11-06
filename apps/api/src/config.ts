import { z } from "zod";

export class ConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Configuração inválida: ${issues.join("; ")}`);
    this.name = "ConfigError";
  }
}

const nodeEnv = z.enum(["development", "test", "production"]).default("development");
const logLevel = z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info");

const DEFAULT_ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const mimeList = z
  .string()
  .optional()
  .transform((value) =>
    value === undefined || value.trim() === ""
      ? DEFAULT_ALLOWED_MIME
      : value
          .split(",")
          .map((mime) => mime.trim().toLowerCase())
          .filter(Boolean),
  )
  .pipe(z.array(z.string().regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/)).min(1));

const apiEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim().replace(/\/$/, ""))
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1)),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  STORAGE_BUCKET: z.string().min(3).max(63).default("private-files"),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(300).default(120),
  FILE_MAX_BYTES: z.coerce.number().int().min(1).max(52_428_800).default(10_485_760),
  FILE_ALLOWED_MIME: mimeList,
  LOG_LEVEL: logLevel,
});

const workerEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  FILES_PURGE_INTERVAL_MS: z.coerce.number().int().min(10_000).default(600_000),
  LOG_LEVEL: logLevel,
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
  WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
});

export interface Config {
  nodeEnv: "development" | "test" | "production";
  port: number;
  webOrigins: string[];
  databaseUrl: string;
  supabaseUrl: string;
  jwksUrl: string;
  jwtIssuer: string;
  supabasePublishableKey: string;
  storageBucket: string;
  signedUrlTtlSeconds: number;
  fileMaxBytes: number;
  fileAllowedMime: string[];
  logLevel: string;
}

export interface WorkerConfig {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  supabaseUrl: string;
  supabaseSecretKey: string;
  filesPurgeIntervalMs: number;
  logLevel: string;
  pollIntervalMs: number;
  batchSize: number;
}

function fail(error: z.ZodError): never {
  throw new ConfigError(error.issues.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = apiEnvSchema.safeParse(env);
  if (!parsed.success) fail(parsed.error);
  const data = parsed.data;
  const supabaseUrl = data.SUPABASE_URL.replace(/\/$/, "");
  return {
    nodeEnv: data.NODE_ENV,
    port: data.API_PORT,
    webOrigins: data.WEB_ORIGIN,
    databaseUrl: data.DATABASE_URL,
    supabaseUrl,
    jwksUrl: data.SUPABASE_JWKS_URL ?? `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
    jwtIssuer: `${supabaseUrl}/auth/v1`,
    supabasePublishableKey: data.SUPABASE_PUBLISHABLE_KEY,
    storageBucket: data.STORAGE_BUCKET,
    signedUrlTtlSeconds: data.STORAGE_SIGNED_URL_TTL_SECONDS,
    fileMaxBytes: data.FILE_MAX_BYTES,
    fileAllowedMime: data.FILE_ALLOWED_MIME,
    logLevel: data.LOG_LEVEL,
  };
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = workerEnvSchema.safeParse(env);
  if (!parsed.success) fail(parsed.error);
  const data = parsed.data;
  return {
    nodeEnv: data.NODE_ENV,
    databaseUrl: data.DATABASE_URL,
    supabaseUrl: data.SUPABASE_URL.replace(/\/$/, ""),
    supabaseSecretKey: data.SUPABASE_SECRET_KEY,
    filesPurgeIntervalMs: data.FILES_PURGE_INTERVAL_MS,
    logLevel: data.LOG_LEVEL,
    pollIntervalMs: data.WORKER_POLL_INTERVAL_MS,
    batchSize: data.WORKER_BATCH_SIZE,
  };
}
