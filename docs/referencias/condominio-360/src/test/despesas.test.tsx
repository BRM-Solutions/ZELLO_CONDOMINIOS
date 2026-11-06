import { describe, expect, it } from "vitest";
import { conciliar, podeExcluir, proximoCodigo, type Despesa } from "@/lib/despesas";
import { validarAnexo } from "@/lib/anexos";
import type { Lancamento } from "@/lib/financeiro";

const desp = (p: Partial<Despesa>): Despesa => ({
  id: "d", codigo: "DESP-2026-001", condominio: "", titulo: "Compra de lâmpadas", descricao: "", tipo: "", categoria: "", valor: 85, data: "2026-10-05", competencia: "2026-10",
  fornecedor: "Casa Elétrica", responsavel: "", formaPagamento: "", origemPagamento: "", situacao: "Pago", comprovantes: [], observacoes: "", criadoEm: "", criadoPor: "", alteradoEm: "",
  historico: [], comunicacao: "Não enviado", comunicacoes: [], conciliacao: "Pendente de conferência", ...p,
});
const lanc = (p: Partial<Lancamento>): Lancamento => ({ id: "l", data: "2026-10-10", descricao: "", categoria: "", tipo: "Despesa", valor: 0, situacao: "Previsto", origem: "bal.xlsx", ...p });

describe("Notas Fiscais e Recibos", () => {
  it("gera código sequencial DESP-ano-NNN", () => {
    expect(proximoCodigo([], 2026)).toBe("DESP-2026-001");
    expect(proximoCodigo([{ codigo: "DESP-2026-001" }, { codigo: "DESP-2026-007" }], 2026)).toBe("DESP-2026-008");
  });
  it("bloqueia exclusão de despesa já comunicada ou conciliada", () => {
    expect(podeExcluir({ comunicacao: "Não enviado", conciliacao: "Pendente de conferência" })).toBe(true);
    expect(podeExcluir({ comunicacao: "Enviado", conciliacao: "Pendente de conferência" })).toBe(false);
    expect(podeExcluir({ comunicacao: "Não enviado", conciliacao: "Conciliado" })).toBe(false);
  });
});

describe("Conferência mensal", () => {
  it("valor igual só sugere correspondência, nunca concilia sozinho", () => {
    expect(conciliar([desp({})], [lanc({ valor: 85, descricao: "Diversos" })], "2026-10")[0]!.status).toBe("Possível correspondência");
  });
  it("valor diferente com descrição semelhante é divergência", () => {
    expect(conciliar([desp({ titulo: "Material hidráulico", valor: 120 })], [lanc({ valor: 110, descricao: "Material hidraulico bloco 2" })], "2026-10")[0]!.status).toBe("Divergência de valor");
  });
  it("sem correspondência fica não localizado e lançamento sobra como adicional", () => {
    const r = conciliar([desp({ valor: 180, titulo: "Serviço de eletricista" })], [lanc({ valor: 999, descricao: "Tarifa bancária" })], "2026-10");
    expect(r.map((x) => x.status)).toEqual(["Não localizado no balancete", "Lançamento adicional no balancete"]);
  });
  it("aceita lançamento no mês seguinte à competência", () => {
    expect(conciliar([desp({})], [lanc({ valor: 85, data: "2026-11-03" })], "2026-10")[0]!.status).toBe("Possível correspondência");
  });
  it("sem balancete importado fica pendente", () => {
    expect(conciliar([desp({})], [], "2026-10", false)[0]!.status).toBe("Pendente de conferência");
  });
});

describe("Anexos de ocorrência", () => {
  it("aceita foto, vídeo e documento e recusa outros formatos ou acima de 20 MB", () => {
    expect(validarAnexo("portao.jpg", 1000)).toBeNull();
    expect(validarAnexo("falha.mov", 1000)).toBeNull();
    expect(validarAnexo("laudo.docx", 1000)).toBeNull();
    expect(validarAnexo("script.exe", 1000)).not.toBeNull();
    expect(validarAnexo("grande.mp4", 21 * 1024 * 1024)).not.toBeNull();
  });
});
