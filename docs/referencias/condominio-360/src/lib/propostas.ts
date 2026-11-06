import { createMiniStore } from "@/lib/mini-store";

export type Proposta = { id: string; fornecedor: string; valor: number; prazoDias: number; escolhida: boolean };
export type Manifestacao = { autor: string; parecer: "Favorável" | "Contrária" | "Com ressalvas"; comentario: string; data: string };
export type Orcamento = {
  id: string; titulo: string; descricao: string; propostas: Proposta[];
  contratacao?: { fornecedor: string; valor: number; prazoDias: number; data: string; execucao: "Não iniciada" | "Em execução" | "Concluída" };
  manifestacoes: Manifestacao[];
};

/** Só a proposta escolhida conta como despesa prevista; as demais nunca entram no realizado. */
export const valorContratado = (orcs: Orcamento[]) => orcs.reduce((s, o) => s + (o.contratacao?.valor ?? 0), 0);

export const escolherProposta = (o: Orcamento, propostaId: string, data = new Date().toLocaleDateString("pt-BR")): Orcamento => {
  const p = o.propostas.find((x) => x.id === propostaId);
  if (!p) return o;
  return { ...o, propostas: o.propostas.map((x) => ({ ...x, escolhida: x.id === propostaId })), contratacao: { fornecedor: p.fornecedor, valor: p.valor, prazoDias: p.prazoDias, data, execucao: "Não iniciada" } };
};

export const propostasStore = createMiniStore({
  orcamentos: [
    { id: "orc1", titulo: "Pintura da fachada do Bloco 2", descricao: "Pintura externa completa com tratamento de fissuras.", manifestacoes: [{ autor: "Roberto Nunes", parecer: "Com ressalvas", comentario: "Pedir garantia mínima de 3 anos.", data: "02/11/2026" }],
      propostas: [{ id: "p1", fornecedor: "Cores & Cia", valor: 48000, prazoDias: 45, escolhida: false }, { id: "p2", fornecedor: "Pinta Bem", valor: 52500, prazoDias: 30, escolhida: false }, { id: "p3", fornecedor: "Fachada Nova", valor: 45900, prazoDias: 60, escolhida: false }] },
    { id: "orc2", titulo: "Manutenção do gerador", descricao: "Revisão anual e troca de filtros.", manifestacoes: [],
      propostas: [{ id: "p4", fornecedor: "GeraMax", valor: 3200, prazoDias: 7, escolhida: true }, { id: "p5", fornecedor: "Energia Sul", valor: 3600, prazoDias: 5, escolhida: false }],
      contratacao: { fornecedor: "GeraMax", valor: 3200, prazoDias: 7, data: "28/10/2026", execucao: "Em execução" } },
  ] as Orcamento[],
});
