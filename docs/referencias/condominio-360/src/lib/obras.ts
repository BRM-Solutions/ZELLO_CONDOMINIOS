import { createMiniStore } from "@/lib/mini-store";

export type EtapaObra = { nome: string; inicio: string; fim: string; concluida: boolean };
export type Obra = {
  id: string; nome: string; tipo: "Obra" | "Melhoria" | "Instalação" | "Equipamento"; local: string; responsavel: string; fornecedor: string;
  orcamentoAprovado: number; custoRealizado: number; inicio: string; fim: string;
  status: "Planejada" | "Em andamento" | "Concluída" | "Suspensa"; etapas: EtapaObra[]; documentos: string[];
};
export const obraTone = { Planejada: "neutral", "Em andamento": "warning", "Concluída": "success", Suspensa: "danger" } as const;
export const progressoObra = (o: Pick<Obra, "etapas">) => (o.etapas.length ? Math.round((o.etapas.filter((e) => e.concluida).length / o.etapas.length) * 100) : 0);

export const obrasStore = createMiniStore({
  obras: [
    { id: "ob1", nome: "Instalação de câmeras na garagem", tipo: "Instalação", local: "Garagens Bl 1 a 3", responsavel: "Elton Grativol", fornecedor: "Segura Tech", orcamentoAprovado: 18500, custoRealizado: 9200, inicio: "2026-10-01", fim: "2026-12-15", status: "Em andamento",
      etapas: [{ nome: "Cabeamento", inicio: "2026-10-01", fim: "2026-10-30", concluida: true }, { nome: "Instalação das câmeras", inicio: "2026-11-01", fim: "2026-11-30", concluida: false }, { nome: "Configuração e testes", inicio: "2026-12-01", fim: "2026-12-15", concluida: false }], documentos: ["Proposta Segura Tech.pdf"] },
    { id: "ob2", nome: "Novos bebedouros da área de lazer", tipo: "Equipamento", local: "Piscina e quadra", responsavel: "Paula Reis", fornecedor: "Águas Pura", orcamentoAprovado: 4200, custoRealizado: 0, inicio: "2026-12-01", fim: "2026-12-20", status: "Planejada",
      etapas: [{ nome: "Compra", inicio: "2026-12-01", fim: "2026-12-05", concluida: false }, { nome: "Instalação", inicio: "2026-12-10", fim: "2026-12-20", concluida: false }], documentos: [] },
  ] as Obra[],
});
