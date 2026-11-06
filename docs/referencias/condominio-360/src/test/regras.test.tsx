import { describe, expect, it } from "vitest";
import { ESPACOS, podeCancelar, statusDoDia } from "@/lib/reservas";
import { CATEGORIAS, doMesAtual, type Ocorrencia } from "@/lib/ocorrencias";

const hoje = new Date(2026, 10, 2); // seg 02/11/2026
const salao = ESPACOS.find((e) => e.nome === "Salão de Festas")!;
const sala = ESPACOS.find((e) => e.nome === "Sala de Relaxamento")!;

describe("Reservas", () => {
  it("tem os três espaços com preços corretos", () => {
    expect(ESPACOS.map((e) => [e.nome, e.preco, e.capacidade])).toEqual([
      ["Salão de Festas", 432.26, 60], ["Churrasqueira da Piscina", 216.13, 20], ["Sala de Relaxamento", 0, 2],
    ]);
  });
  it("segunda é indisponível no Salão e disponível na Sala de Relaxamento", () => {
    expect(statusDoDia(salao, "2026-11-09", [], hoje)).toBe("indisponivel");
    expect(statusDoDia(sala, "2026-11-09", [], hoje)).toBe("disponivel");
  });
  it("dia com reserva pendente ou aprovada fica ocupado", () => {
    expect(statusDoDia(salao, "2026-11-10", [{ area: "Salão de Festas", data: "2026-11-10", status: "Pendente" }], hoje)).toBe("ocupada");
    expect(statusDoDia(salao, "2026-11-10", [{ area: "Salão de Festas", data: "2026-11-10", status: "Cancelada" }], hoje)).toBe("disponivel");
  });
  it("cancelamento só até 2 dias antes", () => {
    expect(podeCancelar("2026-11-04", 2, hoje)).toBe(true);
    expect(podeCancelar("2026-11-03", 2, hoje)).toBe(false);
  });
});

describe("Ocorrências", () => {
  it("categorias aceitas", () => {
    expect([...CATEGORIAS]).toEqual(["Manutenção", "Reclamação", "Sugestões", "Elogio", "Outros"]);
  });
  it("painel mostra só o mês atual", () => {
    const o = (id: string, criadaEm: string) => ({ id, criadaEm } as Ocorrencia);
    expect(doMesAtual([o("a", new Date(2026, 10, 1).toISOString()), o("b", new Date(2026, 9, 30).toISOString())], hoje).map((x) => x.id)).toEqual(["a"]);
  });
});
