import { describe, expect, it } from "vitest";
import { podeAlterarStatus } from "@/lib/ocorrencias";
import { proximoStatusOS } from "@/lib/ordens";
import { escolherProposta, valorContratado, type Orcamento } from "@/lib/propostas";
import { MODELOS, validarCsv } from "@/lib/importacao";

describe("Documento ZELLO", () => {
  it("zelador sinaliza execução mas não conclui ocorrência", () => {
    expect(podeAlterarStatus("zelador", "Executada")).toBe(true);
    expect(podeAlterarStatus("zelador", "Concluída")).toBe(false);
    expect(podeAlterarStatus("sindico", "Concluída")).toBe(true);
  });
  it("zelador não valida ordem de serviço; síndico valida a executada", () => {
    expect(proximoStatusOS("Executada", "zelador")).toBeNull();
    expect(proximoStatusOS("Executada", "sindico")).toBe("Validada");
  });
  it("só a proposta escolhida conta como contratada", () => {
    const o: Orcamento = { id: "1", titulo: "x", descricao: "", manifestacoes: [], propostas: [{ id: "a", fornecedor: "A", valor: 100, prazoDias: 1, escolhida: false }, { id: "b", fornecedor: "B", valor: 300, prazoDias: 1, escolhida: false }] };
    expect(valorContratado([o])).toBe(0);
    expect(valorContratado([escolherProposta(o, "b")])).toBe(300);
  });
  it("importação rejeita obrigatório vazio e duplicadas", () => {
    const m = MODELOS.find((x) => x.modulo === "Ordens de Serviço")!;
    const r = validarCsv("titulo;local;prazo\nA;Hall;2026-12-01\nA;Hall;2026-12-02\nB;;2026-12-01\nC;Hall;2026-12-01", m, ["c"]);
    expect(r.linhas.map((l) => l.situacao)).toEqual(["Criar", "Duplicada", "Rejeitada", "Duplicada"]);
    expect(validarCsv("titulo;local\nA;B", m).erroEstrutura).toContain("prazo");
  });
});
