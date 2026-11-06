import { describe, expect, it } from "vitest";
import { NAV_ITEMS, navPath, visibleBottomNavItems, visibleNavItems } from "./nav";

// Ordem de docs/13 secao 6.2 (AppShell.tsx:14-39 do mock).
const DOC_ORDER = [
  "Minha Rotina",
  "Feedback do Portal",
  "Painel Geral",
  "Avisos à Comunidade",
  "Riscos e Pendências",
  "Saúde Predial",
  "Financeiro",
  "Fluxo de Aprovações",
  "Calendário",
  "Manutenção Preventiva",
  "Ordens de Serviço",
  "Obras e Instalações",
  "Ocorrências do Condomínio",
  "Reservas de Áreas",
  "Central de Documentos",
  "Regras de Convivência",
  "Moradores",
  "Fornecedores",
  "Equipe e Escalas",
  "Relatórios",
  "Configuração e Importação",
  "Configurações",
  "Perfis e Permissões",
];

describe("nav", () => {
  it("keeps every item of the design system in the mock order", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(DOC_ORDER);
  });

  it("never lists unavailable modules", () => {
    for (const role of ["owner", "admin", "manager", "staff", "member"] as const) {
      expect(visibleNavItems(role).every((item) => item.available)).toBe(true);
    }
  });

  it("hides Configurações from member and shows it to owner and admin", () => {
    expect(visibleNavItems("member").map((item) => item.label)).toEqual(["Painel Geral"]);
    expect(visibleNavItems("owner").map((item) => item.label)).toEqual(["Painel Geral", "Configurações"]);
    expect(visibleNavItems("admin").map((item) => item.label)).toEqual(["Painel Geral", "Configurações"]);
  });

  it("returns an empty list without a role", () => {
    expect(visibleNavItems(undefined)).toEqual([]);
    expect(visibleBottomNavItems(undefined)).toEqual([]);
  });

  it("skips the bottom nav while fewer than two items are available", () => {
    expect(visibleBottomNavItems("owner")).toEqual([]);
    expect(visibleBottomNavItems("staff")).toEqual([]);
  });

  it("builds paths under the active organization", () => {
    const [painel, configuracoes] = visibleNavItems("owner");
    expect(navPath("org-1", painel!)).toBe("/o/org-1");
    expect(navPath("org-1", configuracoes!)).toBe("/o/org-1/organizacao");
    expect(navPath(undefined, configuracoes!)).toBe("/");
  });
});
