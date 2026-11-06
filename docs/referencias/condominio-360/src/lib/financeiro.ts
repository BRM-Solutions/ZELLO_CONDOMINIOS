import { createMiniStore } from "@/lib/mini-store";

export type TipoMov = "Receita" | "Despesa";
export type Lancamento = { id: string; data: string; descricao: string; categoria: string; tipo: TipoMov; valor: number; situacao: "Previsto" | "Pago" | "Recebido" | "Conciliado"; origem: string };
export type Linha = Omit<Lancamento, "id" | "situacao"> & { id: string; selecionado: boolean; problemas: string[]; duplicado: boolean };
export type ImportStatus = "Enviado" | "Em processamento" | "Aguardando conferência" | "Importado" | "Importado parcialmente" | "Rejeitado" | "Falha no processamento" | "Anexado";
export type Importacao = { id: string; arquivo: string; tipo: string; tamanho: number; periodo: string; data: string; responsavel: string; registros: number; status: ImportStatus; url?: string };

export const EXTENSOES = ["xlsx", "xls", "pdf"];
export const MAX_MB = 15;

export function validarArquivo(nome: string, bytes: number): string | null {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (!EXTENSOES.includes(ext)) return "Formato não aceito. Envie .xlsx, .xls ou .pdf.";
  if (bytes === 0) return "Arquivo vazio.";
  if (bytes > MAX_MB * 1024 * 1024) return `Arquivo maior que ${MAX_MB} MB.`;
  return null;
}

/** Converte "1.234,56", "R$ -50,00", "(50,00)" ou números em valor. Retorna null se não for possível. */
export function parseValor(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v !== "string") return null;
  let s = v.replace(/R\$|\s/g, "");
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\-]/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return isFinite(n) ? (neg ? -n : n) : null;
}

/** Converte "dd/mm/aaaa", "aaaa-mm-dd" ou número serial do Excel em ISO. */
export function parseData(v: unknown): string | null {
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  if (v instanceof Date && !isNaN(+v)) return v.toISOString().slice(0, 10);
  if (typeof v !== "string") return null;
  const br = v.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10);
  return null;
}

export const chaveDup = (l: Pick<Lancamento, "data" | "descricao" | "valor">) => `${l.data}|${l.descricao.trim().toLowerCase()}|${l.valor.toFixed(2)}`;

/** Monta linhas para conferência sem inventar valores: campos ausentes viram problemas a revisar. */
export function montarLinhas(brutas: { data: unknown; descricao: unknown; categoria: unknown; tipo: unknown; valor: unknown }[], origem: string, existentes: Lancamento[]): Linha[] {
  const vistos = new Set(existentes.map(chaveDup));
  return brutas.map((b, i) => {
    const problemas: string[] = [];
    const data = parseData(b.data); if (!data) problemas.push("Data não identificada");
    const valorRaw = parseValor(b.valor); if (valorRaw === null) problemas.push("Valor não identificado");
    const descricao = String(b.descricao ?? "").trim(); if (!descricao) problemas.push("Sem descrição");
    const tStr = String(b.tipo ?? "").toLowerCase();
    let tipo: TipoMov | null = tStr.startsWith("rec") || tStr.startsWith("créd") || tStr.startsWith("cred") ? "Receita" : tStr.startsWith("desp") || tStr.startsWith("déb") || tStr.startsWith("deb") ? "Despesa" : null;
    if (!tipo && valorRaw !== null) tipo = valorRaw < 0 ? "Despesa" : null;
    if (!tipo) problemas.push("Tipo não identificado");
    const valor = Math.abs(valorRaw ?? 0);
    const linha = { id: `l${i}`, data: data ?? "", descricao, categoria: String(b.categoria ?? "").trim(), tipo: tipo ?? "Despesa", valor, origem };
    const dup = !problemas.length && vistos.has(chaveDup(linha));
    if (!problemas.length) vistos.add(chaveDup(linha));
    return { ...linha, problemas, duplicado: dup, selecionado: !problemas.length && !dup };
  });
}

/** Extrai do texto de um PDF apenas linhas com data e valor explícitos. */
export function linhasDoTexto(texto: string) {
  const out: { data: string; descricao: string; categoria: string; tipo: string; valor: string }[] = [];
  for (const raw of texto.split(/\n/)) {
    const l = raw.trim();
    const d = l.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
    const v = l.match(/(-?\(?R?\$?\s?\d{1,3}(?:\.\d{3})*,\d{2}\)?)\s*$/);
    if (!d || !v) continue;
    const desc = l.replace(d[0], "").replace(v[0], "").replace(/\s{2,}/g, " ").trim();
    if (/^total|subtotal/i.test(desc)) continue; // totais não viram lançamentos
    out.push({ data: d[1]!, descricao: desc, categoria: "", tipo: v[1]!.includes("-") || v[1]!.includes("(") ? "Despesa" : "", valor: v[1]! });
  }
  return out;
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const finStore = createMiniStore({
  lancamentos: [
    { id: "x1", data: "2026-09-10", descricao: "Taxa condominial - Setembro", categoria: "Taxas", tipo: "Receita", valor: 220720, situacao: "Recebido", origem: "Lançamento manual" },
    { id: "x2", data: "2026-09-05", descricao: "Folha de pagamento", categoria: "Pessoal", tipo: "Despesa", valor: 92400, situacao: "Pago", origem: "Lançamento manual" },
    { id: "x3", data: "2026-09-20", descricao: "Conta de energia", categoria: "Água e Energia", tipo: "Despesa", valor: 18300, situacao: "Previsto", origem: "Lançamento manual" },
  ] as Lancamento[],
  importacoes: [] as Importacao[],
});
