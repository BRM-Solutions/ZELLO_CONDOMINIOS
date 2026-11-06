import { describe, expect, it } from "vitest";
import {
  addCents,
  buildPaginationMeta,
  errorResponseSchema,
  formatBrl,
  formatCnpj,
  formatCpf,
  highestRole,
  isValidCnpj,
  isValidCpf,
  can,
  paginationOffset,
  rolesFor,
  paginationQuerySchema,
  parseBrlToCents,
  roleSchema,
  splitCents,
  toCents,
} from "./index";

describe("money", () => {
  it("converts reais to cents without float drift", () => {
    expect(toCents(19.9)).toBe(1990);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it("parses Brazilian formatted values", () => {
    expect(parseBrlToCents("R$ 1.234,56")).toBe(123456);
    expect(parseBrlToCents("10")).toBe(1000);
    expect(parseBrlToCents("-5,5")).toBe(-550);
    expect(parseBrlToCents("abc")).toBeNull();
    expect(parseBrlToCents("1,234")).toBeNull();
  });

  it("formats cents as BRL", () => {
    expect(formatBrl(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });

  it("adds and splits without losing cents", () => {
    expect(addCents(100, 250, 5)).toBe(355);
    const parts = splitCents(100, 3);
    expect(parts).toEqual([34, 33, 33]);
    expect(addCents(...parts)).toBe(100);
    expect(() => splitCents(100, 0)).toThrow(RangeError);
  });
});

describe("documents", () => {
  it("validates CPF", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("validates numeric and alphanumeric CNPJ", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("12.ABC.345/01DE-36")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });

  it("formats documents", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("schemas", () => {
  it("applies pagination defaults and limits", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 50 });
    expect(paginationQuerySchema.parse({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50 });
    expect(paginationQuerySchema.safeParse({ pageSize: "1000" }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: "0" }).success).toBe(false);
  });

  it("builds pagination meta and offset", () => {
    expect(buildPaginationMeta({ page: 2, pageSize: 10 }, 25)).toEqual({ page: 2, pageSize: 10, total: 25 });
    expect(paginationOffset({ page: 3, pageSize: 10 })).toBe(20);
  });

  it("accepts only known roles", () => {
    expect(roleSchema.safeParse("manager").success).toBe(true);
    expect(roleSchema.safeParse("root").success).toBe(false);
  });

  it("keeps a single permission matrix", () => {
    expect(can("manager", "workspaces:update")).toBe(true);
    expect(can("member", "workspaces:write")).toBe(false);
    expect(can(undefined, "workspaces:read")).toBe(false);
    expect(rolesFor("members:manage")).toEqual(["owner", "admin"]);
  });

  it("picks the highest role", () => {
    expect(highestRole(["member", "manager"])).toBe("manager");
    expect(highestRole(["staff", "admin", "member"])).toBe("admin");
    expect(highestRole([])).toBeUndefined();
  });

  it("validates the standard error shape", () => {
    expect(errorResponseSchema.safeParse({ error: { code: "x", message: "y" } }).success).toBe(true);
    expect(errorResponseSchema.safeParse({ message: "y" }).success).toBe(false);
  });
});
