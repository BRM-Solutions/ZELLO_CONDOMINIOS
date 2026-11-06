export const CATEGORIAS = ["Manutenção", "Reclamação", "Sugestões", "Elogio", "Outros"] as const;
export type Categoria = (typeof CATEGORIAS)[number];
export type OcorrStatus = "Aberta" | "Em andamento" | "Executada" | "Concluída";
export const STATUS_OCORRENCIA: OcorrStatus[] = ["Aberta", "Em andamento", "Executada", "Concluída"];
export type Ocorrencia = {
  id: string; protocolo?: string; titulo: string; categoria: Categoria; descricao: string; status: OcorrStatus;
  prioridade?: "Baixa" | "Média" | "Alta" | "Crítica"; solucao?: string;
  autor: string; apto: string; criadaEm: string; concluidaEm?: string | undefined; // ISO datetime
  anexos?: import("@/lib/anexos").Anexo[];
};

export const isCategoria = (c: string): c is Categoria => (CATEGORIAS as readonly string[]).includes(c);

export const doMesAtual = (lista: Ocorrencia[], hoje = new Date()) =>
  lista.filter((o) => { const d = new Date(o.criadaEm); return d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth(); });

export const fmtDataHora = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

export const statusTone = { Aberta: "danger", "Em andamento": "warning", Executada: "info", "Concluída": "success" } as const;

/** Zelador informa execução, mas nunca conclui administrativamente; só síndico/administração concluem. */
export function podeAlterarStatus(role: string, para: OcorrStatus) {
  if (role === "zelador") return para === "Em andamento" || para === "Executada";
  if (role === "sindico" || role === "admin") return true;
  return false;
}
