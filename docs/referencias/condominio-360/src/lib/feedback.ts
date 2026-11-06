import { createMiniStore } from "@/lib/mini-store";
import type { Anexo } from "@/lib/anexos";

export const EXT_FEEDBACK = ["png", "jpg", "jpeg", "pdf", "doc", "docx", "mp4", "mov"];
export const TIPOS_FEEDBACK = ["Sugestão de melhoria", "Reportar problema (bug)"] as const;
export const AREAS_FEEDBACK = ["Painel Geral", "Financeiro", "Moradores", "Ocorrências do Condomínio", "Reservas", "Fornecedores", "Documentos", "Outros"];
export const STATUS_FEEDBACK = ["Recebido", "Em análise", "Em desenvolvimento", "Resolvido", "Encerrado"] as const;
export const PRIORIDADES = ["Baixa", "Média", "Alta", "Crítica"] as const;

export type Feedback = {
  id: string; protocolo: string; tipo: (typeof TIPOS_FEEDBACK)[number]; titulo: string; descricao: string; area?: string | undefined;
  anexos: Anexo[]; autor: string; perfil: string; condominio: string; criadoEm: string;
  status: (typeof STATUS_FEEDBACK)[number]; prioridade?: (typeof PRIORIDADES)[number] | undefined; resposta?: string | undefined;
};

/** Protocolo sequencial anual de feedback: FB-AAAA-0001. */
export const proximoProtocoloFeedback = (existentes: string[], ano: number) => {
  const pre = `FB-${ano}-`;
  const max = existentes.reduce((m, p) => (p.startsWith(pre) ? Math.max(m, Number(p.slice(pre.length)) || 0) : m), 0);
  return `${pre}${String(max + 1).padStart(4, "0")}`;
};

/** Síndico(a) só vê feedbacks do condomínio quando a opção está habilitada; os demais só os próprios. */
export function feedbacksVisiveis(lista: Feedback[], quem: { autor: string; sindico: boolean; condominio: string }, sindicoAcompanha: boolean) {
  if (quem.sindico && sindicoAcompanha) return lista.filter((f) => f.condominio === quem.condominio);
  return lista.filter((f) => f.autor === quem.autor);
}

/** Conta títulos repetidos (normalizados) para identificar problemas recorrentes. */
export const recorrencias = (lista: Feedback[]) => {
  const m = new Map<string, number>();
  lista.forEach((f) => { const k = f.titulo.trim().toLowerCase(); m.set(k, (m.get(k) ?? 0) + 1); });
  return m;
};

export const feedbackStore = createMiniStore({
  sindicoAcompanha: false,
  lista: [
    { id: "f1", protocolo: "FB-2026-0001", tipo: "Reportar problema (bug)", titulo: "Calendário não abre no celular", descricao: "Ao tocar em Reservas o calendário demora a aparecer.", area: "Reservas", anexos: [], autor: "Carlos Lima", perfil: "Moradores", condominio: "Condomínio Vila Gaudí", criadoEm: "2026-10-20T10:00:00", status: "Em análise", prioridade: "Média" },
    { id: "f2", protocolo: "FB-2026-0002", tipo: "Sugestão de melhoria", titulo: "Exportar balancete em PDF", descricao: "Seria útil baixar o balancete pronto para imprimir.", area: "Financeiro", anexos: [], autor: "Ana Souza", perfil: "Moradores", condominio: "Condomínio Vila Gaudí", criadoEm: "2026-10-28T15:30:00", status: "Recebido" },
  ] as Feedback[],
});
