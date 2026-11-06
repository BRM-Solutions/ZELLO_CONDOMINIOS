import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptPii, encryptPii, hashPii } from "./pii";

const key = randomBytes(32);
const hashKey = randomBytes(32);
const phone = "+5521998765432";

describe("encryptPii / decryptPii", () => {
  it("faz ida e volta e usa o formato v1:<iv>:<tag>:<ct>", () => {
    const payload = encryptPii(phone, key);
    expect(payload).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(payload).not.toContain(phone);
    expect(payload).not.toContain("998765432");
    expect(decryptPii(payload, key)).toBe(phone);
  });

  it("usa IV aleatório: o mesmo texto gera cifras diferentes", () => {
    expect(encryptPii(phone, key)).not.toBe(encryptPii(phone, key));
  });

  it("falha com chave errada, payload adulterado ou versão desconhecida", () => {
    const payload = encryptPii(phone, key);
    expect(() => decryptPii(payload, randomBytes(32))).toThrow();
    const [version, iv, tag, ct] = payload.split(":") as [string, string, string, string];
    const flipped = Buffer.from(ct, "base64");
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(() => decryptPii([version, iv, tag, flipped.toString("base64")].join(":"), key)).toThrow();
    expect(() => decryptPii(`v2:${iv}:${tag}:${ct}`, key)).toThrow();
    expect(() => decryptPii("lixo", key)).toThrow();
  });
});

describe("hashPii", () => {
  it("é determinístico, depende da chave e não contém o valor", () => {
    const hash = hashPii(phone, hashKey);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPii(phone, hashKey)).toBe(hash);
    expect(hashPii(phone, randomBytes(32))).not.toBe(hash);
    expect(hashPii("+5521998765433", hashKey)).not.toBe(hash);
  });
});
