import { existsSync, lstatSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF = join("scripts", "init-project.mjs");
const MARKER = ".kit-initialized";
const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "coverage", ".vite", ".turbo"]);
const IGNORED_FILES = new Set(["pnpm-lock.yaml", MARKER, ".DS_Store"]);
const MAX_BYTES = 2 * 1024 * 1024;
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const FORBIDDEN_NAME_CHARS = /["\\<>&{}`$]/;

const USAGE = `Uso: node scripts/init-project.mjs --name "Meu SaaS" --slug meu-saas --scope @meu-saas [--dry-run]

  --name     Nome de exibicao do produto (substitui {{PROJETO}}).
  --slug     Identificador em kebab-case (substitui {{SLUG}}; vira o name do package.json raiz).
  --scope    Escopo dos pacotes, iniciando com @ (substitui @app/ por <scope>/).
  --dry-run  Mostra o que mudaria sem alterar nada.`;

function fail(message) {
  console.error(`Erro: ${message}\n\n${USAGE}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else if (arg === "--name" || arg === "--slug" || arg === "--scope") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) fail(`${arg} exige um valor.`);
      out[arg.slice(2)] = value;
      i += 1;
    } else fail(`argumento desconhecido: ${arg}`);
  }
  return out;
}

function validate({ name, slug, scope }) {
  if (!name || !slug || !scope) fail("informe --name, --slug e --scope.");
  if (name.trim() !== name || name.length < 2 || name.length > 80) fail("--name deve ter de 2 a 80 caracteres, sem espacos nas pontas.");
  if (FORBIDDEN_NAME_CHARS.test(name) || [...name].some((char) => char.charCodeAt(0) < 32)) fail('--name nao pode conter " \\ < > & { } ` $ nem caracteres de controle.');
  if (!KEBAB.test(slug) || slug.length > 60) fail("--slug deve estar em kebab-case (ex.: meu-saas).");
  if (!scope.startsWith("@") || !KEBAB.test(scope.slice(1)) || scope.length > 60) {
    fail("--scope deve iniciar com @ e ser kebab-case (ex.: @meu-saas).");
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) yield* walk(full);
    } else if (entry.isFile()) {
      if (IGNORED_FILES.has(entry.name) || entry.name.endsWith(".tsbuildinfo")) continue;
      if (relative(ROOT, full) === SELF) continue;
      yield full;
    }
  }
}

function readText(file) {
  if (lstatSync(file).size > MAX_BYTES) return undefined;
  const buffer = readFileSync(file);
  if (buffer.subarray(0, 8000).includes(0)) return undefined;
  return buffer.toString("utf8");
}

function replaceAll(text, from, to) {
  return text.split(from).join(to);
}

function transform(text, { name, slug, scope }) {
  let out = replaceAll(text, "{{PROJETO}}", name);
  out = replaceAll(out, "{{SLUG}}", slug);
  out = replaceAll(out, "@app/", `${scope}/`);
  return out.replace(/(?<![\w.])@app(?![\w./-])/g, scope);
}

function renameRootPackage(text, slug) {
  const pkg = JSON.parse(text);
  pkg.name = slug;
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

const options = parseArgs(process.argv.slice(2));
validate(options);

if (existsSync(join(ROOT, MARKER))) {
  console.error(`Erro: este projeto ja foi inicializado (${MARKER} existe). Nada foi alterado.`);
  process.exit(1);
}

const changes = [];
for (const file of walk(ROOT)) {
  const original = readText(file);
  if (original === undefined) continue;
  let updated = transform(original, options);
  if (relative(ROOT, file) === "package.json") updated = renameRootPackage(updated, options.slug);
  if (updated !== original) changes.push({ file, updated });
}

const prefix = options.dryRun ? "[dry-run] " : "";
for (const { file } of changes) console.log(`${prefix}atualiza ${relative(ROOT, file).split(sep).join("/")}`);

const lockfile = join(ROOT, "pnpm-lock.yaml");
const hasLockfile = existsSync(lockfile);
if (hasLockfile) console.log(`${prefix}remove pnpm-lock.yaml`);
console.log(`${prefix}cria ${MARKER}`);
console.log(`${prefix}${changes.length} arquivo(s) alterado(s) para "${options.name}" (${options.slug}, ${options.scope}).`);

if (options.dryRun) process.exit(0);

for (const { file, updated } of changes) writeFileSync(file, updated);
if (hasLockfile) rmSync(lockfile);
writeFileSync(
  join(ROOT, MARKER),
  `${JSON.stringify({ name: options.name, slug: options.slug, scope: options.scope, initializedAt: new Date().toISOString() }, null, 2)}\n`,
);

console.log(`
Projeto inicializado. Proximos passos:
  1. pnpm install                      (gera o novo pnpm-lock.yaml; versione-o)
  2. cp .env.example .env              (preencha localmente; nunca commite) e rode: pnpm check-env
  3. supabase login && supabase link --project-ref <ref-do-projeto-dev>
  4. pnpm type-check && pnpm lint && pnpm test
  5. Preencha docs/11-dominio.md e comece pela primeira spec (veja README.md).`);
