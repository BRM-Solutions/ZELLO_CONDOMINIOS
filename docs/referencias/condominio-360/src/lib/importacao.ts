export type ModeloImportacao = { modulo: string; obrigatorios: string[]; opcionais: string[]; chave: string; exemplo: string[] };

export const MODELOS: ModeloImportacao[] = [
  { modulo: "Manutenção Preventiva", obrigatorios: ["item", "local", "periodicidade", "proxima_execucao"], opcionais: ["responsavel", "criticidade"], chave: "item", exemplo: ["Limpeza da caixa d'água", "Cobertura", "Semestral", "2026-12-10", "Fornecedor X", "Alta"] },
  { modulo: "Ordens de Serviço", obrigatorios: ["titulo", "local", "prazo"], opcionais: ["prioridade", "responsavel"], chave: "titulo", exemplo: ["Trocar lâmpadas", "Hall Bl 1", "2026-11-20", "Média", "José Carlos"] },
  { modulo: "Contratos", obrigatorios: ["fornecedor", "objeto", "valor", "inicio", "termino"], opcionais: ["arquivo"], chave: "fornecedor", exemplo: ["Limpa Mais", "Limpeza", "5400", "2026-01-01", "2026-12-31", "contrato.pdf"] },
  { modulo: "Ocorrências", obrigatorios: ["titulo", "categoria"], opcionais: ["descricao", "unidade"], chave: "titulo", exemplo: ["Vazamento", "Manutenção", "Garagem", "Bl 2 • 201"] },
  { modulo: "Obras e Instalações", obrigatorios: ["nome", "local", "orcamento"], opcionais: ["fornecedor", "inicio", "fim"], chave: "nome", exemplo: ["Novas câmeras", "Garagem", "18500", "Segura Tech", "2026-12-01", "2027-01-15"] },
];

export const templateCsv = (m: ModeloImportacao) => [[...m.obrigatorios, ...m.opcionais].join(";"), m.exemplo.join(";")].join("\n");

export type LinhaValidada = { linha: number; dados: Record<string, string>; erros: string[]; situacao: "Criar" | "Duplicada" | "Rejeitada" };

/** Valida CSV (; ou ,) antes de gravar: estrutura, obrigatórios e duplicidades (no arquivo e nos existentes). */
export function validarCsv(texto: string, m: ModeloImportacao, existentes: string[] = []) {
  const linhas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!linhas.length) return { erroEstrutura: "Arquivo vazio.", linhas: [] as LinhaValidada[] };
  const sep = linhas[0]!.includes(";") ? ";" : ",";
  const cab = linhas[0]!.split(sep).map((c) => c.trim().toLowerCase());
  const faltando = m.obrigatorios.filter((c) => !cab.includes(c));
  if (faltando.length) return { erroEstrutura: `Colunas obrigatórias ausentes: ${faltando.join(", ")}.`, linhas: [] as LinhaValidada[] };
  const vistos = new Set(existentes.map((e) => e.trim().toLowerCase()));
  const out: LinhaValidada[] = linhas.slice(1).map((l, i) => {
    const vals = l.split(sep);
    const dados = Object.fromEntries(cab.map((c, j) => [c, (vals[j] ?? "").trim()]));
    const erros = m.obrigatorios.filter((c) => !dados[c]).map((c) => `Campo obrigatório vazio: ${c}`);
    const k = (dados[m.chave] ?? "").toLowerCase();
    let situacao: LinhaValidada["situacao"] = erros.length ? "Rejeitada" : "Criar";
    if (!erros.length && vistos.has(k)) { situacao = "Duplicada"; erros.push("Registro já existe ou repetido no arquivo"); }
    if (k) vistos.add(k);
    return { linha: i + 2, dados, erros, situacao };
  });
  return { erroEstrutura: null as string | null, linhas: out };
}
