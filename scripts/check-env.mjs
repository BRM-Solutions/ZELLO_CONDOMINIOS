import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const fileFlag = args.indexOf("--file");
const examplePath = resolve(process.cwd(), ".env.example");
const sourceFile = fileFlag >= 0 ? args[fileFlag + 1] : undefined;

function parseNames(content) {
  const required = new Set();
  const optional = new Set();
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    const match = /^(#\s*)?([A-Z][A-Z0-9_]*)=/.exec(line);
    if (!match) continue;
    (match[1] ? optional : required).add(match[2]);
  }
  return { required, optional };
}

if (!existsSync(examplePath)) {
  console.error(".env.example não encontrado no diretório atual.");
  process.exit(2);
}

const example = parseNames(readFileSync(examplePath, "utf8"));
let present;
if (sourceFile) {
  if (!existsSync(sourceFile)) {
    console.error(`Arquivo não encontrado: ${sourceFile}`);
    process.exit(2);
  }
  const parsed = parseNames(readFileSync(sourceFile, "utf8"));
  present = new Set([...parsed.required, ...parsed.optional]);
} else {
  present = new Set(Object.keys(process.env).filter((name) => process.env[name] !== ""));
}

const known = new Set([...example.required, ...example.optional]);
const missing = [...example.required].filter((name) => !present.has(name));
const unknown = sourceFile ? [...present].filter((name) => !known.has(name)) : [];

console.log(`Origem: ${sourceFile ?? "ambiente atual (process.env)"}`);
console.log(`Obrigatórias no .env.example: ${example.required.size}; opcionais: ${example.optional.size}`);
if (missing.length > 0) console.log(`FALTANDO (${missing.length}): ${missing.join(", ")}`);
if (unknown.length > 0) console.log(`NÃO documentadas no .env.example (${unknown.length}): ${unknown.join(", ")}`);
if (missing.length === 0 && unknown.length === 0) console.log("OK: todas as variáveis obrigatórias presentes.");

process.exit(missing.length > 0 ? 1 : 0);
