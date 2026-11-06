import { createMiniStore } from "@/lib/mini-store";

export type Prioridade = "Baixa" | "Média" | "Alta" | "Crítica";
export type OSStatus = "A fazer" | "Em execução" | "Executada" | "Validada";
export type ChecklistItem = { texto: string; feito: boolean };
export type Evidencia = { tipo: "Antes" | "Depois" | "Documento" | "Observação"; nome: string; url?: string; data: string };
export type Mensagem = { autor: string; texto: string; data: string };
export type OrdemServico = {
  id: string; codigo: string; titulo: string; local: string; recorrencia: "Pontual" | "Diária" | "Semanal" | "Mensal";
  prioridade: Prioridade; prazo: string; responsavel: string; status: OSStatus;
  checklist: ChecklistItem[]; evidencias: Evidencia[]; mensagens: Mensagem[]; obraId?: string; ocorrenciaId?: string;
};

export const PRIORIDADES: Prioridade[] = ["Baixa", "Média", "Alta", "Crítica"];
export const prioridadeTone = { Baixa: "neutral", "Média": "info", Alta: "warning", "Crítica": "danger" } as const;
export const osTone = { "A fazer": "neutral", "Em execução": "warning", Executada: "info", Validada: "success" } as const;
export const ZELADOR = "José Carlos";

const hoje = (o = 0) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().slice(0, 10); };
export const atrasada = (os: Pick<OrdemServico, "prazo" | "status">, ref = hoje()) => os.status !== "Validada" && os.status !== "Executada" && os.prazo < ref;

/** Zelador só sinaliza execução; validação é do síndico. */
export const proximoStatusOS = (atual: OSStatus, papel: "zelador" | "sindico"): OSStatus | null => {
  if (papel === "zelador") return atual === "A fazer" ? "Em execução" : atual === "Em execução" ? "Executada" : null;
  return atual === "Executada" ? "Validada" : null;
};

export const proximoCodigoOS = (codigos: string[], ano = new Date().getFullYear()) => {
  const n = codigos.filter((c) => c.startsWith(`OS-${ano}-`)).map((c) => Number(c.split("-")[2])).reduce((a, b) => Math.max(a, b), 0);
  return `OS-${ano}-${String(n + 1).padStart(4, "0")}`;
};

const ck = (...t: string[]) => t.map((texto) => ({ texto, feito: false }));
const y = new Date().getFullYear();
export const ordensStore = createMiniStore({
  ordens: [
    { id: "os1", codigo: `OS-${y}-0001`, titulo: "Ronda e limpeza da piscina", local: "Piscina", recorrencia: "Diária", prioridade: "Média", prazo: hoje(), responsavel: ZELADOR, status: "A fazer", checklist: ck("Retirar folhas", "Medir cloro e pH", "Registrar leitura"), evidencias: [], mensagens: [] },
    { id: "os2", codigo: `OS-${y}-0002`, titulo: "Verificar portão da garagem - Bloco 1", local: "Garagem Bl 1", recorrencia: "Pontual", prioridade: "Alta", prazo: hoje(1), responsavel: ZELADOR, status: "Em execução", checklist: ck("Testar abertura", "Lubrificar trilho", "Chamar fornecedor se necessário"), evidencias: [], mensagens: [{ autor: "Elton Grativol", texto: "Prioridade: moradores reclamaram hoje.", data: hoje() }], ocorrenciaId: "o1" },
    { id: "os3", codigo: `OS-${y}-0003`, titulo: "Troca de lâmpadas da quadra", local: "Quadra", recorrencia: "Pontual", prioridade: "Média", prazo: hoje(-2), responsavel: ZELADOR, status: "A fazer", checklist: ck("Separar lâmpadas", "Trocar", "Testar"), evidencias: [], mensagens: [], ocorrenciaId: "o2" },
    { id: "os4", codigo: `OS-${y}-0004`, titulo: "Limpeza da casa de bombas", local: "Casa de bombas", recorrencia: "Semanal", prioridade: "Baixa", prazo: hoje(-1), responsavel: ZELADOR, status: "Executada", checklist: [{ texto: "Varrer", feito: true }, { texto: "Verificar vazamentos", feito: true }], evidencias: [{ tipo: "Observação", nome: "Sem vazamentos.", data: hoje(-1) }], mensagens: [] },
  ] as OrdemServico[],
});
