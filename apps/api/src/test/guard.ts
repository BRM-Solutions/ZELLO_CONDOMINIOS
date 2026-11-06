export class UnsafeTestEnvironmentError extends Error {
  constructor(reason: string) {
    super(`Ambiente de teste inseguro: ${reason}`);
    this.name = "UnsafeTestEnvironmentError";
  }
}

const DIRECT_HOST = /^db\.([a-z0-9]+)\.supabase\.co$/;

export function extractDbRefs(connectionString: string): string[] {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new UnsafeTestEnvironmentError("TEST_DATABASE_URL inválida");
  }
  const refs: string[] = [];
  const user = decodeURIComponent(url.username);
  const dot = user.indexOf(".");
  if (dot > 0 && dot < user.length - 1) refs.push(user.slice(dot + 1).toLowerCase());
  const host = url.hostname.toLowerCase();
  const direct = DIRECT_HOST.exec(host);
  if (direct?.[1]) refs.push(direct[1]);
  if (refs.length === 0 && host) refs.push(host);
  return refs;
}

export function assertTestEnvironment(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV === "production") throw new UnsafeTestEnvironmentError("NODE_ENV=production");
  const url = env.TEST_DATABASE_URL;
  if (!url) return;
  const allowed = (env.TEST_ALLOWED_DB_REFS ?? "")
    .split(",")
    .map((ref) => ref.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) throw new UnsafeTestEnvironmentError("defina TEST_ALLOWED_DB_REFS com os refs do projeto dev");
  const refs = extractDbRefs(url);
  if (!refs.every((ref) => allowed.includes(ref))) {
    throw new UnsafeTestEnvironmentError("TEST_DATABASE_URL não pertence a um projeto dev permitido");
  }
  if (env.DATABASE_URL && env.DATABASE_URL === url) {
    throw new UnsafeTestEnvironmentError("TEST_DATABASE_URL não pode ser igual a DATABASE_URL");
  }
}
