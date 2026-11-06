import { describe, expect, it } from "vitest";
import { numerarEmOrdem, proximoProtocolo } from "@/lib/protocolo";

describe("protocolo de ocorrências", () => {
  it("é sequencial", () => expect(proximoProtocolo(["OC-2026-0001", "OC-2026-0002"], 2026)).toBe("OC-2026-0003"));
  it("reinicia na virada de ano", () => expect(proximoProtocolo(["OC-2026-0009"], 2027)).toBe("OC-2027-0001"));
  it("não reutiliza número mesmo com lacunas", () => expect(proximoProtocolo(["OC-2026-0005"], 2026)).toBe("OC-2026-0006"));
  it("numera em ordem de data", () => {
    const r = numerarEmOrdem([{ criadaEm: "2026-03-01" }, { criadaEm: "2026-01-01" }]);
    expect(r.map((o) => o.protocolo)).toEqual(["OC-2026-0002", "OC-2026-0001"]);
  });
});
