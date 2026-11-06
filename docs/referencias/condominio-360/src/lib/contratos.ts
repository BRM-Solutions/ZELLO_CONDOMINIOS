import { createMiniStore } from "@/lib/mini-store";

export type Fornecedor = { id: string; nome: string; servico: string };
export type Contrato = {
  id: string; fornecedorId: string; servico: string; numero: string; assinatura: string; inicio: string; vencimento: string;
  valor: number | null; periodicidade: string; observacoes: string; arquivo?: { nome: string; url: string };
  encerrado?: boolean; prorrogado?: boolean; cadastradoEm: string;
};
export type ContratoStatus = "Ativo" | "Próximo do vencimento" | "Vencido" | "Encerrado";

export const STATUS_TONE: Record<ContratoStatus, "success" | "warning" | "danger" | "neutral"> = {
  Ativo: "success", "Próximo do vencimento": "warning", Vencido: "danger", Encerrado: "neutral",
};

const DIA = 86_400_000;
export const diasAte = (iso: string, hoje = new Date()) => {
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return Math.round((new Date(iso + "T00:00").getTime() - h) / DIA);
};

/** Ativo; Próximo do vencimento (≤30 dias); Vencido (data passou); Encerrado (marcado pela gestão). */
export function statusContrato(c: Pick<Contrato, "vencimento" | "encerrado">, hoje = new Date()): ContratoStatus {
  if (c.encerrado) return "Encerrado";
  const n = diasAte(c.vencimento, hoje);
  if (n < 0) return "Vencido";
  if (n <= 30) return "Próximo do vencimento";
  return "Ativo";
}

/** Faixa de alerta no painel: 60, 30 ou 15 dias antes do vencimento. */
export function faixaAlerta(c: Pick<Contrato, "vencimento" | "encerrado">, hoje = new Date()): 60 | 30 | 15 | null {
  if (c.encerrado) return null;
  const n = diasAte(c.vencimento, hoje);
  if (n < 0 || n > 60) return null;
  return n <= 15 ? 15 : n <= 30 ? 30 : 60;
}

/** Contrato vigente mais recente (não encerrado) do fornecedor. */
export const contratoAtivo = (fid: string, cs: Contrato[]) =>
  cs.filter((c) => c.fornecedorId === fid && !c.encerrado).sort((a, b) => b.inicio.localeCompare(a.inicio))[0];

const iso = (n: number) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

export const contratosStore = createMiniStore({
  fornecedores: [
    { id: "f1", nome: "Limpeza Brilho Ltda", servico: "Limpeza" },
    { id: "f2", nome: "Elevadores Atlas", servico: "Manutenção de elevadores" },
    { id: "f3", nome: "Acqua Plus", servico: "Manutenção da piscina" },
    { id: "f4", nome: "Jardins Niterói", servico: "Paisagismo" },
  ] as Fornecedor[],
  contratos: [
    { id: "k1", fornecedorId: "f1", servico: "Limpeza", numero: "CT-2025/014", assinatura: iso(-300), inicio: iso(-290), vencimento: iso(200), valor: 14800, periodicidade: "Mensal", observacoes: "", cadastradoEm: iso(-300) },
    { id: "k2", fornecedorId: "f2", servico: "Manutenção de elevadores", numero: "CT-2024/007", assinatura: iso(-700), inicio: iso(-690), vencimento: iso(-325), valor: 3000, periodicidade: "Mensal", observacoes: "Contrato anterior", encerrado: true, cadastradoEm: iso(-700) },
    { id: "k3", fornecedorId: "f2", servico: "Manutenção de elevadores", numero: "CT-2025/021", assinatura: iso(-330), inicio: iso(-325), vencimento: iso(40), valor: 3200, periodicidade: "Mensal", observacoes: "Renovação", cadastradoEm: iso(-330) },
    { id: "k4", fornecedorId: "f3", servico: "Manutenção", numero: "CT-2025/030", assinatura: iso(-350), inicio: iso(-345), vencimento: iso(12), valor: 1900, periodicidade: "Mensal", observacoes: "", cadastradoEm: iso(-350) },
  ] as Contrato[],
});
