import { describe, expect, it } from "vitest";
import { formatShellDate } from "./date";

describe("formatShellDate", () => {
  it("formats weekday and long date in pt-BR with capitalized names", () => {
    expect(formatShellDate(new Date(2026, 10, 5))).toEqual({ weekday: "Quinta-feira", longDate: "05 de Novembro de 2026" });
    expect(formatShellDate(new Date(2026, 2, 9)).longDate).toBe("09 de Março de 2026");
  });
});
