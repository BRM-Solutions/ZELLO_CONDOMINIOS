import { describe, expect, it } from "vitest";
import {
  UNITS_BATCH_MAX,
  can,
  createPersonSchema,
  createUnitsBatchSchema,
  createWorkspaceSchema,
  endUnitMemberSchema,
  highestRole,
  maskPhoneBr,
  normalizePhoneBr,
  peopleFilterSchema,
  revealContactSchema,
  roleSchema,
  rolesFor,
  updatePersonSchema,
} from "./index";

const UNIT_ID = "44444444-4444-4444-8444-444444444444";
const BLOCK_ID = "66666666-6666-4666-8666-666666666666";

describe("papel council", () => {
  it("entra em ROLES e rankeia entre admin e manager", () => {
    expect(roleSchema.safeParse("council").success).toBe(true);
    expect(highestRole(["manager", "council", "member"])).toBe("council");
    expect(highestRole(["council", "admin"])).toBe("admin");
  });

  it("le estrutura mas nao ve pessoas", () => {
    expect(can("council", "structure:read")).toBe(true);
    expect(can("council", "structure:write")).toBe(false);
    expect(can("council", "people:read")).toBe(false);
    expect(can("staff", "people:read")).toBe(false);
    expect(can("member", "people:read")).toBe(false);
  });

  it("gestao do condominio escreve, le e revela pessoas", () => {
    for (const permission of ["structure:write", "people:read", "people:write", "people:reveal"] as const) {
      expect(rolesFor(permission)).toEqual(["owner", "admin", "manager"]);
    }
    expect(rolesFor("structure:read")).toContain("member");
  });
});

describe("telefone BR", () => {
  it("normaliza formatos comuns para E.164", () => {
    expect(normalizePhoneBr("(21) 99876-5432")).toBe("+5521998765432");
    expect(normalizePhoneBr("21998765432")).toBe("+5521998765432");
    expect(normalizePhoneBr("+55 21 2345-6789")).toBe("+552123456789");
    expect(normalizePhoneBr("5521998765432")).toBe("+5521998765432");
  });

  it("rejeita DDD invalido, tamanho e prefixo errados", () => {
    expect(normalizePhoneBr("(01) 99876-5432")).toBeNull();
    expect(normalizePhoneBr("2199876543")).toBeNull();
    expect(normalizePhoneBr("(21) 89876-5432")).toBeNull();
    expect(normalizePhoneBr("abc")).toBeNull();
    expect(normalizePhoneBr("")).toBeNull();
  });

  it("mascara mantendo DDD e os 4 ultimos digitos", () => {
    expect(maskPhoneBr("+5521998765432")).toBe("(21) •••••-5432");
    expect(maskPhoneBr("+552123456789")).toBe("(21) ••••-6789");
    expect(maskPhoneBr("lixo")).not.toMatch(/\d/);
  });
});

describe("createPersonSchema", () => {
  const base = { fullName: "  Ana Souza ", email: " ANA@Exemplo.com " };

  it("normaliza nome, e-mail e telefones", () => {
    const parsed = createPersonSchema.parse({ ...base, phone: "(21) 99876-5432", whatsapp: "21998765432" });
    expect(parsed).toMatchObject({
      fullName: "Ana Souza",
      email: "ana@exemplo.com",
      phone: "+5521998765432",
      whatsapp: "+5521998765432",
      units: [],
    });
  });

  it("aceita unidades com vinculo e rejeita vinculo desconhecido", () => {
    const ok = createPersonSchema.safeParse({ ...base, units: [{ unitId: UNIT_ID, relation: "owner", startsOn: "2026-01-31" }] });
    expect(ok.success).toBe(true);
    expect(createPersonSchema.safeParse({ ...base, units: [{ unitId: UNIT_ID, relation: "dependente" }] }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...base, units: [{ unitId: "x", relation: "owner" }] }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...base, units: [{ unitId: UNIT_ID, relation: "owner", startsOn: "2026-02-31" }] }).success).toBe(false);
  });

  it("valida limites de nome e e-mail", () => {
    expect(createPersonSchema.safeParse({ ...base, fullName: "A" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...base, fullName: "x".repeat(161) }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...base, email: "sem-arroba" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...base, phone: "123" }).success).toBe(false);
  });

  it("updatePersonSchema exige ao menos um campo e permite limpar telefone", () => {
    expect(updatePersonSchema.safeParse({}).success).toBe(false);
    expect(updatePersonSchema.parse({ phone: null })).toEqual({ phone: null });
    expect(updatePersonSchema.safeParse({ status: "arquivado" }).success).toBe(false);
  });
});

