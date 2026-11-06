import { createMiniStore } from "@/lib/mini-store";
import { toISO } from "@/lib/reservas";

export type Categoria = { id: string; nome: string; ativa: boolean };
export type Integrante = { id: string; nome: string; categoriaId: string; funcao: string; horario: string; dias: string[]; ativo: boolean };
export type TipoAlteracao = "Folga" | "Férias" | "Ausência" | "Substituição" | "Horário temporário" | "Observação";
export type Alteracao = {
  id: string; integranteId: string; tipo: TipoAlteracao; data: string;
  horarioAnterior?: string; novoHorario?: string; motivo: string; responsavel: string; registradoEm: string;
  coberto?: boolean; publicada: boolean;
};
export type Situacao = "regular" | "alterado" | "folga" | "descoberto";

export const SITUACAO: Record<Situacao, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  regular: { label: "Escala regular", tone: "success" },
  alterado: { label: "Horário alterado", tone: "warning" },
  folga: { label: "Folga", tone: "neutral" },
  descoberto: { label: "Ausência sem cobertura", tone: "danger" },
};

export const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Situação de um integrante em um dia, considerando suas alterações. */
export function situacaoDoDia(i: Integrante, iso: string, alts: Alteracao[]): Situacao | null {
  const a = alts.filter((x) => x.integranteId === i.id && x.data === iso && x.tipo !== "Observação");
  if (a.some((x) => (x.tipo === "Ausência" || x.tipo === "Férias") && !x.coberto)) return "descoberto";
  if (a.some((x) => x.tipo === "Folga" || ((x.tipo === "Ausência" || x.tipo === "Férias") && x.coberto))) return "folga";
  if (a.some((x) => x.tipo === "Horário temporário" || x.tipo === "Substituição")) return "alterado";
  const dow = DIAS[new Date(iso + "T12:00").getDay()]!;
  return i.dias.includes(dow) ? "regular" : null;
}

export function avisoModelo(servico: string, dataBR: string, horario: string, obs = "") {
  return `Informamos à comunidade que haverá uma alteração no horário de funcionamento de ${servico} no dia ${dataBR}.\n\nHorário: ${horario || "a confirmar"}\n${obs ? `\nObservação: ${obs}\n` : ""}\nAgradecemos a compreensão de todos.\n\nAdministração do Condomínio Vila Gaudí`;
}

const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() + n); return toISO(x); };

export const equipeStore = createMiniStore({
  categorias: [
    { id: "zel", nome: "Zelador", ativa: true },
    { id: "lim", nome: "Equipe de limpeza", ativa: true },
    { id: "pis", nome: "Guardião da piscina", ativa: true },
    { id: "man", nome: "Manutenção", ativa: true },
    { id: "out", nome: "Outros prestadores de serviço", ativa: true },
  ] as Categoria[],
  integrantes: [
    { id: "i1", nome: "Rita Alves", categoriaId: "zel", funcao: "Zeladora", horario: "08:00–17:00", dias: ["seg", "ter", "qua", "qui", "sex"], ativo: true },
    { id: "i2", nome: "Equipe Brilho", categoriaId: "lim", funcao: "Limpeza das áreas comuns", horario: "07:00–15:00", dias: ["seg", "ter", "qua", "qui", "sex", "sáb"], ativo: true },
    { id: "i3", nome: "Paulo Santos", categoriaId: "pis", funcao: "Guardião da piscina", horario: "09:00–18:00", dias: ["ter", "qua", "qui", "sex", "sáb", "dom"], ativo: true },
    { id: "i4", nome: "Jorge Lima", categoriaId: "man", funcao: "Manutenção predial", horario: "08:00–16:00", dias: ["seg", "qua", "sex"], ativo: true },
  ] as Integrante[],
  alteracoes: [
    { id: "a1", integranteId: "i3", tipo: "Horário temporário", data: d(2), horarioAnterior: "09:00–18:00", novoHorario: "12:00–18:00", motivo: "Manutenção do filtro da piscina", responsavel: "Elton Grativol", registradoEm: new Date().toISOString(), publicada: true },
    { id: "a2", integranteId: "i1", tipo: "Folga", data: d(3), motivo: "Compensação de horas", responsavel: "Elton Grativol", registradoEm: new Date().toISOString(), publicada: false },
  ] as Alteracao[],
});
