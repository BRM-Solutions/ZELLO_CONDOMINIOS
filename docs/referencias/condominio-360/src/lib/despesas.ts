import { createMiniStore } from "@/lib/mini-store";
import type { Anexo } from "@/lib/anexos";
import type { Lancamento } from "@/lib/financeiro";

export const TIPOS_DESPESA = ["Compra de material", "Serviço avulso", "Manutenção corretiva", "Manutenção preventiva", "Reembolso", "Despesa emergencial", "Despesa recorrente", "Outros"];
export const CATEGORIAS_FIN = ["Elétrica e iluminação", "Hidráulica", "Limpeza", "Jardinagem", "Piscina", "Segurança", "Portões e acessos", "Bombas e reservatórios", "Áreas comuns", "Materiais e suprimentos", "Serviços terceirizados", "Administração", "Outras despesas"];
export const FORMAS_PAG = ["PIX", "Cartão", "Transferência", "Boleto", "Dinheiro", "Outro"] as const;
export const ORIGENS_PAG = ["Conta do condomínio", "Recursos próprios do síndico", "Recursos de outro responsável autorizado", "Pagamento direto pela administradora"] as const;
export const SITUACOES_FIN = ["A pagar", "Pago", "Reembolso pendente", "Reembolsado", "Cancelado"] as const;
export const STATUS_COM = ["Não enviado", "Preparado para envio", "Enviado", "Recebimento confirmado", "Pendente de correção"] as const;
export const STATUS_CONC = ["Pendente de conferência", "Conciliado", "Possível correspondência", "Não localizado no balancete", "Divergência de valor", "Lançamento adicional no balancete"] as const;

export type StatusCom = (typeof STATUS_COM)[number];
export type StatusConc = (typeof STATUS_CONC)[number];
export type Historico = { em: string; por: string; acao: string };
export type Comunicacao = { em: string; por: string; destinatario: string; meio: string; id: string; status: StatusCom };

export type Despesa = {
  id: string; codigo: string; condominio: string;
  titulo: string; descricao: string; tipo: string; categoria: string; valor: number; data: string; competencia: string;
  fornecedor: string; responsavel: string; formaPagamento: string; origemPagamento: string; situacao: (typeof SITUACOES_FIN)[number];
  comprovantes: Anexo[]; observacoes: string;
  criadoEm: string; criadoPor: string; alteradoEm: string;
  historico: Historico[]; comunicacao: StatusCom; comunicacoes: Comunicacao[];
  conciliacao: StatusConc; conciliacaoManual?: boolean; lancamentoId?: string; obsConferencia?: string;
};

/** Próximo identificador sequencial por ano: DESP-2026-001. */
export function proximoCodigo(existentes: Pick<Despesa, "codigo">[], ano = new Date().getFullYear()) {
  const pref = `DESP-${ano}-`;
  const max = existentes.filter((d) => d.codigo.startsWith(pref)).reduce((m, d) => Math.max(m, Number(d.codigo.slice(pref.length)) || 0), 0);
  return `${pref}${String(max + 1).padStart(3, "0")}`;
}

/** Registros já comunicados ou conciliados não podem ser excluídos — apenas cancelados. */
export const podeExcluir = (d: Pick<Despesa, "comunicacao" | "conciliacao">) => d.comunicacao === "Não enviado" && d.conciliacao !== "Conciliado";

const mesesEntre = (a: string, b: string) => { const [ya, ma] = a.split("-").map(Number); const [yb, mb] = b.split("-").map(Number); return Math.abs((ya! - yb!) * 12 + (ma! - mb!)); };

export type ResultadoConc = { despesa?: Despesa | undefined; lancamento?: Lancamento | undefined; status: StatusConc };

/**
 * Compara despesas da competência com lançamentos de despesa do balancete.
 * Aceita lançamentos até 1 mês de distância (data ≠ competência). Valor igual vira apenas
 * "Possível correspondência": só o usuário confirma "Conciliado".
 */
export function conciliar(despesas: Despesa[], lancamentos: Lancamento[], competencia: string, temBalancete = true): ResultadoConc[] {
  const doMes = despesas.filter((d) => d.situacao !== "Cancelado" && d.competencia === competencia);
  const cand = lancamentos.filter((l) => l.tipo === "Despesa" && l.data && mesesEntre(l.data.slice(0, 7), competencia) <= 1);
  const usados = new Set(despesas.filter((d) => d.conciliacaoManual && d.lancamentoId).map((d) => d.lancamentoId!));
  const out: ResultadoConc[] = doMes.map((d) => {
    if (d.conciliacaoManual) return { despesa: d, lancamento: cand.find((l) => l.id === d.lancamentoId), status: d.conciliacao };
    if (!temBalancete) return { despesa: d, status: "Pendente de conferência" };
    const livres = cand.filter((l) => !usados.has(l.id));
    const igual = livres.find((l) => Math.abs(l.valor - d.valor) < 0.01);
    if (igual) { usados.add(igual.id); return { despesa: d, lancamento: igual, status: "Possível correspondência" }; }
    const palavras = (s: string) => new Set(s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\W+/).filter((w) => w.length > 3));
    const pd = palavras(`${d.titulo} ${d.fornecedor}`);
    const parecido = livres.find((l) => [...palavras(l.descricao)].some((w) => pd.has(w)) && Math.abs(l.valor - d.valor) / d.valor <= 0.3);
    if (parecido) { usados.add(parecido.id); return { despesa: d, lancamento: parecido, status: "Divergência de valor" }; }
    return { despesa: d, status: "Não localizado no balancete" };
  });
  if (temBalancete) for (const l of cand.filter((l) => l.data.startsWith(competencia) && !usados.has(l.id))) out.push({ lancamento: l, status: "Lançamento adicional no balancete" });
  return out;
}

export function indicadores(r: ResultadoConc[]) {
  const reg = r.filter((x) => x.despesa);
  const conc = reg.filter((x) => x.status === "Conciliado").length;
  return {
    total: reg.length, conciliadas: conc,
    naoLocalizadas: reg.filter((x) => x.status === "Não localizado no balancete").length,
    divergencias: reg.filter((x) => x.status === "Divergência de valor").length,
    valorPendente: reg.filter((x) => x.status !== "Conciliado").reduce((a, x) => a + x.despesa!.valor, 0),
    percentual: reg.length ? Math.round((conc / reg.length) * 100) : 0,
  };
}

export function mensagemAdministradora(d: Despesa, condominio: string) {
  return `Assunto: Registro de despesa para contabilização — Gaudí 360°

Prezados,

Encaminhamos o registro da despesa abaixo para conferência e contabilização na competência correspondente.

Condomínio: ${condominio}
Identificador: ${d.codigo}
Despesa: ${d.titulo}
Descrição: ${d.descricao}
Tipo: ${d.tipo}
Categoria: ${d.categoria}
Data: ${d.data.split("-").reverse().join("/")}
Valor: ${d.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
Forma de pagamento: ${d.formaPagamento}
Responsável: ${d.responsavel}
Comprovantes: ${d.comprovantes.map((c) => c.nome).join(", ") || "nenhum"}

Solicitamos a confirmação do recebimento e a inclusão da despesa no balancete correspondente, quando aplicável.

Atenciosamente,
Administração do ${condominio}`;
}

export const despStore = createMiniStore({ despesas: [] as Despesa[], categorias: [...CATEGORIAS_FIN], emailAdministradora: "" });