describe("estrutura", () => {
  it("batch aceita ate 500 numeros e rejeita vazio, excesso e numero longo", () => {
    expect(createUnitsBatchSchema.safeParse({ blockId: BLOCK_ID, numbers: ["101", "102"] }).success).toBe(true);
    const full = Array.from({ length: UNITS_BATCH_MAX }, (_, i) => String(i + 1));
    expect(createUnitsBatchSchema.safeParse({ blockId: BLOCK_ID, numbers: full }).success).toBe(true);
    expect(createUnitsBatchSchema.safeParse({ blockId: BLOCK_ID, numbers: [...full, "999"] }).success).toBe(false);
    expect(createUnitsBatchSchema.safeParse({ blockId: BLOCK_ID, numbers: [] }).success).toBe(false);
    expect(createUnitsBatchSchema.safeParse({ blockId: BLOCK_ID, numbers: ["1".repeat(21)] }).success).toBe(false);
  });

  it("condominio exige slug em kebab-case minusculo de 3 a 60", () => {
    const base = { name: "Vila Gaudí", address: "Rua A, 10", city: "Rio de Janeiro", state: "rj" };
    expect(createWorkspaceSchema.parse({ ...base, slug: "vila-gaudi" }).state).toBe("RJ");
    for (const slug of ["Vila", "ab", "vila_gaudi", "-vila", "vila--gaudi", "a".repeat(61)]) {
      expect(createWorkspaceSchema.safeParse({ ...base, slug }).success).toBe(false);
    }
  });

  it("motivo da revelacao exige 10 caracteres uteis", () => {
    expect(revealContactSchema.safeParse({ reason: "curto" }).success).toBe(false);
    expect(revealContactSchema.safeParse({ reason: "         x         " }).success).toBe(false);
    expect(revealContactSchema.safeParse({ reason: "Contato para segunda via do boleto" }).success).toBe(true);
  });

  it("encerramento exige data real", () => {
    expect(endUnitMemberSchema.safeParse({ endsOn: "2026-11-05" }).success).toBe(true);
    expect(endUnitMemberSchema.safeParse({ endsOn: "05/11/2026" }).success).toBe(false);
    expect(endUnitMemberSchema.safeParse({ endsOn: "2026-13-01" }).success).toBe(false);
  });
});

describe("peopleFilterSchema", () => {
  it("aplica padroes e ignora filtros vazios da query string", () => {
    const parsed = peopleFilterSchema.parse({ name: "", email: "", unitNumber: "", relation: "", status: "" });
    expect(parsed).toMatchObject({ page: 1, pageSize: 50, order: "az" });
    expect(parsed.name).toBeUndefined();
    expect(parsed.relation).toBeUndefined();
  });

  it("valida enums, uuid e ordem", () => {
    expect(peopleFilterSchema.safeParse({ relation: "tenant", status: "pending", order: "za", blockId: BLOCK_ID }).success).toBe(true);
    expect(peopleFilterSchema.safeParse({ relation: "x" }).success).toBe(false);
    expect(peopleFilterSchema.safeParse({ order: "desc" }).success).toBe(false);
    expect(peopleFilterSchema.safeParse({ blockId: "1" }).success).toBe(false);
    expect(peopleFilterSchema.safeParse({ pageSize: 1000 }).success).toBe(false);
  });
});
