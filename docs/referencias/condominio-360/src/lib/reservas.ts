export type Espaco = {
  nome: string; descricao: string; capacidade: number; preco: number;
  dias: number[]; // 0 = domingo
  cancelamentoDias: number;
};

export const ESPACOS: Espaco[] = [
  { nome: "Salão de Festas", descricao: "Espaço destinado a comemoração de festas do morador e família. Sendo proibida a sublocação do espaço.", capacidade: 60, preco: 432.26, dias: [0, 2, 3, 4, 5, 6], cancelamentoDias: 2 },
  { nome: "Churrasqueira da Piscina", descricao: "Espaço destinado a pequenos eventos, exclusivo para moradores e família. Proibida a sublocação. Valor da manutenção R$ 216,13.", capacidade: 20, preco: 216.13, dias: [0, 2, 3, 4, 5, 6], cancelamentoDias: 2 },
  { nome: "Sala de Relaxamento", descricao: "Espaço destinado aos moradores para tratamento corporal. Proibida a sublocação.", capacidade: 2, preco: 0, dias: [0, 1, 2, 3, 4, 5, 6], cancelamentoDias: 2 },
];

export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const precoLabel = (p: number) => (p === 0 ? "Gratuito" : p.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

/** ISO yyyy-mm-dd → Date local */
export const parseISO = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y!, m! - 1, d!); };
export const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type ResLike = { area: string; data: string; status: string };

export type DiaStatus = "disponivel" | "ocupada" | "indisponivel" | "passada";

export function statusDoDia(espaco: Espaco, iso: string, reservas: ResLike[], hoje = new Date()): DiaStatus {
  const d = parseISO(iso);
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (d < h) return "passada";
  if (!espaco.dias.includes(d.getDay())) return "indisponivel";
  if (reservas.some((r) => r.area === espaco.nome && r.data === iso && (r.status === "Pendente" || r.status === "Aprovada"))) return "ocupada";
  return "disponivel";
}

/** Pode cancelar até `cancelamentoDias` dias antes da data reservada. */
export function podeCancelar(iso: string, cancelamentoDias = 2, hoje = new Date()) {
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diff = Math.round((parseISO(iso).getTime() - h.getTime()) / 86400000);
  return diff >= cancelamentoDias;
}
