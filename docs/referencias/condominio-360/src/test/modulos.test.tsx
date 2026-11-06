import { describe, expect, it } from "vitest";
import { podeEditarAvisos } from "@/lib/store";
import { statusContrato, faixaAlerta } from "@/lib/contratos";
import { filtrar, FILTROS_VAZIOS, type Pessoa } from "@/lib/moradores";
import { podeConceder, podeDesativarSindico, temPermissao } from "@/lib/permissoes";
import { situacaoDoDia, type Integrante } from "@/lib/equipe";
import { linhasDoTexto, montarLinhas, parseValor, validarArquivo } from "@/lib/financeiro";

const hoje = new Date(2026, 10, 2);

describe("Avisos", () => {
  it("só Síndico(a) e SuperAdministrador editam", () => {
    expect(["sindico", "superadmin", "admin", "conselho", "morador"].map((r) => podeEditarAvisos(r as "sindico"))).toEqual([true, true, false, false, false]);
  });
});

describe("Contratos", () => {
  it("status pelas datas", () => {
    expect(statusContrato({ vencimento: "2027-01-10" }, hoje)).toBe("Ativo");
    expect(statusContrato({ vencimento: "2026-12-02" }, hoje)).toBe("Próximo do vencimento");
    expect(statusContrato({ vencimento: "2026-11-01" }, hoje)).toBe("Vencido");
    expect(statusContrato({ vencimento: "2027-01-10", encerrado: true }, hoje)).toBe("Encerrado");
  });
  it("alertas a 60, 30 e 15 dias", () => {
    expect(faixaAlerta({ vencimento: "2026-12-30" }, hoje)).toBe(60);
    expect(faixaAlerta({ vencimento: "2026-11-30" }, hoje)).toBe(30);
    expect(faixaAlerta({ vencimento: "2026-11-15" }, hoje)).toBe(15);
    expect(faixaAlerta({ vencimento: "2027-03-01" }, hoje)).toBe(null);
  });
});

describe("Moradores", () => {
  const p = (nome: string, bloco: string, apto: string, vinculo: "Proprietário" | "Inquilino") => ({ id: nome, nome, email: "", telefone: "", situacao: "Ativo", unidades: [{ bloco, apto, vinculo }], acesso: { perfil: "Morador", status: "Ativo" }, historico: [] }) as Pessoa;
  const ps = [p("Joana Ávila", "Bloco 3", "102", "Proprietário"), p("Carlos Lima", "Bloco 3", "102", "Inquilino"), p("Ana", "Bloco 1", "102", "Proprietário")];
  it("busca sem acento e sem maiúsculas", () => { expect(filtrar(ps, { ...FILTROS_VAZIOS, nome: "AVILA" }).map((x) => x.id)).toEqual(["Joana Ávila"]); });
  it("combina bloco + apto + vínculo", () => { expect(filtrar(ps, { ...FILTROS_VAZIOS, bloco: "Bloco 3", apto: "102", vinculo: "Proprietário" }).map((x) => x.id)).toEqual(["Joana Ávila"]); });
});

describe("Permissões", () => {
  it("negado por padrão", () => { expect(temPermissao({ perms: [] }, "Financeiro", "Visualizar")).toBe(false); });
  it("não concede o que não tem nem estrutural", () => {
    expect(podeConceder({ perms: ["Financeiro:Visualizar"] }, "Financeiro:Editar")).toBe(false);
    expect(podeConceder({ perms: ["Perfis e Permissões:Editar"] }, "Perfis e Permissões:Editar")).toBe(false);
    expect(podeConceder({ perms: [] }, "Perfis e Permissões:Editar", true)).toBe(true);
  });
  it("único síndico não se desativa", () => { expect(podeDesativarSindico(1, true)).toBe(false); expect(podeDesativarSindico(2, true)).toBe(true); });
});

describe("Escalas", () => {
  const i: Integrante = { id: "i", nome: "X", categoriaId: "c", funcao: "", horario: "", dias: ["seg"], ativo: true };
  it("ausência sem cobertura fica vermelha; folga cinza", () => {
    expect(situacaoDoDia(i, "2026-11-02", [{ id: "a", integranteId: "i", tipo: "Ausência", data: "2026-11-02", motivo: "", responsavel: "", registradoEm: "", publicada: false }])).toBe("descoberto");
    expect(situacaoDoDia(i, "2026-11-02", [{ id: "a", integranteId: "i", tipo: "Folga", data: "2026-11-02", motivo: "", responsavel: "", registradoEm: "", publicada: false }])).toBe("folga");
    expect(situacaoDoDia(i, "2026-11-02", [])).toBe("regular");
  });
});

describe("Importação financeira", () => {
  it("aceita só xlsx, xls e pdf", () => { expect(validarArquivo("a.csv", 10)).not.toBeNull(); expect(validarArquivo("a.xlsx", 10)).toBeNull(); });
  it("lê valores em reais", () => { expect(parseValor("R$ 1.234,56")).toBe(1234.56); expect(parseValor("abc")).toBeNull(); });
  it("não inventa: valor ausente vira problema", () => {
    const [l] = montarLinhas([{ data: "10/09/2026", descricao: "Energia", categoria: "", tipo: "Despesa", valor: "" }], "x", []);
    expect(l!.problemas).toContain("Valor não identificado"); expect(l!.selecionado).toBe(false);
  });
  it("marca duplicidade", () => {
    const [l] = montarLinhas([{ data: "10/09/2026", descricao: "Energia", categoria: "", tipo: "Despesa", valor: "100,00" }], "x", [{ id: "1", data: "2026-09-10", descricao: "energia", categoria: "", tipo: "Despesa", valor: 100, situacao: "Pago", origem: "" }]);
    expect(l!.duplicado).toBe(true);
  });
  it("PDF ignora totais", () => { expect(linhasDoTexto("10/09/2026 Energia 100,00\nTotal 10/09/2026 100,00")).toHaveLength(1); });
});
