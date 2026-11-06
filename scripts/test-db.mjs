import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DB_NAME = "zello_test";
const ADMIN_PASSWORD = "postgres";
const APP_PASSWORD = "app_test";

function fail(message) {
  console.error(`\nERRO: ${message}\n`);
  process.exit(1);
}

let EmbeddedPostgres;
try {
  ({ default: EmbeddedPostgres } = await import("embedded-postgres"));
} catch {
  fail("o Postgres de teste ainda não foi instalado. Rode `pnpm install` na raiz do projeto e tente de novo.");
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

const args = process.argv.slice(2);
const mode = args[0];
if (mode !== "run" && mode !== "check") {
  fail("uso: node scripts/test-db.mjs run -- <comando>   |   node scripts/test-db.mjs check");
}
const sep = args.indexOf("--");
const command = mode === "check" ? null : sep >= 0 ? args.slice(sep + 1) : ["pnpm", "test:full"];
if (mode === "run" && command.length === 0) fail("faltou o comando depois de `--`.");

const port = await freePort();
const databaseDir = join(mkdtempSync(join(tmpdir(), "zello-pg-")), "data");
const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: ADMIN_PASSWORD,
  port,
  persistent: false,
  postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "fsync=off"],
  onLog: () => {},
  onError: () => {},
});

let stopped = false;
async function stop() {
  if (stopped) return;
  stopped = true;
  try {
    await pg.stop();
  } catch {
    // já parado
  }
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => void stop().then(() => process.exit(130)));
}

async function prepare() {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB_NAME);
  const client = pg.getPgClient(DB_NAME);
  await client.connect();
  try {
    const { rows } = await client.query("show server_version_num");
    if (!rows[0].server_version_num.startsWith("17")) {
      throw new Error(`esperava Postgres 17, veio ${rows[0].server_version_num}`);
    }
    await client.query(readFileSync(join(root, "supabase/tests/local-stub.sql"), "utf8"));
    const dir = join(root, "supabase/migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      try {
        await client.query(readFileSync(join(dir, file), "utf8"));
      } catch (error) {
        throw new Error(`a migration ${file} falhou: ${error.message}`);
      }
    }
    await client.query(`alter role app_api with login password '${APP_PASSWORD}'`);
    await client.query(`alter role app_worker with login password '${APP_PASSWORD}'`);
    return files.length;
  } finally {
    await client.end();
  }
}

let applied;
try {
  applied = await prepare();
} catch (error) {
  await stop();
  fail(error.message);
}

const base = `127.0.0.1:${port}/${DB_NAME}`;
console.log(`Postgres 17 de teste pronto na porta ${port} (${applied} migrations aplicadas).`);

if (mode === "check") {
  await stop();
  console.log("Banco local de teste OK.");
} else {
  const env = {
    ...process.env,
    TEST_DATABASE_URL: `postgres://app_api:${APP_PASSWORD}@${base}`,
    TEST_ADMIN_DATABASE_URL: `postgres://postgres:${ADMIN_PASSWORD}@${base}`,
    TEST_ALLOWED_DB_REFS: "127.0.0.1",
  };
  delete env.DATABASE_URL;

  const child = spawn(command[0], command.slice(1), {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("error", async (error) => {
    await stop();
    fail(`não consegui rodar \`${command.join(" ")}\`: ${error.message}`);
  });
  child.on("exit", async (code, signal) => {
    await stop();
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}
