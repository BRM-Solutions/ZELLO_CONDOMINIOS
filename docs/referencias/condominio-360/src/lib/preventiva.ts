import { createMiniStore } from "@/lib/mini-store";

export type Periodicidade = "Semanal" | "Mensal" | "Trimestral" | "Semestral" | "Anual";
export type Preventiva = { id: string; item: string; local: string; periodicidade: Periodicidade; responsavel: string; criticidade: "Baixa" | "Média" | "Alta" | "Crítica"; ultima: string; proxima: string; evidencias: string[]; historico: string[] };

const MESES: Record<Periodicidade, number> = { Semanal: 0, Mensal: 1, Trimestral: 3, Semestral: 6, Anual: 12 };
export const calcularProxima = (data: string, p: Periodicidade) => {
  const d = new Date(`${data}T12:00:00`);
  if (p === "Semanal") d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + MESES[p]);
  return d.toISOString().slice(0, 10);
};
export const hojeISO = () => new Date().toISOString().slice(0, 10);
export const situacaoPreventiva = (p: Pick<Preventiva, "proxima">, ref = hojeISO()) => {
  if (p.proxima < ref) return "Atrasada" as const;
  const lim = new Date(`${ref}T12:00:00`); lim.setDate(lim.getDate() + 15);
  return p.proxima <= lim.toISOString().slice(0, 10) ? ("Próxima" as const) : ("Em dia" as const);
};

const off = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const preventivaStore = createMiniStore({
  itens: [
    { id: "pv1", item: "Higienização dos reservatórios de água", local: "Cobertura Bl 1 a 3", periodicidade: "Semestral", responsavel: "Hidro Limp", criticidade: "Crítica", ultima: off(-170), proxima: off(10), evidencias: ["Certificado de limpeza (último).pdf"], historico: [] },
    { id: "pv2", item: "Revisão dos extintores", local: "Todos os blocos", periodicidade: "Anual", responsavel: "Fogo Zero", criticidade: "Crítica", ultima: off(-370), proxima: off(-5), evidencias: [], historico: [] },
    { id: "pv3", item: "Manutenção dos elevadores", local: "Bl 1 a 3", periodicidade: "Mensal", responsavel: "Elevar", criticidade: "Alta", ultima: off(-20), proxima: off(10), evidencias: [], historico: [] },
    { id: "pv4", item: "Revisão dos automáticos e quadros elétricos", local: "Todos os blocos", periodicidade: "Trimestral", responsavel: "José Carlos", criticidade: "Média", ultima: off(-40), proxima: off(50), evidencias: [], historico: [] },
    { id: "pv5", item: "Limpeza das caixas de gordura", local: "Térreo", periodicidade: "Mensal", responsavel: "José Carlos", criticidade: "Média", ultima: off(-28), proxima: off(2), evidencias: [], historico: [] },
  ] as Preventiva[],
});
